#!/usr/bin/env node
/**
 * 로또 6/45 당첨 데이터 자동 갱신 스크립트 (의존성 없음, Node 18+)
 *
 *  - data/lotto_history.js 의 마지막 회차 다음 회차부터 동행복권 공식 데이터를 조회해 추가한다.
 *  - 1순위: 신규 JSON  https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchLtEpsd=N
 *    2순위: 구 API     https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=N
 *          (현재는 홈페이지로 302 되지만, 복구/이전 대비 returnValue === 'success' 검증 후 사용)
 *  - 모든 응답은 JSON 파싱 + 스키마/논리 검증을 통과해야만 반영한다(HTML 차단 페이지 등은 폐기).
 *  - 검증 실패/네트워크 오류 시 기존 파일을 절대 건드리지 않고 종료 코드 1 로 끝난다.
 *  - 성공 시 index.html 의 데이터 스크립트 캐시 버스터(?v=회차)도 함께 갱신한다.
 *
 * 사용법:
 *   node tools/update-lotto.js            # 신규 회차 감지 시 파일 갱신
 *   node tools/update-lotto.js --dry-run  # 파일 수정 없이 감지 결과만 출력
 *   node tools/update-lotto.js --to 1251  # 최대 회차 상한 지정(검증/복구용)
 *
 * 종료 코드: 0 = 정상(갱신 여부는 출력/GITHUB_OUTPUT 참고), 1 = 오류(파일 미변경)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'lotto_history.js');
const INDEX_FILE = path.join(ROOT, 'index.html');
const DATA_PREFIX = 'window.LOTTO_HISTORY = ';

const NEW_API = 'https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchLtEpsd=';
const OLD_API = 'https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.5',
    'Referer': 'https://www.dhlottery.co.kr/lt645/result',
    'X-Requested-With': 'XMLHttpRequest'
};

const MAX_RETRIES = 4;          // 엔드포인트당 시도 횟수
const TIMEOUT_MS = 20000;
const MAX_NEW_PER_RUN = 12;     // 비정상 폭주 방지(최대 12주치)
const DRY_RUN = process.argv.includes('--dry-run');
const toIdx = process.argv.indexOf('--to');
const TO_LIMIT = toIdx > -1 ? parseInt(process.argv[toIdx + 1], 10) : Infinity;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[update-lotto]', ...a);

// ---------- 데이터 파일 입출력 ----------
function loadHistory() {
    const raw = fs.readFileSync(DATA_FILE, 'utf8').trim();
    if (!raw.startsWith(DATA_PREFIX)) throw new Error('data/lotto_history.js 형식이 예상과 다릅니다.');
    const json = raw.slice(DATA_PREFIX.length).replace(/;\s*$/, '');
    const arr = JSON.parse(json);
    if (!Array.isArray(arr) || arr.length === 0) throw new Error('기존 데이터가 비어 있습니다.');
    arr.forEach((d, i) => {
        if (d.no !== i + 1) throw new Error(`기존 데이터 회차 연속성 오류: index ${i} -> no ${d.no}`);
    });
    return arr;
}

function saveHistory(arr) {
    const body = DATA_PREFIX + JSON.stringify(arr) + ';\n';
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, body, 'utf8');
    // 저장 결과 재검증 후 교체(원자적 갱신)
    JSON.parse(fs.readFileSync(tmp, 'utf8').slice(DATA_PREFIX.length).replace(/;\s*$/, ''));
    fs.renameSync(tmp, DATA_FILE);
}

// ---------- 검증 ----------
function ymdToIso(s) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(s));
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function validateDraw(d, prev) {
    const err = (m) => { throw new Error(`회차 ${d.no} 검증 실패: ${m}`); };
    if (!Number.isInteger(d.no) || d.no !== prev.no + 1) err(`회차 번호가 연속되지 않음 (이전 ${prev.no})`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) err(`추첨일 형식 오류 ${d.date}`);
    const dt = new Date(d.date + 'T00:00:00Z');
    if (isNaN(dt.getTime()) || dt.getUTCDay() !== 6) err(`추첨일이 토요일이 아님 ${d.date}`);
    const gapDays = Math.round((dt - new Date(prev.date + 'T00:00:00Z')) / 86400000);
    if (gapDays !== 7) err(`이전 회차와 추첨일 간격이 7일이 아님 (${gapDays}일)`);
    if (!Array.isArray(d.nums) || d.nums.length !== 6) err('당첨번호 6개 아님');
    const all = [...d.nums, d.bnus];
    if (!all.every((n) => Number.isInteger(n) && n >= 1 && n <= 45)) err('번호 범위(1~45) 오류');
    if (new Set(all).size !== 7) err('번호 중복(보너스 포함)');
    if (d.nums.some((n, i) => i > 0 && n < d.nums[i - 1])) err('당첨번호 오름차순 아님');
    if (!Number.isInteger(d.prize) || d.prize < 0) err('1등 당첨금 오류');
    if (!Number.isInteger(d.winners) || d.winners < 0) err('1등 당첨자 수 오류');
    if ((d.winners > 0) !== (d.prize > 0)) err('1등 당첨자 수와 당첨금 불일치');
    return d;
}

// ---------- 조회 ----------
async function fetchJson(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, { headers: HEADERS, redirect: 'manual', signal: ctrl.signal });
        if (res.status !== 200) throw new Error(`HTTP ${res.status}${res.headers.get('location') ? ' -> ' + res.headers.get('location') : ''}`);
        const ct = res.headers.get('content-type') || '';
        const text = await res.text();
        if (!/json/i.test(ct) && !/^\s*[\[{]/.test(text)) throw new Error(`JSON 아닌 응답 (content-type: ${ct}, 앞 80자: ${text.slice(0, 80).replace(/\s+/g, ' ')})`);
        try { return JSON.parse(text); } catch (e) { throw new Error('JSON 파싱 실패: ' + e.message); }
    } finally {
        clearTimeout(timer);
    }
}

async function withRetry(label, fn) {
    let lastErr;
    for (let i = 1; i <= MAX_RETRIES; i++) {
        try { return await fn(); } catch (e) {
            lastErr = e;
            log(`${label} 시도 ${i}/${MAX_RETRIES} 실패: ${e.message}`);
            if (i < MAX_RETRIES) await sleep(2000 * i * i); // 2s, 8s, 18s
        }
    }
    throw lastErr;
}

/** @returns {object|null} 해당 회차 정규화 데이터, 아직 추첨 전이면 null */
async function fetchNew(no) {
    const j = await fetchJson(NEW_API + no);
    if (!j || !j.data || !Array.isArray(j.data.list)) throw new Error('신규 API 응답 스키마 오류');
    if (j.data.list.length === 0) return null;
    const r = j.data.list.find((x) => x.ltEpsd === no);
    if (!r) throw new Error(`요청 회차(${no})와 다른 응답 (${j.data.list.map((x) => x.ltEpsd)})`);
    return {
        no: r.ltEpsd,
        date: ymdToIso(r.ltRflYmd),
        nums: [r.tm1WnNo, r.tm2WnNo, r.tm3WnNo, r.tm4WnNo, r.tm5WnNo, r.tm6WnNo].map(Number),
        bnus: Number(r.bnsWnNo),
        prize: Number(r.rnk1WnAmt),
        winners: Number(r.rnk1WnNope)
    };
}

async function fetchOld(no) {
    const j = await fetchJson(OLD_API + no);
    if (j.returnValue === 'fail') return null; // 미추첨 회차
    if (j.returnValue !== 'success') throw new Error('구 API returnValue 가 success 아님');
    if (j.drwNo !== no) throw new Error(`요청 회차(${no})와 다른 응답 (${j.drwNo})`);
    return {
        no: j.drwNo,
        date: j.drwNoDate,
        nums: [j.drwtNo1, j.drwtNo2, j.drwtNo3, j.drwtNo4, j.drwtNo5, j.drwtNo6].map(Number),
        bnus: Number(j.bnusNo),
        prize: Number(j.firstWinamnt),
        winners: Number(j.firstPrzwnerCo)
    };
}

async function fetchDraw(no) {
    const errors = [];
    for (const [name, fn] of [['신규 API', fetchNew], ['구 API', fetchOld]]) {
        try {
            const d = await withRetry(`${name} ${no}회`, () => fn(no));
            return d; // null(미추첨) 포함
        } catch (e) {
            errors.push(`${name}: ${e.message}`);
        }
    }
    throw new Error(`${no}회 조회 실패 -> ${errors.join(' | ')}`);
}

// ---------- index.html 캐시 버스터 ----------
function bumpCacheBuster(latestNo) {
    const html = fs.readFileSync(INDEX_FILE, 'utf8');
    const re = /(<script[^>]+src="data\/lotto_history\.js)(?:\?v=[^"]*)?(")/;
    if (!re.test(html)) throw new Error('index.html 에서 data/lotto_history.js 스크립트 태그를 찾지 못했습니다.');
    const next = html.replace(re, `$1?v=${latestNo}$2`);
    if (next !== html) fs.writeFileSync(INDEX_FILE, next, 'utf8');
}

function setOutput(k, v) {
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
}

// ---------- main ----------
(async () => {
    const history = loadHistory();
    const startLatest = history[history.length - 1].no;
    log(`현재 보유 최신 회차: ${startLatest}회 (${history[history.length - 1].date})`);

    const added = [];
    for (let n = startLatest + 1; n <= Math.min(TO_LIMIT, startLatest + MAX_NEW_PER_RUN); n++) {
        const d = await fetchDraw(n);
        if (d === null) { log(`${n}회: 아직 추첨/발표 전 → 중단`); break; }
        validateDraw(d, history[history.length - 1] || { no: 0, date: '1970-01-01' });
        history.push(d);
        added.push(d);
        log(`${n}회 확인: ${d.date} [${d.nums.join(',')}] + ${d.bnus} / 1등 ${d.prize.toLocaleString()}원 x ${d.winners}명`);
    }

    const latest = history[history.length - 1];
    setOutput('latest', latest.no);
    setOutput('updated', added.length > 0 ? 'true' : 'false');
    setOutput('added', added.map((d) => d.no).join(','));

    if (added.length === 0) { log('신규 회차 없음 (변경 없음)'); return; }
    if (DRY_RUN) { log(`[dry-run] ${added.length}개 회차 추가 예정, 파일 미수정`); return; }

    saveHistory(history);
    bumpCacheBuster(latest.no);
    log(`갱신 완료: ${added.map((d) => d.no).join(', ')}회 추가 → 최신 ${latest.no}회 (총 ${history.length}회차)`);
})().catch((e) => {
    console.error('[update-lotto] 오류 — 데이터 파일은 변경되지 않았습니다.\n ', e.message);
    process.exit(1);
});

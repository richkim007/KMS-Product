#!/usr/bin/env node
/**
 * IndexNow 제출 스크립트 (loddo.co → 네이버 서치어드바이저)
 *
 * 사용법 (프로젝트 루트에서 실행):
 *   node tools/indexnow.js articles/새글.html            # 파일 경로로 지정
 *   node tools/indexnow.js https://loddo.co/articles/새글.html   # 전체 URL로 지정
 *   node tools/indexnow.js --last-commit                 # 마지막 커밋에서 추가·수정된 .html 자동 제출
 *   node tools/indexnow.js --sitemap                     # sitemap.xml 의 모든 URL 제출
 *   node tools/indexnow.js --dry-run --last-commit       # 전송하지 않고 대상만 출력
 *
 * 주의: 반드시 새 글을 푸시해 운영 서버에 배포된 뒤에 실행한다.
 *       (미배포 URL을 제출하면 수집 실패로 처리될 수 있다.)
 * 키 파일: 루트의 32자리 16진수 이름 .txt 파일(내용 = 파일명과 동일한 키)을 자동 탐지한다.
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const HOST = 'loddo.co';
const ORIGIN = `https://${HOST}`;
const ENDPOINT = 'https://searchadvisor.naver.com/indexnow';
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const useSitemap = args.includes('--sitemap');
const useLast = args.includes('--last-commit');
const inputs = args.filter(a => !a.startsWith('--'));

function findKey() {
  const f = fs.readdirSync(ROOT).find(n => /^[0-9a-f]{32}\.txt$/.test(n));
  if (!f) throw new Error('루트에서 IndexNow 키 파일(32자리 hex.txt)을 찾을 수 없습니다.');
  const key = f.replace(/\.txt$/, '');
  const body = fs.readFileSync(path.join(ROOT, f), 'utf8').trim();
  if (body !== key) throw new Error(`키 파일 내용(${body})이 파일명(${key})과 다릅니다.`);
  return key;
}

function toUrl(p) {
  if (/^https?:\/\//.test(p)) return p;
  const rel = p.replace(/\\/g, '/').replace(/^\.?\//, '');
  if (rel === 'index.html') return `${ORIGIN}/`;
  return `${ORIGIN}/${rel}`;
}

function collect() {
  const set = new Set(inputs.map(toUrl));
  if (useLast) {
    const out = cp.execSync('git diff --name-only --diff-filter=AM HEAD~1 HEAD', { cwd: ROOT }).toString();
    out.split(/\r?\n/).filter(f => /\.html$/.test(f) && !/^(404|service|naver)/.test(path.basename(f)))
      .forEach(f => set.add(toUrl(f)));
  }
  if (useSitemap) {
    const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) set.add(m[1].trim());
  }
  return [...set];
}

(async () => {
  const urls = collect();
  if (!urls.length) {
    console.error('제출할 URL이 없습니다. 사용법은 파일 상단 주석을 참고하세요.');
    process.exit(1);
  }
  const bad = urls.filter(u => !u.startsWith(ORIGIN + '/'));
  if (bad.length) throw new Error('다른 호스트의 URL이 포함되어 있습니다: ' + bad.join(', '));

  const key = findKey();
  const keyLocation = `${ORIGIN}/${key}.txt`;
  console.log(`제출 대상 ${urls.length}개:`);
  urls.forEach(u => console.log('  ' + u));
  if (dry) { console.log('\n[dry-run] 전송하지 않았습니다.'); return; }

  // 사전 점검: 키 파일과 각 URL 이 운영 서버에서 열리는지 확인
  const kr = await fetch(keyLocation, { redirect: 'follow' });
  if (!kr.ok || (await kr.text()).trim() !== key) throw new Error('운영 서버의 키 파일이 확인되지 않습니다. 먼저 배포하세요.');
  const dead = [];
  for (const u of urls) {
    const r = await fetch(u, { redirect: 'follow' });
    if (!r.ok) dead.push(`${r.status} ${u}`);
  }
  if (dead.length) throw new Error('아직 배포되지 않았거나 열리지 않는 URL:\n  ' + dead.join('\n  '));

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key, keyLocation, urlList: urls })
  });
  console.log(`\n네이버 IndexNow 응답: HTTP ${res.status}`);
  if (res.status === 200 || res.status === 202) console.log('접수 완료 (수집·색인 반영은 네이버 쪽에서 수일에 걸쳐 진행됩니다).');
  else { console.error(await res.text()); process.exit(1); }
})().catch(e => { console.error('오류:', e.message); process.exit(1); });

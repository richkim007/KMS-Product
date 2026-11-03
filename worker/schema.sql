-- ==============================================================================
-- 히말라야 IQ 로또 원정대 (loddo.co) - Cloudflare D1 (SQLite) 스키마
-- 파일명: worker/schema.sql
-- 용도: 완등 기록 영구 보관, 감사 로그, 명예의 전당 및 통계 산출
-- ==============================================================================

-- 1. 완등 기록 영구 보관 메인 테이블
CREATE TABLE IF NOT EXISTS expedition_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,                -- 고유 세션 UUID
    session_seed TEXT NOT NULL,                     -- 64-bit xoshiro256** 시드 (재현 검증용)
    player_nick TEXT NOT NULL,                      -- 등반가 닉네임
    age_group TEXT NOT NULL,                        -- '10대' ~ '100대'
    country_code TEXT NOT NULL,                     -- 'KR', 'US', 'JP' 등 (ISO-3166-1 alpha-2)
    total_duration_ms INTEGER NOT NULL,             -- 총 소요 시간 (밀리초)
    global_rank INTEGER NOT NULL DEFAULT 0,         -- 달성 당시 전체 순위
    age_rank INTEGER NOT NULL DEFAULT 0,            -- 달성 당시 연령별 순위
    iq INTEGER NOT NULL DEFAULT 120,                -- 최종 추정 IQ
    altitude INTEGER NOT NULL DEFAULT 8848,         -- 도달 고도 (정상 8,848m)
    avg_speed TEXT NOT NULL DEFAULT '18.2초',       -- 문제당 평균 풀이 속도
    keystroke_variance REAL NOT NULL DEFAULT 0.0,   -- 키스트로크 분산 값 (치팅 감사용)
    verified_at INTEGER NOT NULL,                   -- 사후 검증 통과 Unix Epoch (ms)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP   -- 레코드 생성 일시 (UTC)
);

-- 2. 고성능 조회를 위한 복합 인덱스 (Index Optimization)

-- A. 날짜별 및 최단 시간 순 정렬 인덱스 (데일리 챔피언십 집계용)
CREATE INDEX IF NOT EXISTS idx_records_time_rank 
ON expedition_records (verified_at DESC, total_duration_ms ASC);

-- B. 연령대별 최단 시간 랭킹 조회 인덱스 (10대~100대 리그 필터링)
CREATE INDEX IF NOT EXISTS idx_records_age_duration 
ON expedition_records (age_group, total_duration_ms ASC);

-- C. 국가별 통계 및 대항전 집계 인덱스
CREATE INDEX IF NOT EXISTS idx_records_country_duration 
ON expedition_records (country_code, total_duration_ms ASC);

-- D. 유저 세션 중복 삽입 방지 고유 인덱스
CREATE INDEX IF NOT EXISTS idx_records_session 
ON expedition_records (session_id);


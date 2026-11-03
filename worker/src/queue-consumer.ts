/**
 * ==============================================================================
 * [4단계] Cloudflare Queue Consumer 및 D1 Database 벌크 저장 핸들러
 * 파일명: worker/src/queue-consumer.ts
 * ==============================================================================
 * 특징:
 * 1. 100~500건 단위의 완등 텔레메트리 배치 수신
 * 2. D1(SQLite) batch() 단일 트랜잭션 벌크 저장 (DB Lock 및 커넥션 고갈 원천 차단)
 * 3. INSERT OR IGNORE 기반 세션 중복 방지
 * 4. 트랜잭션 실패 시 지수 백오프 기반 재시도(Retry) 및 DLQ(Dead Letter Queue) 분기
 * ==============================================================================
 */

export interface ExpeditionQueueMessage {
    sessionId: string;
    sessionSeed: string;
    playerNick: string;
    ageGroup: string;
    countryCode: string;
    totalDurationMs: number;
    globalRank?: number;
    ageRank?: number;
    iq?: number;
    altitude?: number;
    avgSpeed?: string;
    keystrokeVariance?: number;
    verifiedAt?: number;
}

export interface QueueEnv {
    DB: D1Database;
    DLQ?: Queue<any>; // Dead Letter Queue (선택적 바인딩)
}

export async function processExpeditionQueueBatch(
    batch: MessageBatch<ExpeditionQueueMessage>,
    env: QueueEnv
): Promise<void> {
    const startTime = Date.now();
    const messages = batch.messages;
    const batchSize = messages.length;

    if (batchSize === 0) return;

    console.log(`[Queue Consumer] 배치 수신: ${batchSize}건 (Queue: ${batch.queue})`);

    // 1. 유효한 메시지만 필터링 및 D1 바인딩 준비
    const validMessages: typeof messages = [];
    const statements: D1PreparedStatement[] = [];

    const insertSql = `
        INSERT OR IGNORE INTO expedition_records (
            session_id,
            session_seed,
            player_nick,
            age_group,
            country_code,
            total_duration_ms,
            global_rank,
            age_rank,
            iq,
            altitude,
            avg_speed,
            keystroke_variance,
            verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const msg of messages) {
        const body = msg.body;
        if (!body || !body.sessionId || !body.totalDurationMs) {
            console.warn(`[Queue Consumer] 유효하지 않은 페이로드 제외 (Message ID: ${msg.id})`);
            msg.ack(); // 불량 메시지는 승인 처리하여 큐에서 제거
            continue;
        }

        validMessages.push(msg);

        const stmt = env.DB.prepare(insertSql).bind(
            body.sessionId,
            body.sessionSeed || '0',
            (body.playerNick || '알파인').slice(0, 30),
            body.ageGroup || '40대',
            body.countryCode || 'KR',
            Math.round(body.totalDurationMs),
            body.globalRank || 0,
            body.ageRank || 0,
            body.iq || 120,
            body.altitude || 8848,
            body.avgSpeed || '18.2초',
            body.keystrokeVariance || 0.0,
            body.verifiedAt || Date.now()
        );

        statements.push(stmt);
    }

    if (statements.length === 0) return;

    // 2. D1 Database 단일 트랜잭션 벌크 배치 실행 (O(1) 커넥션 소비)
    try {
        const batchResults = await env.DB.batch(statements);
        const elapsedMs = Date.now() - startTime;

        console.log(`[Queue Consumer] D1 벌크 저장 성공: ${batchResults.length}건 완료 (${elapsedMs}ms 소요)`);

        // 성공한 모든 메시지 큐 승인(Ack)
        for (const msg of validMessages) {
            msg.ack();
        }

    } catch (err: any) {
        console.error('[Queue Consumer] D1 벌크 트랜잭션 에러:', err.message);

        // 3. 트랜잭션 실패 시 장애 격리 및 재시도/DLQ 분기 로직
        for (const msg of validMessages) {
            // Cloudflare Queue 메시지 재시도 횟수 확인 (기본 최대 3회)
            if (msg.attempts >= 3) {
                console.error(`[Queue Consumer] 최대 재시도(3회) 초과 -> DLQ 이관 (Session: ${msg.body.sessionId})`);
                if (env.DLQ) {
                    try {
                        await env.DLQ.send({
                            failedMessage: msg.body,
                            error: err.message,
                            failedAt: Date.now(),
                            attempts: msg.attempts
                        });
                    } catch (dlqErr) {
                        console.error('[Queue Consumer] DLQ 전송 실패:', dlqErr);
                    }
                }
                msg.ack(); // DLQ 이관 후 메인 큐에서 제거
            } else {
                // 지수 백오프 재시도 (1회 실패: 5초 후, 2회 실패: 15초 후)
                const delaySeconds = msg.attempts === 1 ? 5 : 15;
                msg.retry({ delaySeconds });
            }
        }
    }
}


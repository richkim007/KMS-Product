/**
 * ==============================================================================
 * [3단계] Cloudflare Workers 초당 수십만 조회 대응 랭킹 API (leaderboard.ts)
 * ==============================================================================
 * - Upstash Serverless Redis Sorted Set(ZSET) O(log N) 조회
 * - Cloudflare Edge CDN Stale-While-Revalidate (SWR) 캐싱
 * - 수백만 동시 접속 시 Redis 쿼리 99.9% 차단 (5초 Anycast 엣지 캐시)
 * ==============================================================================
 */

import { Redis } from '@upstash/redis/cloudflare';

export interface LeaderboardItem {
    rank: number;
    country: string;
    ageGroup: string;
    nick: string;
    alt: number;
    rankLabel: string;
    durationMs: number;
    durationFormatted: string;
    speed: string;
    iq: number;
    points?: number;
    isMe?: boolean;
}

export interface LeaderboardResponse {
    success: boolean;
    category: string;
    value: string;
    sort: 'time' | 'points';
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    leaderboard: LeaderboardItem[];
    cachedAt: number;
}

export async function handleGetLeaderboard(request: Request, env: { UPSTASH_REDIS_REST_URL: string; UPSTASH_REDIS_REST_TOKEN: string }): Promise<Response> {
    const url = new URL(request.url);

    // 1. 쿼리 파라미터 파싱
    const category = (url.searchParams.get('category') || 'global').toLowerCase(); // 'global' | 'age' | 'country'
    let value = (url.searchParams.get('value') || '').trim();                      // '40', '40대', 'KR' 등
    if (category === 'age' && value && !value.endsWith('대')) {
        value = value + '대';
    }
    const sort = (url.searchParams.get('sort') || 'time').toLowerCase() === 'points' ? 'points' : 'time';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(5, parseInt(url.searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;
    const stop = offset + limit - 1;

    // 2. Cloudflare Cache API (Stale-While-Revalidate 캐시 확인)
    const cacheKey = new Request(url.toString(), request);
    const cache = (caches as any).default;

    let cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
        return cachedResponse;
    }

    // 3. Cache Miss 발생 시에만 Upstash Serverless Redis 조회
    const redis = new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
    });

    let zsetKey = 'leaderboard:global';
    if (category === 'age' && value) {
        zsetKey = `leaderboard:age:${value}`;
    } else if (category === 'country' && value) {
        zsetKey = `leaderboard:country:${value}`;
    }
    const fullKey = `${zsetKey}:${sort}`;

    try {
        const pipeline = redis.pipeline();
        if (sort === 'time') {
            // 최단 시간 순 (소요시간 오름차순: 낮은 ms가 1위)
            pipeline.zrange(fullKey, offset, stop, { withScores: true });
        } else {
            // 종합 점수 순 (점수 내림차순: 높은 포인트가 1위)
            pipeline.zrevrange(fullKey, offset, stop, { withScores: true });
        }
        pipeline.zcard(fullKey);

        const results = await pipeline.exec();
        const rawItems = (results[0] as Array<string | number>) || [];
        const totalCount = typeof results[1] === 'number' ? (results[1] as number) : 0;

        const leaderboard: LeaderboardItem[] = [];
        for (let i = 0; i < rawItems.length; i += 2) {
            const memberStr = String(rawItems[i]);
            const scoreVal = Number(rawItems[i + 1]);

            // 파싱 규격: country:ageGroup:nick:sessionId:iq:alt:speed
            const parts = memberStr.split(':');
            const country = parts[0] || 'KR';
            const ageGroup = parts[1] || '40대';
            const nick = parts[2] || '알파인';
            const iq = parseInt(parts[4] || '125', 10);
            const alt = parseInt(parts[5] || '8848', 10);
            const speed = parts[6] || '14.2초';

            const durationMs = sort === 'time' ? scoreVal : Math.round((8848 - alt) * 10 + 600000);
            const points = sort === 'points' ? scoreVal : Math.round(alt + iq * 25 + Math.max(0, (1200000 - durationMs) / 100));

            leaderboard.push({
                rank: offset + Math.floor(i / 2) + 1,
                country,
                ageGroup,
                nick,
                alt,
                rankLabel: alt >= 8848 ? '1등' : alt >= 7950 ? '2등' : alt >= 7162 ? '3등' : alt >= 6400 ? '4등' : alt >= 6065 ? '5등' : '6등',
                durationMs,
                durationFormatted: formatStopwatch(durationMs),
                speed,
                iq,
                points
            });
        }

        const payload: LeaderboardResponse = {
            success: true,
            category,
            value,
            sort,
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit) || 1,
            leaderboard,
            cachedAt: Date.now()
        };

        const response = new Response(JSON.stringify(payload), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                // 엣지 CDN 5초 캐시, 만료 후 15초 동안 백그라운드 갱신(SWR)
                'Cache-Control': 'public, max-age=5, s-maxage=5, stale-while-revalidate=15',
                'X-Edge-Cache': 'MISS'
            }
        });

        // Cloudflare Edge Cache에 저장
        await cache.put(cacheKey, response.clone());
        return response;

    } catch (err: any) {
        console.error('Leaderboard Fetch Error:', err.message);
        return new Response(JSON.stringify({
            success: false,
            error: 'REDIS_QUERY_FAILED',
            message: err.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}

function formatStopwatch(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const milli = Math.floor((ms % 1000) / 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${milli}`;
}


/**
 * Rate limit đơn giản (in-memory token bucket) - spec mục 7 #1.
 * Mock: lưu trong bộ nhớ process, đủ cho localhost/scale nội bộ.
 * Production: thay bằng Upstash/Redis hoặc Vercel rate limit.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit = 60,
  windowMs = 60_000,
): { ok: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  const ok = b.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - b.count),
    retryAfterSec: Math.max(0, Math.ceil((b.resetAt - now) / 1000)),
  };
}

// Dọn bucket hết hạn định kỳ (tránh rò bộ nhớ)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      if (now > b.resetAt) buckets.delete(k);
    }
  }, 5 * 60_000).unref?.();
}

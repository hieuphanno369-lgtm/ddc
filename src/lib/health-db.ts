/**
 * Ping DB thuan (P5-B Task 3) - khong import Prisma, chi dua 1 query bat ky voi timeout.
 * Dung cho `GET /api/health/db` (compose healthcheck, reverse proxy, giam sat IT).
 */

export const HEALTH_DB_TIMEOUT_MS = 3000;

export type PingResult = { ok: true } | { ok: false; timedOut: boolean; error?: unknown };

export function pingDb(query: () => Promise<unknown>, timeoutMs: number): Promise<PingResult> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, timedOut: true });
    }, timeoutMs);

    Promise.resolve()
      .then(query)
      .then(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ ok: true });
      })
      .catch((error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ ok: false, timedOut: false, error });
      });
  });
}

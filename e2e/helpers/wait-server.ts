/**
 * Chờ dev server trả lời (item 11, ERR_CONNECTION_REFUSED chập chờn ở 10-ten-app): `next dev` có thể đang khởi động lại
 * hoặc biên dịch lại đúng lúc suite bắt đầu. Thử lại tới khi trả HTTP (bất kỳ mã nào < 500) hoặc hết hạn.
 * Cổng đóng giữa chừng suite (server chết) thì không cứu được ở đây: xem `docs` trong thay-doi.md.
 */
export async function waitForServer(
  url: string,
  opts: { timeoutMs?: number; intervalMs?: number; fetchFn?: typeof fetch; sleep?: (ms: number) => Promise<void> } = {},
): Promise<void> {
  const { timeoutMs = 120_000, intervalMs = 2_000, fetchFn = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = opts;
  const deadline = Date.now() + timeoutMs;
  let last = 'chua thu';
  for (;;) {
    try {
      const res = await fetchFn(url, { redirect: 'manual' });
      if (res.status < 500) return;
      last = `HTTP ${res.status}`;
    } catch (e) {
      last = String((e as Error).message ?? e);
    }
    if (Date.now() + intervalMs > deadline) throw new Error(`Dev server ${url} chua san sang sau ${timeoutMs}ms (${last})`);
    await sleep(intervalMs);
  }
}

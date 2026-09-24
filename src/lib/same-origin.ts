/** true khi header Origin có host trùng x-forwarded-host ?? host. Thiếu Origin → false. */
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get('origin');
  if (!origin) return false;
  const expectedHost = headers.get('x-forwarded-host') ?? headers.get('host');
  if (!expectedHost) return false;
  try {
    const originHost = new URL(origin).host;
    return originHost === expectedHost;
  } catch {
    return false;
  }
}

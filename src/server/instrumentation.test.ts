import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestError, register } from '../../instrumentation';

/** P5-B Task 2 - register() kiem env luc khoi dong; onRequestError ghi log JSON cho loi request chua bat. */
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('register', () => {
  it("NEXT_RUNTIME='edge' -> khong goi process.exit", async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    await register();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("NEXT_RUNTIME='nodejs', production, thieu bien bat buoc -> process.exit(1)", async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('DIRECT_URL', '');
    vi.stubEnv('NEXTAUTH_SECRET', '');
    vi.stubEnv('NEXTAUTH_URL', '');
    vi.stubEnv('NOTIFY_SECRET_KEY', '');
    vi.stubEnv('CRON_SECRET', '');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await register();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe('onRequestError', () => {
  it('ghi 1 dong console.error JSON, khong lo mat khau/token/cookie', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    onRequestError(
      new Error('password=hunter2'),
      {
        path: '/vi/dat-lai-mat-khau?token=BI_MAT#x',
        method: 'GET',
        headers: { cookie: 'next-auth.session-token=SECRET_COOKIE' },
      },
      {
        routerKind: 'App Router',
        routePath: '/[locale]/dat-lai-mat-khau',
        routeType: 'render',
        renderSource: 'server-rendering',
        revalidateReason: undefined,
      },
    );
    expect(err).toHaveBeenCalledTimes(1);
    const raw = err.mock.calls[0][0] as string;
    const line = JSON.parse(raw);
    expect(line.event).toBe('request.unhandled');
    expect(line.path).toBe('/vi/dat-lai-mat-khau');
    expect(raw).not.toContain('hunter2');
    expect(raw).not.toContain('BI_MAT');
    expect(raw).not.toContain('SECRET_COOKIE');
  });
});

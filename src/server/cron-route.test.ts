import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { runJobMock } = vi.hoisted(() => ({ runJobMock: vi.fn(async () => ({ status: 'ok', detail: 'x' })) }));
vi.mock('@/server/jobs', () => ({ runJob: runJobMock }));

import { POST } from '../../app/api/cron/[job]/route';

const req = (auth?: string) => new Request('http://localhost/api/cron/rates_monthly', {
  method: 'POST',
  headers: auth ? { authorization: auth } : undefined,
});
const ctx = (job: string) => ({ params: { job } });

const ORIGINAL_SECRET = process.env.CRON_SECRET;

beforeEach(() => {
  runJobMock.mockClear();
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;
});

describe('POST /api/cron/[job]', () => {
  it('thieu CRON_SECRET -> 503', async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(req('Bearer x'), ctx('rates_monthly'));
    expect(res.status).toBe(503);
  });

  it('sai token -> 401', async () => {
    process.env.CRON_SECRET = 'dung-secret';
    const res = await POST(req('Bearer sai'), ctx('rates_monthly'));
    expect(res.status).toBe(401);
  });

  it('dung token, job la -> 404', async () => {
    process.env.CRON_SECRET = 'dung-secret';
    const res = await POST(req('Bearer dung-secret'), ctx('job-la'));
    expect(res.status).toBe(404);
  });

  it("dung token, job dung -> 200, runJob goi voi 'cron'", async () => {
    process.env.CRON_SECRET = 'dung-secret';
    const res = await POST(req('Bearer dung-secret'), ctx('rates_monthly'));
    expect(res.status).toBe(200);
    expect(runJobMock).toHaveBeenCalledWith('rates_monthly', 'cron');
  });
});

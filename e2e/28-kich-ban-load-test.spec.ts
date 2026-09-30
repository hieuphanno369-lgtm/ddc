import { test, expect, request as pwRequest } from '@playwright/test';
import { loadE2eEnv, resolveE2eTarget } from './helpers/env';
import { DEFAULT_SCENARIOS, classifyResponse } from '../src/lib/load-test';

/**
 * P5-B (tester) - moi kich ban cua load test phai ra ket qua "thanh cong" (errorKind null) voi vai tro dung
 * cua no, neu khong load test se bao loi gia. Dung storageState san co (admin, viewer) va do bang
 * APIRequestContext, khong theo redirect (giong load-test: redirect: 'manual').
 */
const BASE = resolveE2eTarget(loadE2eEnv()).baseURL;
const CTX = { projectId: 1, month: '2026-09' };

for (const role of ['admin', 'viewer'] as const) {
  test.describe(`28 - kich ban load test khong tao loi gia (${role})`, () => {
    for (const sc of DEFAULT_SCENARIOS.filter((s) => (s.roles as readonly string[]).includes(role))) {
      test(`${sc.name} -> ${sc.path(CTX)} phai la thanh cong`, async () => {
        const ctx = await pwRequest.newContext({ baseURL: BASE, storageState: `e2e/.auth/${role}.json` });
        const res = await ctx.get(sc.path(CTX), { maxRedirects: 0, headers: { 'X-Forwarded-For': '198.51.100.28' } });
        await res.body();
        const kind = classifyResponse(res.status(), res.headers()['content-type'] ?? null, sc.expect);
        await ctx.dispose();
        expect(kind, `${sc.name}: HTTP ${res.status()} location=${res.headers()['location'] ?? '-'}`).toBeNull();
      });
    }
  });
}

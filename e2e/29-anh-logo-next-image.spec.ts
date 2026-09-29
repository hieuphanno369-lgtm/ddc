import { test, expect, request as pwRequest } from '@playwright/test';
import { loadE2eEnv, resolveE2eTarget } from './helpers/env';

/**
 * P5-B (tester) - tai hien loi co san tren `next start`: yeu cau anh logo qua bo toi uu anh cua Next voi
 * w=48 (logo 38px tren man hinh DPR 1) treo mai, trong khi w=64/96 tra ngay. Loi nay khien `networkidle`
 * khong bao gio toi tren moi trang co sidebar. Spec do bang timeout 10 giay.
 */
const BASE = resolveE2eTarget(loadE2eEnv()).baseURL;

for (const w of [48, 64, 96, 128]) {
  test(`/_next/image logo w=${w} tra loi trong 10 giay`, async () => {
    const ctx = await pwRequest.newContext({ baseURL: BASE });
    const res = await ctx.get(`/_next/image?url=%2Flogo.png&w=${w}&q=75`, {
      headers: { accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' },
      timeout: 10_000,
    });
    expect(res.status()).toBe(200);
    await ctx.dispose();
  });
}

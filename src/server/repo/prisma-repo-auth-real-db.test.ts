/**
 * P3E (Task 5, bước 5.5) - test DB THẬT cho `prismaAuthStore` (KHÔNG mock `@/server/db`): chỉ
 * Postgres thật mới chứng minh được `pg_advisory_xact_lock` khoá đúng - mock không lộ race (N2).
 * Bỏ qua hoàn toàn khi chạy `npm test` bình thường (không có `DATABASE_URL`, xem `vitest.config.ts`);
 * chạy tay bằng:
 *   $env:DATABASE_URL='postgresql://postgres:Admin.301197@localhost:5433/ddc_control_tower_c?schema=public'
 *   npx vitest run src/server/repo/prisma-repo-auth-real-db.test.ts
 * Tự tạo + tự dọn dữ liệu test (email `test-p3e-real-db-*@daidung.com.vn`, các dòng `auth_throttle`
 * kind bắt đầu bằng `test_p3e_`), KHÔNG đụng dữ liệu seed/e2e khác trên DB `ddc_control_tower_c`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('prismaAuthStore tren Postgres that (DB _c)', () => {
  // Import động: chỉ chạm `@/server/db` (kết nối Prisma thật) khi có DATABASE_URL, để file này
  // không làm hỏng các lần `npm test` bình thường (không DATABASE_URL) dù không bị skip sớm.
  let prisma: typeof import('@/server/db').prisma;
  let prismaAuthStore: typeof import('./prisma-repo-auth').prismaAuthStore;

  const EMAIL_A = 'test-p3e-real-db-a@daidung.com.vn';
  const EMAIL_B = 'test-p3e-real-db-b@daidung.com.vn';
  const THROTTLE_KIND: 'login_fail_ip' = 'login_fail_ip';
  const THROTTLE_KEY_PREFIX = 'test-p3e-real-db-';

  beforeAll(async () => {
    ({ prisma } = await import('@/server/db'));
    ({ prismaAuthStore } = await import('./prisma-repo-auth'));
    await prisma.userRole.deleteMany({ where: { email: { in: [EMAIL_A, EMAIL_B] } } });
    // Chỉ xoá dòng auth_throttle DO CHÍNH FILE NÀY tạo (key có tiền tố riêng) - `login_fail_ip` là
    // kind THẬT dùng cho khoá đăng nhập, KHÔNG được xoá sạch (có thể có dòng thật của e2e khác).
    await prisma.authThrottle.deleteMany({ where: { kind: THROTTLE_KIND, key: { startsWith: THROTTLE_KEY_PREFIX } } });
    await prisma.userRole.create({
      data: { email: EMAIL_A, name: 'Test P3E A', passwordHash: 'x', role: 'viewer', canViewFinance: false, isActive: true },
    });
    await prisma.userRole.create({
      data: { email: EMAIL_B, name: 'Test P3E B', passwordHash: 'x', role: 'viewer', canViewFinance: false, isActive: true },
    });
  });

  afterAll(async () => {
    await prisma.passwordResetToken.deleteMany({ where: { email: { in: [EMAIL_A, EMAIL_B] } } });
    await prisma.authThrottle.deleteMany({ where: { kind: THROTTLE_KIND, key: { startsWith: THROTTLE_KEY_PREFIX } } });
    await prisma.userRole.deleteMany({ where: { email: { in: [EMAIL_A, EMAIL_B] } } });
    await prisma.$disconnect();
  });

  it('N2 - 30 loi goi reserveThrottle cung kind:key song song, limit=20 -> dung 20 id, 10 null', async () => {
    const now = new Date().toISOString();
    const since = new Date(Date.now() - 60_000).toISOString();
    const key = `${THROTTLE_KEY_PREFIX}khoa-30`;
    const results = await Promise.all(
      Array.from({ length: 30 }, () => prismaAuthStore.reserveThrottle(THROTTLE_KIND, key, now, since, 20)),
    );
    const ok = results.filter((r) => r !== null);
    const blocked = results.filter((r) => r === null);
    expect(ok).toHaveLength(20);
    expect(blocked).toHaveLength(10);
    // Khong id nao trung nhau (khong dem 2 lan cung 1 dong).
    expect(new Set(ok).size).toBe(20);
  });

  it('N2 - releaseThrottle(id) chi xoa DUNG 1 dong dung id, du co 2 dong trung createdAt', async () => {
    const key = `${THROTTLE_KEY_PREFIX}trung-mili-giay`;
    const sameCreatedAt = new Date('2026-09-28T01:00:00.000Z');
    const rowA = await prisma.authThrottle.create({ data: { kind: THROTTLE_KIND, key, createdAt: sameCreatedAt } });
    const rowB = await prisma.authThrottle.create({ data: { kind: THROTTLE_KIND, key, createdAt: sameCreatedAt } });

    await prismaAuthStore.releaseThrottle(rowA.id);

    const remaining = await prisma.authThrottle.findMany({ where: { kind: THROTTLE_KIND, key } });
    expect(remaining.map((r) => r.id)).toEqual([rowB.id]);
    await prisma.authThrottle.deleteMany({ where: { id: rowB.id } });
  });

  it('L3 - resetFailedLogin tra false khi tai khoan da bi khoa boi 1 request khac', async () => {
    const nowIso = new Date().toISOString();
    await prismaAuthStore.registerFailedLogin(EMAIL_A, 1, nowIso); // khoa ngay lan sai dau (threshold=1)
    const confirmed = await prismaAuthStore.resetFailedLogin(EMAIL_A);
    expect(confirmed).toBe(false);
    const state = await prismaAuthStore.getAccountState(EMAIL_A);
    expect(state?.lockedAt).not.toBeNull();
    await prismaAuthStore.unlockAccount(EMAIL_A);
  });

  it('5 loi goi registerFailedLogin dong thoi cung email dat nguong khoa -> justLocked dung true o DUY NHAT 1 loi goi', async () => {
    await prismaAuthStore.unlockAccount(EMAIL_B);
    const nowIso = new Date().toISOString();
    const results = await Promise.all(Array.from({ length: 5 }, () => prismaAuthStore.registerFailedLogin(EMAIL_B, 5, nowIso)));
    const justLockedCount = results.filter((r) => r?.justLocked).length;
    expect(justLockedCount).toBe(1);
    // Postgres tang failedLoginCount NGUYEN TU tung dong 1: chi loi goi nao nhan dung count=5 (hoac
    // hon) moi thay locked=true NGAY LUC DO; 4 loi goi con lai nhan count 1..4 (< threshold) nen dung
    // dan bao locked=false o thoi diem CHINH NO tra ve - trang thai CUOI CUNG cua tai khoan moi la noi
    // chac chan da bi khoa (kiem qua getAccountState, khong dua vao ket qua tung loi goi rieng le).
    const state = await prismaAuthStore.getAccountState(EMAIL_B);
    expect(state?.lockedAt).not.toBeNull();
    expect(state?.failedLoginCount).toBe(5);
    await prismaAuthStore.unlockAccount(EMAIL_B);
  });

  it('R3-1 - 2 loi goi setPasswordIfHash song song cung oldHash -> dung 1 cai thang, hash cuoi la cua ben thang', async () => {
    await prisma.userRole.update({ where: { email: EMAIL_A }, data: { passwordHash: 'hash-cas-cu' } });
    const nowIso = new Date().toISOString();
    const [r1, r2] = await Promise.all([
      prismaAuthStore.setPasswordIfHash(EMAIL_A, 'hash-cas-cu', 'hash-cas-1', nowIso),
      prismaAuthStore.setPasswordIfHash(EMAIL_A, 'hash-cas-cu', 'hash-cas-2', nowIso),
    ]);
    expect([r1, r2].filter(Boolean)).toHaveLength(1);
    const state = await prismaAuthStore.getAccountState(EMAIL_A);
    expect(state?.passwordHash).toBe(r1 ? 'hash-cas-1' : 'hash-cas-2');
    expect(state?.passwordChangedAt).not.toBeNull();
    // oldHash sai -> khong ghi gi
    expect(await prismaAuthStore.setPasswordIfHash(EMAIL_A, 'hash-cas-cu', 'hash-cas-3', nowIso)).toBe(false);
    expect((await prismaAuthStore.getAccountState(EMAIL_A))?.passwordHash).toBe(state?.passwordHash);
  });

  it('R4-1a (bao-mat.md vong 4, Trung) - revokeSessions bump passwordChangedAt, KHONG doi passwordHash', async () => {
    await prisma.userRole.update({ where: { email: EMAIL_A }, data: { passwordHash: 'hash-truoc-revoke' } });
    const nowIso = new Date().toISOString();

    const ok = await prismaAuthStore.revokeSessions(EMAIL_A, nowIso);

    expect(ok).toBe(true);
    const state = await prismaAuthStore.getAccountState(EMAIL_A);
    expect(state?.passwordChangedAt).toBe(new Date(nowIso).toISOString());
    expect(state?.passwordHash).toBe('hash-truoc-revoke');
  });

  it('R4-1a - khong co tai khoan -> tra false', async () => {
    expect(await prismaAuthStore.revokeSessions('khong-ton-tai-p3e@daidung.com.vn', new Date().toISOString())).toBe(false);
  });

  it('R5-6 (bao-mat.md vong 5, Thap) - khong duoc keo lui: goi voi nowIso CU HON moc da co -> giu nguyen moc moi, van tra true', async () => {
    const newer = new Date(Date.now() + 60_000).toISOString();
    await prismaAuthStore.revokeSessions(EMAIL_A, newer);
    const older = new Date().toISOString();

    const ok = await prismaAuthStore.revokeSessions(EMAIL_A, older);

    expect(ok).toBe(true);
    const state = await prismaAuthStore.getAccountState(EMAIL_A);
    expect(state?.passwordChangedAt).toBe(new Date(newer).toISOString());
  });

  it('R5-1 (bao-mat.md vong 5, Thap) - 10 loi goi reserveAccountGuess dong thoi cung email, threshold=5 -> dung 5 id, 5 null', async () => {
    await prismaAuthStore.unlockAccount(EMAIL_B);
    await prisma.userRole.update({ where: { email: EMAIL_B }, data: { failedLoginCount: 0 } });
    const nowIso = new Date().toISOString();
    const since = new Date(Date.now() - 60_000).toISOString();

    const results = await Promise.all(
      Array.from({ length: 10 }, () => prismaAuthStore.reserveAccountGuess('login_fail_account', EMAIL_B, nowIso, since, 5)),
    );
    const ok = results.filter((r) => r !== null);
    const blocked = results.filter((r) => r === null);
    expect(ok).toHaveLength(5);
    expect(blocked).toHaveLength(5);
    expect(new Set(ok).size).toBe(5); // khong id nao trung nhau

    for (const id of ok) await prismaAuthStore.releaseThrottle(id as number);
  });

  it('R5-1 - tai khoan dang bi khoa -> reserveAccountGuess tra null ngay', async () => {
    await prismaAuthStore.registerFailedLogin(EMAIL_B, 1, new Date().toISOString()); // khoa ngay lan sai dau
    const nowIso = new Date().toISOString();
    const since = new Date(Date.now() - 60_000).toISOString();

    const id = await prismaAuthStore.reserveAccountGuess('login_fail_account', EMAIL_B, nowIso, since, 5);

    expect(id).toBeNull();
    await prismaAuthStore.unlockAccount(EMAIL_B);
  });

  it('R4-4 (bao-mat.md vong 4, Thap) - setPasswordIfHash tra false khi tai khoan da bi TAT (isActive=false) xen giua, du oldHash con khop', async () => {
    await prisma.userRole.update({ where: { email: EMAIL_A }, data: { passwordHash: 'hash-r4-4-active', isActive: false } });
    const nowIso = new Date().toISOString();

    const ok = await prismaAuthStore.setPasswordIfHash(EMAIL_A, 'hash-r4-4-active', 'hash-r4-4-moi', nowIso);

    expect(ok).toBe(false);
    const state = await prismaAuthStore.getAccountState(EMAIL_A);
    expect(state?.passwordHash).toBe('hash-r4-4-active');
    await prisma.userRole.update({ where: { email: EMAIL_A }, data: { isActive: true } });
  });

  it('R4-4 - setPasswordIfHash tra false khi tai khoan dang bi KHOA (lockedAt khac null), du oldHash con khop', async () => {
    await prisma.userRole.update({ where: { email: EMAIL_A }, data: { passwordHash: 'hash-r4-4-locked' } });
    await prismaAuthStore.registerFailedLogin(EMAIL_A, 1, new Date().toISOString()); // khoa ngay lan sai dau
    const nowIso = new Date().toISOString();

    const ok = await prismaAuthStore.setPasswordIfHash(EMAIL_A, 'hash-r4-4-locked', 'hash-r4-4-moi', nowIso);

    expect(ok).toBe(false);
    const state = await prismaAuthStore.getAccountState(EMAIL_A);
    expect(state?.passwordHash).toBe('hash-r4-4-locked');
    await prismaAuthStore.unlockAccount(EMAIL_A);
  });

  it('L5 - consumeResetToken tra { ok: false } khi tai khoan da chuyen sang chi-Google du token con han', async () => {
    const nowIso = new Date().toISOString();
    const expiresAtIso = new Date(Date.now() + 30 * 60_000).toISOString();
    await prismaAuthStore.replaceResetToken(EMAIL_A, 'hash-real-db-google-only', expiresAtIso, '1.2.3.4');
    // Tai khoan chuyen sang chi-Google SAU khi token da cap (passwordHash rong).
    await prisma.userRole.update({ where: { email: EMAIL_A }, data: { passwordHash: '' } });

    const result = await prismaAuthStore.consumeResetToken('hash-real-db-google-only', 'hash-moi', nowIso);
    expect(result).toEqual({ ok: false });

    // Token KHONG bi dot (usedAt van null) - dung hanh vi kho bo nho khi tai khoan khong hop le.
    const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: 'hash-real-db-google-only' } });
    expect(row?.usedAt).toBeNull();

    await prisma.userRole.update({ where: { email: EMAIL_A }, data: { passwordHash: 'x' } });
  });

  // Tester (soi lai ke hoach): 2 test them - chua co trong ban giao cua coder.
  it('L5 (them) - consumeResetToken tra { ok: false } khi tai khoan da bi tat (isActive=false) du token con han', async () => {
    const nowIso = new Date().toISOString();
    const expiresAtIso = new Date(Date.now() + 30 * 60_000).toISOString();
    await prismaAuthStore.replaceResetToken(EMAIL_A, 'hash-real-db-inactive', expiresAtIso, '1.2.3.4');
    await prisma.userRole.update({ where: { email: EMAIL_A }, data: { isActive: false } });

    const result = await prismaAuthStore.consumeResetToken('hash-real-db-inactive', 'hash-moi', nowIso);
    expect(result).toEqual({ ok: false });

    const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: 'hash-real-db-inactive' } });
    expect(row?.usedAt).toBeNull();

    await prisma.userRole.update({ where: { email: EMAIL_A }, data: { isActive: true } });
  });

  it('K4 (them) - consumeResetToken: 2 request dong thoi CUNG 1 token, chi 1 cai thang', async () => {
    const nowIso = new Date().toISOString();
    const expiresAtIso = new Date(Date.now() + 30 * 60_000).toISOString();
    await prismaAuthStore.replaceResetToken(EMAIL_B, 'hash-real-db-race', expiresAtIso, '1.2.3.4');

    const [r1, r2] = await Promise.all([
      prismaAuthStore.consumeResetToken('hash-real-db-race', 'hash-moi-1', nowIso),
      prismaAuthStore.consumeResetToken('hash-real-db-race', 'hash-moi-2', nowIso),
    ]);

    const wins = [r1, r2].filter((r) => r.ok);
    const loses = [r1, r2].filter((r) => !r.ok);
    expect(wins).toHaveLength(1);
    expect(loses).toHaveLength(1);

    const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: 'hash-real-db-race' } });
    expect(row?.usedAt).not.toBeNull();
  });
});

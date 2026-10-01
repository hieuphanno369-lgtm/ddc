# Kế hoạch: sửa lỗi đăng nhập đúng mật khẩu bị báo sai khi hệ thống chậm (Prisma P2028)

> Skill đã dùng khi lập kế hoạch: `writing-plans`.
> Coder làm lần lượt Task 1 rồi Task 2, mỗi bước có ô `- [ ]`.

**Mục tiêu:** giao dịch auth ngắn không bị Prisma huỷ khi máy chậm tạm thời, và khi đăng nhập thất bại do lỗi hệ thống thì màn đăng nhập báo "Hệ thống đang bận", không báo sai email/mật khẩu.

**Cách làm:** 1 hằng `AUTH_TX_OPTIONS` (maxWait 10s, timeout 20s) truyền vào mọi `prisma.$transaction(async tx => ...)` của auth và đăng ký.
`authorize` (next-auth) đổi nhánh lỗi hệ thống từ `return null` sang `throw new Error('system_busy')`, đúng cơ chế đang dùng cho `locked`/`ip_limited`.
`LoginForm` ánh xạ `res.error` qua 1 hàm thuần mới `loginErrorKey`.

**Công nghệ:** Next 15.5 app router, next-auth 4.24.15 (Credentials), Prisma 6.19, PostgreSQL 5433, next-intl, Vitest, Playwright.

**Gốc lỗi (đã tái hiện 2026-10-01):** `$transaction` interactive mặc định `timeout` 5000ms, `maxWait` 2000ms.
Event loop Node bị chặn hơn 5s giữa giao dịch (webpack dev dịch code trong cùng tiến trình) thì Prisma huỷ giao dịch, ném P2028.
`checkCredentials` ném lỗi, `authorize` bắt rồi `return null`, next-auth trả `CredentialsSignin`, màn hình báo sai email/mật khẩu.

## Ràng buộc chung

- Làm trong `D:\_project\DDC_Control_Tower-C`, nhánh `feature/c-dang-nhap-he-thong-ban`; không sửa file ở thư mục khác.
- File nóng được phép sửa: `src/i18n/messages/vi.json`, `src/i18n/messages/en.json` (đang giữ). Không đụng file nóng nào khác.
- Không dùng dấu gạch dài (em dash, en dash) ở bất kỳ đâu: code, comment, chuỗi i18n, commit.
- Comment trong `src/` viết tiếng Việt có dấu (theo `src/server/login-guard.ts`); tên test viết không dấu (theo `src/server/login-guard.test.ts`).
- Commit message tiếng Việt không dấu, cuối message có dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Sau mỗi commit cập nhật `D:\_project\DDC_dieu-phoi\phien-C.md` (commit cuối, bước kế tiếp, file nóng đang giữ).
- KHÔNG đổi: kiểu `CredentialResult`, thứ tự bước và logic của `checkCredentials` (`src/server/login-guard.ts`), advisory lock, R2, R5-1, R5-3, N2, L3, G2, K6, L1, L7.
- KHÔNG đổi giao diện: không thêm CSS, không thêm `loading.tsx`, thông báo mới hiện bằng đúng `<AuthNotice tone="error">` đang có.
- KHÔNG thêm biến môi trường, cờ, route hay tham số nào để "giả lập lỗi" trong code ứng dụng (không có cửa hậu ở production).
- Không sửa các `$transaction` ngoài 2 file `prisma-repo-auth.ts` và `prisma-repo-signup.ts`.

## Quyết định kỹ thuật (đã chốt trong kế hoạch, coder không đổi)

### Q1. Giá trị hạn giao dịch

`AUTH_TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 }`.
Lý do: lần chặn event loop đo được thật là khoảng 9,3s (GET /api/auth/providers 9334ms), 20s cho biên gấp khoảng 2 lần.
`maxWait` 10s cho trường hợp pool kết nối bận.
Giới hạn trên: giao dịch kẹt giữ advisory lock của đúng 1 cặp kind:key tối đa 20s, chỉ chặn các lượt cùng khoá đó (cùng IP hoặc cùng email), không chặn khoá khác.
Áp dụng cho cả 6 giao dịch trong `prisma-repo-auth.ts` (`setPassword`, `setPasswordIfHash`, `reserveAccountGuess`, `reserveThrottle`, `replaceResetToken`, `consumeResetToken`) và 2 giao dịch trong `prisma-repo-signup.ts` (`deleteDepartment`, `approveRequest`), vì cùng kiểu giao dịch ngắn và cùng nguy cơ.

### Q2. KHÔNG thử lại khi gặp P2028/P2024

Lý do 1: P2028 gồm cả lỗi phát sinh lúc COMMIT ("Transaction API error"), khi đó không biết chắc giao dịch đã ghi hay chưa.
Nếu đã ghi mà vẫn thử lại thì `reserveThrottle`/`reserveAccountGuess` tạo thêm 1 dòng giữ chỗ, dòng đầu mất `id` nên không bao giờ được rút: đếm trùng lượt IP hoặc giữ thừa 1 chỗ đoán của tài khoản, trái yêu cầu.
Lý do 2: gốc lỗi (hạn 5s quá ngắn) đã được sửa bằng Q1; khi hệ thống quá tải thật, thử lại chỉ làm người dùng chờ gấp đôi rồi vẫn lỗi.
Lý do 3: P2024 (hết chờ pool) chỉ xảy ra với truy vấn ngoài giao dịch, thử lại an toàn về lý thuyết nhưng không cần cho lỗi đang sửa (YAGNI); nếu xảy ra thì người dùng thấy "Hệ thống đang bận".
Ghi đúng 3 lý do này vào JSDoc của `AUTH_TX_OPTIONS`.

### Q3. Thông báo "hệ thống bận" đi qua next-auth thế nào

Cơ chế hiện có: `authorize` ném `new Error('locked')`, next-auth 4 chuyển `error.message` vào `?error=` của URL trả về, `signIn(..., { redirect: false })` đưa ra `res.error === 'locked'`.
Dùng đúng cơ chế đó với chuỗi cố định `'system_busy'` (hằng `LOGIN_SYSTEM_BUSY`).
`checkCredentials` giữ nguyên (vẫn ném lỗi lên); chỉ `authorize` đổi `return null` thành `throw new Error(LOGIN_SYSTEM_BUSY)` sau khi log.
Mọi lỗi ném ra (không phải `locked`/`ip_limited`) đều thành `system_busy`, kể cả lỗi không phải Prisma: đều là lỗi hệ thống, không phải sai mật khẩu.

### Q4. Phân tích oracle (không lộ email nào có tài khoản, không lộ chi tiết kỹ thuật)

1. Nội dung trả về client luôn là đúng chuỗi `system_busy`, giống hệt ở mọi bước và mọi nhánh; không mang `code`, `message`, tên bước hay tên bảng.
   Log server chỉ ghi `errorFields(e)` (tên lỗi, mã P20xx, stack), KHÔNG ghi `e.message` (có thể chứa chuỗi kết nối DB), giữ nguyên quy ước G5.
2. Các bước chạm DB TRƯỚC khi rẽ nhánh theo email đều không phụ thuộc email có tồn tại hay không: `reserveThrottle('login_fail_ip', ip)` (khoá theo IP) và `getAccountState(email)` (chạy cho mọi email).
   Lỗi DB chung (mất kết nối, pool cạn, máy chậm) rơi vào các bước này với xác suất như nhau cho email có thật và email lạ.
3. Sau khi rẽ nhánh, cả 2 phía đều có thao tác DB có thể lỗi: email lạ/chỉ Google/đang khoá chạy `recordThrottle` + `countThrottle`; tài khoản có mật khẩu chạy `reserveAccountGuess`, `registerFailedLogin`/`resetFailedLogin`, `releaseThrottle`.
   Nên "hệ thống bận" không phải tín hiệu chỉ có ở nhánh tài khoản tồn tại.
4. Rủi ro còn lại (ghi nhận, chấp nhận): chỉ nhánh tài khoản có mật khẩu dùng advisory lock theo email (`account_guess:<email>`).
   Kẻ tấn công muốn ép lock này chờ quá 20s phải dồn hàng nghìn yêu cầu đồng thời vào 1 email (mỗi lượt giữ lock vài mili giây), bị giới hạn IP 20 lượt/15 phút chặn; mức tranh chấp đó đã tạo sẵn tín hiệu thời gian phản hồi khác nhau ngay hôm nay, nên `system_busy` không thêm tín hiệu mới. Bản sửa còn giảm khả năng xảy ra (5s lên 20s).
5. `system_busy` không thay thế `locked`/`ip_limited`: 2 nhánh này vẫn trả trước như cũ (kiểm `e.message` trước khi đổi sang `system_busy`).
6. Lỗi xảy ra SAU khi giữ chỗ IP đã commit thì chỗ IP đó giữ nguyên (tính như 1 lượt sai): đây là hành vi hiện có (đóng an toàn), không đổi.
   Chỗ đoán theo tài khoản vẫn được rút trong `finally` của `checkCredentials` như cũ.

## Danh sách file

| Loại | Đường dẫn | Việc |
|---|---|---|
| Tạo | `src/server/repo/auth-tx.ts` | Hằng `AUTH_TX_OPTIONS` + JSDoc Q1, Q2 |
| Tạo | `src/server/repo/prisma-repo-auth-tx-real-db.test.ts` | Test DB thật (chạy tay) |
| Sửa | `src/server/repo/prisma-repo-auth.ts` (dòng 110, 130, 163, 187, 203, 236) | Truyền `AUTH_TX_OPTIONS` |
| Sửa | `src/server/repo/prisma-repo-signup.ts` (dòng 75, 141) | Truyền `AUTH_TX_OPTIONS` |
| Sửa | `src/server/repo/prisma-repo-auth.test.ts` | Thêm test 6 giao dịch dùng đúng hằng |
| Sửa | `src/server/repo/prisma-repo-signup-p2003.test.ts` | Mock chuyển tiếp tham số 2, thêm test 2 giao dịch dùng đúng hằng |
| Tạo | `src/lib/login-errors.ts` | `LOGIN_SYSTEM_BUSY`, `LoginErrorKey`, `loginErrorKey()` |
| Tạo | `src/lib/login-errors.test.ts` | Unit test `loginErrorKey` |
| Sửa | `src/lib/auth.ts` (dòng 117-124 khối `catch` của `authorize`) | Ném `LOGIN_SYSTEM_BUSY` thay `return null` |
| Sửa | `src/lib/auth-authorize.test.ts` | Thêm describe nhánh lỗi hệ thống |
| Sửa | `src/server/login-guard.test.ts` | Thêm describe test canh: lỗi store được ném lên, chỗ đoán vẫn được rút |
| Sửa | `src/components/auth/LoginForm.tsx` (dòng 47-58) | Dùng `loginErrorKey` |
| Sửa | `src/i18n/messages/vi.json`, `src/i18n/messages/en.json` | Nhóm mới `loginBusy` ở CUỐI file |
| Tạo | `src/i18n/messages-login-busy.test.ts` | vi/en cùng key, đúng chữ, không gạch dài |
| Tạo | `e2e/41-dang-nhap-he-thong-ban.spec.ts` | E2E màn đăng nhập báo "hệ thống bận" |

Quy ước copy từ:
- Test DB thật: `src/server/repo/prisma-repo-auth-real-db.test.ts` (`describe.skipIf(!hasDb)`, import động trong `beforeAll`, tiền tố dữ liệu test riêng, tự dọn).
- Mock Prisma trong unit test repo: `src/server/repo/prisma-repo-auth.test.ts` (`vi.hoisted` + `vi.mock('@/server/db')`).
- Test `authorize`: `src/lib/auth-authorize.test.ts` (kho bộ nhớ `createMemoryAuthStore`, `getAuthorize()`).
- Test i18n: `src/i18n/messages-p4.test.ts`.
- E2E có đọc DB: `e2e/22-quen-mat-khau.spec.ts` (PrismaClient với `resolveE2eTarget(loadE2eEnv()).databaseUrl`); IP giả qua `extraHTTPHeaders`: `e2e/21-khoa-tai-khoan.spec.ts`.

---

## Task 1: Giao dịch auth không bị huỷ khi máy chậm

**Interfaces:**
- Tạo ra: `export const AUTH_TX_OPTIONS: { readonly maxWait: 10000; readonly timeout: 20000 }` trong `src/server/repo/auth-tx.ts` (file KHÔNG import gì, để e2e import được).
- Task 2 (e2e) dùng `AUTH_TX_OPTIONS.timeout`.

- [ ] **Bước 1.1: Tạo `src/server/repo/auth-tx.ts`**

```ts
/**
 * Hạn dùng chung cho MỌI giao dịch interactive (`prisma.$transaction(async (tx) => ...)`) của auth và đăng ký
 * (`prisma-repo-auth.ts`, `prisma-repo-signup.ts`).
 * Mặc định Prisma (timeout 5000ms, maxWait 2000ms) quá ngắn: event loop Node bị chặn hơn 5s giữa giao dịch
 * (next dev dịch code ngay trong cùng tiến trình, máy thiếu RAM) làm Prisma huỷ giao dịch (P2028), đăng nhập
 * đúng mật khẩu bị báo sai. Lần chặn đo được thật khoảng 9,3s nên chọn timeout 20s (biên gấp khoảng 2 lần);
 * maxWait 10s cho lúc pool kết nối bận. Giao dịch kẹt chỉ giữ advisory lock của đúng 1 cặp kind:key tối đa 20s.
 *
 * KHÔNG thử lại khi gặp P2028/P2024:
 * 1. P2028 gồm cả lỗi lúc COMMIT, không biết chắc giao dịch đã ghi hay chưa; thử lại sau 1 lần đã ghi sẽ tạo
 *    thêm dòng giữ chỗ (`reserveThrottle`/`reserveAccountGuess`), dòng đầu mất `id` nên không bao giờ được rút
 *    (đếm trùng lượt).
 * 2. Gốc lỗi là hạn quá ngắn, đã sửa bằng hằng này; quá tải thật thì thử lại chỉ làm người dùng chờ gấp đôi.
 * 3. P2024 (hết chờ pool) chỉ ở truy vấn ngoài giao dịch, không thuộc lỗi đang sửa; nếu xảy ra người dùng
 *    thấy thông báo "Hệ thống đang bận" (`authorize` trong `src/lib/auth.ts`).
 */
export const AUTH_TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;
```

- [ ] **Bước 1.2: Viết test DB thật (đỏ) `src/server/repo/prisma-repo-auth-tx-real-db.test.ts`**

```ts
/**
 * Sửa lỗi P2028 (đăng nhập đúng mật khẩu bị báo sai khi máy chậm) - test DB THẬT cho hạn giao dịch auth
 * (`AUTH_TX_OPTIONS`, `auth-tx.ts`). Bỏ qua khi `npm test` thường (không có DATABASE_URL); chạy tay:
 *   $env:DATABASE_URL='postgresql://postgres:<mat-khau>@localhost:5433/ddc_control_tower_c?schema=public'
 *   npx vitest run src/server/repo/prisma-repo-auth-tx-real-db.test.ts
 * Tự tạo + tự dọn dữ liệu test (email `test-tx-real-db@daidung.com.vn`, key `test-tx-real-db-*`).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AUTH_TX_OPTIONS } from './auth-tx';

const hasDb = Boolean(process.env.DATABASE_URL);

/** Chặn event loop `ms` mili giây ngay sau khi giao dịch vừa bắt đầu (giống webpack dev dịch code trong cùng tiến trình). */
function blockEventLoopSoon(ms: number): void {
  setImmediate(() => {
    const t = Date.now();
    while (Date.now() - t < ms) {
      /* chặn event loop */
    }
  });
}

describe.skipIf(!hasDb)('giao dich auth khong bi huy khi may cham (P2028, DB _c)', () => {
  let prisma: typeof import('@/server/db').prisma;
  let prismaAuthStore: typeof import('./prisma-repo-auth').prismaAuthStore;

  const EMAIL = 'test-tx-real-db@daidung.com.vn';
  const KEY_PREFIX = 'test-tx-real-db-';

  async function cleanup(): Promise<void> {
    await prisma.authThrottle.deleteMany({
      where: { OR: [{ kind: 'login_fail_ip', key: { startsWith: KEY_PREFIX } }, { kind: 'account_guess', key: EMAIL }] },
    });
    await prisma.userRole.deleteMany({ where: { email: EMAIL } });
  }

  function windowIso(): { nowIso: string; sinceIso: string } {
    const now = new Date();
    return { nowIso: now.toISOString(), sinceIso: new Date(now.getTime() - 60_000).toISOString() };
  }

  /** Chờ tới khi advisory lock `login_fail_ip:<key>` đang bị giữ (thử khoá không chờ, thất bại = đang bị giữ). */
  async function waitUntilLockHeld(key: string): Promise<void> {
    for (let i = 0; i < 50; i++) {
      const rows = await prisma.$queryRaw<{ held: boolean }[]>`SELECT NOT pg_try_advisory_xact_lock(hashtext(${'login_fail_ip'} || ':' || ${key})) AS held`;
      if (rows[0]?.held) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('khong thay advisory lock bi giu sau 5s');
  }

  beforeAll(async () => {
    ({ prisma } = await import('@/server/db'));
    ({ prismaAuthStore } = await import('./prisma-repo-auth'));
    await cleanup();
    await prisma.userRole.create({
      data: { email: EMAIL, name: 'Test TX', passwordHash: 'x', role: 'viewer', canViewFinance: false, isActive: true },
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('reserveThrottle: event loop bi chan 6s giua giao dich -> van giu cho thanh cong (truoc sua: P2028)', async () => {
    const key = `${KEY_PREFIX}loop`;
    const { nowIso, sinceIso } = windowIso();
    const p = prismaAuthStore.reserveThrottle('login_fail_ip', key, nowIso, sinceIso, 100);
    blockEventLoopSoon(6000);
    expect(await p).not.toBeNull();
    expect(await prisma.authThrottle.count({ where: { kind: 'login_fail_ip', key } })).toBe(1);
  }, 30_000);

  it('reserveAccountGuess: event loop bi chan 6s giua giao dich -> van giu cho thanh cong (truoc sua: P2028)', async () => {
    const { nowIso, sinceIso } = windowIso();
    const p = prismaAuthStore.reserveAccountGuess(EMAIL, nowIso, sinceIso, 5);
    blockEventLoopSoon(6000);
    const id = await p;
    expect(id).not.toBeNull();
    await prismaAuthStore.releaseThrottle(id as number);
  }, 30_000);

  it('advisory lock bi giu lau hon AUTH_TX_OPTIONS.timeout -> reserveThrottle bao P2028 va KHONG de lai dong giu cho (co che e2e 41)', async () => {
    const key = `${KEY_PREFIX}lock`;
    const holdSeconds = AUTH_TX_OPTIONS.timeout / 1000 + 5;
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'login_fail_ip'} || ':' || ${key}))`;
        await tx.$executeRaw`SELECT pg_sleep(${holdSeconds}::float8)`;
      },
      { maxWait: 10_000, timeout: (holdSeconds + 30) * 1000 },
    );
    await waitUntilLockHeld(key);
    const { nowIso, sinceIso } = windowIso();
    await expect(prismaAuthStore.reserveThrottle('login_fail_ip', key, nowIso, sinceIso, 100)).rejects.toMatchObject({ code: 'P2028' });
    await holder;
    expect(await prisma.authThrottle.count({ where: { kind: 'login_fail_ip', key } })).toBe(0);
  }, 90_000);
});
```

- [ ] **Bước 1.3: Chạy test DB thật, xác nhận ĐỎ**

```powershell
$env:DATABASE_URL='postgresql://postgres:<mat-khau>@localhost:5433/ddc_control_tower_c?schema=public'
npx vitest run src/server/repo/prisma-repo-auth-tx-real-db.test.ts
```

Kỳ vọng: 2 test đầu FAIL với lỗi P2028 "Transaction already closed ... timeout for this transaction was 5000 ms".
Test thứ 3 PASS (cơ chế giữ lock gây P2028 đúng như e2e cần).
Nếu test thứ 3 không ra P2028 (mã khác, hoặc không lỗi): DỪNG, ghi mã lỗi thật vào `.bangiao/thay-doi.md` và báo lại, vì e2e ở Task 2 dựa vào cơ chế này.
Dán output vào `.bangiao/thay-doi.md` mục "Test đỏ trước sửa".

- [ ] **Bước 1.4: Viết unit test (đỏ) cho việc truyền hằng**

Trong `src/server/repo/prisma-repo-auth.test.ts`:
- Đổi mock `transaction` trong `vi.hoisted` thành `vi.fn(async (fn: (tx: unknown) => unknown, _opts?: unknown) => fn({ ...giữ nguyên object tx hiện có... }))`.
- Thêm `import { AUTH_TX_OPTIONS } from './auth-tx';` ngay dưới `import { prismaAuthStore } from './prisma-repo-auth';`.
- Thêm cuối file:

```ts
describe('AUTH_TX_OPTIONS - moi giao dich auth dung chung 1 han (sua loi P2028)', () => {
  const lastOpts = () => transaction.mock.calls.at(-1)?.[1];

  it('setPassword', async () => {
    await prismaAuthStore.setPassword('a@daidung.com.vn', 'h', true, NOW_ISO);
    expect(lastOpts()).toBe(AUTH_TX_OPTIONS);
  });
  it('setPasswordIfHash', async () => {
    await prismaAuthStore.setPasswordIfHash('a@daidung.com.vn', 'cu', 'moi', NOW_ISO);
    expect(lastOpts()).toBe(AUTH_TX_OPTIONS);
  });
  it('reserveAccountGuess', async () => {
    await prismaAuthStore.reserveAccountGuess('a@daidung.com.vn', NOW_ISO, NOW_ISO, 5);
    expect(lastOpts()).toBe(AUTH_TX_OPTIONS);
  });
  it('reserveThrottle', async () => {
    await prismaAuthStore.reserveThrottle('login_fail_ip', '1.2.3.4', NOW_ISO, NOW_ISO, 20);
    expect(lastOpts()).toBe(AUTH_TX_OPTIONS);
  });
  it('replaceResetToken', async () => {
    await prismaAuthStore.replaceResetToken('a@daidung.com.vn', 'th', '2026-09-28T00:30:00.000Z', '1.2.3.4');
    expect(lastOpts()).toBe(AUTH_TX_OPTIONS);
  });
  it('consumeResetToken', async () => {
    await prismaAuthStore.consumeResetToken('th', 'h', NOW_ISO);
    expect(lastOpts()).toBe(AUTH_TX_OPTIONS);
  });
});
```

Trong `src/server/repo/prisma-repo-signup-p2003.test.ts`:
- Thêm vào object `tx`: `signupRequest: { count: vi.fn(), delete: vi.fn() }` (giữ `count`), `userRole: { count: vi.fn(), create: vi.fn() }` (giữ `count`).
- Đổi `$transaction` thành `vi.fn(async (fn: (t: typeof tx) => unknown, _opts?: unknown) => fn(tx))` và mock thành `{ prisma: { $transaction: (fn: never, opts?: unknown) => $transaction(fn, opts) } }`.
- Thêm `import { AUTH_TX_OPTIONS } from './auth-tx';` và describe:

```ts
describe('AUTH_TX_OPTIONS - giao dich dang ky dung chung han voi auth (sua loi P2028)', () => {
  it('deleteDepartment', async () => {
    tx.department.count.mockResolvedValue(1);
    tx.userRole.count.mockResolvedValue(0);
    tx.signupRequest.count.mockResolvedValue(0);
    tx.department.delete.mockResolvedValue({});
    await prismaSignupStore.deleteDepartment(5);
    expect($transaction.mock.calls.at(-1)?.[1]).toBe(AUTH_TX_OPTIONS);
  });

  it('approveRequest', async () => {
    tx.signupRequest.delete.mockResolvedValue({ email: 'x@daidung.com.vn', name: 'X', departmentId: null, locale: 'vi' });
    tx.userRole.create.mockResolvedValue({});
    await prismaSignupStore.approveRequest(1, { passwordHash: 'h', role: 'viewer', canViewFinance: false });
    expect($transaction.mock.calls.at(-1)?.[1]).toBe(AUTH_TX_OPTIONS);
  });
});
```

Nếu kiểu tham số 2 của `approveRequest` khác `{ passwordHash, role, canViewFinance }` thì đọc `src/server/repo/signup-types.ts` và truyền đúng kiểu đó (chỉ cần hợp lệ, giá trị không quan trọng).

Chạy: `npx vitest run src/server/repo/prisma-repo-auth.test.ts src/server/repo/prisma-repo-signup-p2003.test.ts`.
Kỳ vọng: 8 test mới FAIL (`expected undefined to be ...`), test cũ vẫn PASS.

- [ ] **Bước 1.5: Sửa code**

`src/server/repo/prisma-repo-auth.ts`: thêm `import { AUTH_TX_OPTIONS } from './auth-tx';` sau dòng import `types`.
Ở cả 6 chỗ `prisma.$transaction(async (tx) => { ... })` (dòng 110, 130, 163, 187, 203, 236) thêm tham số thứ 2: `prisma.$transaction(async (tx) => { ... }, AUTH_TX_OPTIONS)`.
Không đổi gì khác bên trong thân giao dịch.

`src/server/repo/prisma-repo-signup.ts`: thêm `import { AUTH_TX_OPTIONS } from './auth-tx';`, thêm `AUTH_TX_OPTIONS` làm tham số thứ 2 ở 2 chỗ dòng 75 và 141.

- [ ] **Bước 1.6: Chạy lại, xác nhận XANH**

`npx vitest run src/server/repo/prisma-repo-auth.test.ts src/server/repo/prisma-repo-signup-p2003.test.ts`: PASS hết.
Chạy lại lệnh real-db ở Bước 1.3: cả 3 test PASS.
Chạy thêm test DB thật cũ để chắc không vỡ chống race: `npx vitest run src/server/repo/prisma-repo-auth-real-db.test.ts` (cùng `$env:DATABASE_URL`): PASS.
Dán output vào `.bangiao/thay-doi.md`.

- [ ] **Bước 1.7: Cổng kiểm + commit**

`npx tsc --noEmit` sạch, `npm test` xanh (mở PowerShell mới hoặc `Remove-Item Env:DATABASE_URL` trước, để test DB thật tự bỏ qua).

```
git add src/server/repo/auth-tx.ts src/server/repo/prisma-repo-auth-tx-real-db.test.ts src/server/repo/prisma-repo-auth.ts src/server/repo/prisma-repo-signup.ts src/server/repo/prisma-repo-auth.test.ts src/server/repo/prisma-repo-signup-p2003.test.ts .bangiao/thay-doi.md
git commit -m "fix(auth): giao dich auth dung chung han AUTH_TX_OPTIONS (timeout 20s, maxWait 10s), khong con bi huy P2028 khi may cham

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Màn đăng nhập báo "Hệ thống đang bận" khi lỗi hệ thống

**Interfaces:**
- Dùng từ Task 1: `AUTH_TX_OPTIONS.timeout` (e2e).
- Tạo ra trong `src/lib/login-errors.ts` (file KHÔNG import gì, dùng được cả server lẫn client):
  - `export const LOGIN_SYSTEM_BUSY = 'system_busy' as const;`
  - `export type LoginErrorKey = 'authSecurity.locked' | 'authSecurity.ipLimited' | 'loginBusy.systemBusy' | 'auth.invalidCredentials';`
  - `export function loginErrorKey(code: string): LoginErrorKey`
- Key i18n mới: `loginBusy.systemBusy`.

- [ ] **Bước 2.1: Viết e2e (đỏ) `e2e/41-dang-nhap-he-thong-ban.spec.ts`**

Giả lập lỗi hệ thống an toàn: spec tự mở 1 giao dịch trên DB e2e giữ advisory lock `login_fail_ip:203.0.113.91` lâu hơn `AUTH_TX_OPTIONS.timeout`.
Giao dịch giữ chỗ IP của app chờ lock quá hạn nên bị P2028 thật, đúng đường lỗi người dùng gặp.
Lock tự nhả khi giao dịch của spec kết thúc; khoá chỉ dành cho IP giả của spec này nên không ảnh hưởng spec khác; không có code giả lập nào trong app.

```ts
import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { AUTH_TX_OPTIONS } from '../src/server/repo/auth-tx';
import { E2E_LOCK_PASSWORD, loadE2eEnv, resolveE2eTarget } from './helpers/env';
import { vi } from './helpers/i18n';
import { fillLogin } from './helpers/login';

/**
 * Sửa lỗi P2028 - đăng nhập thất bại do lỗi hệ thống phải báo "Hệ thống đang bận", không báo sai email/mật khẩu.
 * Giả lập lỗi hệ thống THẬT, không cửa hậu trong app: giữ advisory lock `login_fail_ip:<IP giả>` (đúng khoá mà
 * `reserveThrottle` dùng) lâu hơn `AUTH_TX_OPTIONS.timeout`, giao dịch giữ chỗ IP của app bị Prisma huỷ (P2028).
 * IP giả RFC 5737 riêng cho spec này; lock tự nhả khi giao dịch của spec kết thúc.
 */
const { databaseUrl } = resolveE2eTarget(loadE2eEnv());
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const EMAIL = 'e2e-khoa@daidung.com.vn';
const FAKE_IP = '203.0.113.91';
const KIND = 'login_fail_ip';

async function waitUntilLockHeld(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    const rows = await prisma.$queryRaw<{ held: boolean }[]>`SELECT NOT pg_try_advisory_xact_lock(hashtext(${KIND} || ':' || ${FAKE_IP})) AS held`;
    if (rows[0]?.held) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('khong thay advisory lock bi giu sau 5s');
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe('41 - dang nhap khi he thong ban (sua loi P2028)', () => {
  test('loi he thong -> bao "he thong ban" (khong bao sai mat khau), khong tinh luot sai IP; het ban dang nhap lai duoc', async ({ browser }) => {
    const holdSeconds = AUTH_TX_OPTIONS.timeout / 1000 + 5;
    test.setTimeout((holdSeconds + 90) * 1000);

    const holder = prisma
      .$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${KIND} || ':' || ${FAKE_IP}))`;
          await tx.$executeRaw`SELECT pg_sleep(${holdSeconds}::float8)`;
        },
        { maxWait: 10_000, timeout: (holdSeconds + 30) * 1000 },
      )
      .then(
        () => 'ok',
        (e: unknown) => e,
      );
    await waitUntilLockHeld();

    const ctx = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: { 'x-forwarded-for': FAKE_IP },
    });
    const page = await ctx.newPage();

    // Đúng mật khẩu nhưng hệ thống lỗi.
    await fillLogin(page, EMAIL, E2E_LOCK_PASSWORD);
    await expect(page.getByText(vi('loginBusy.systemBusy'))).toBeVisible({ timeout: (holdSeconds + 30) * 1000 });
    await expect(page.getByText(vi('auth.invalidCredentials'))).toHaveCount(0);

    expect(await holder).toBe('ok');
    // Giao dịch giữ chỗ IP đã bị huỷ: không để lại dòng nào, không tính là 1 lượt sai.
    expect(await prisma.authThrottle.count({ where: { kind: KIND, key: FAKE_IP } })).toBe(0);

    // Hết bận: đăng nhập lại đúng mật khẩu vào được.
    await fillLogin(page, EMAIL, E2E_LOCK_PASSWORD);
    await page.waitForURL('**/vi/overview**');
    await ctx.close();
  });
});
```

Chạy (dev server C cổng 3003, DB `_c`, theo `.env`): `npx playwright test e2e/41-dang-nhap-he-thong-ban.spec.ts`.
Kỳ vọng ĐỎ: màn hình hiện `auth.invalidCredentials` thay vì thông báo bận (hoặc `vi('loginBusy.systemBusy')` báo thiếu key).
Dán output vào `.bangiao/thay-doi.md` mục "Test đỏ trước sửa".

- [ ] **Bước 2.2: Viết unit test (đỏ)**

`src/lib/login-errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LOGIN_SYSTEM_BUSY, loginErrorKey } from './login-errors';

describe('loginErrorKey - anh xa res.error cua next-auth sang key i18n', () => {
  it('locked / ip_limited giu nguyen nhu cu', () => {
    expect(loginErrorKey('locked')).toBe('authSecurity.locked');
    expect(loginErrorKey('ip_limited')).toBe('authSecurity.ipLimited');
  });
  it('system_busy -> loginBusy.systemBusy', () => {
    expect(LOGIN_SYSTEM_BUSY).toBe('system_busy');
    expect(loginErrorKey('system_busy')).toBe('loginBusy.systemBusy');
  });
  it('CredentialsSignin va chuoi la -> auth.invalidCredentials', () => {
    expect(loginErrorKey('CredentialsSignin')).toBe('auth.invalidCredentials');
    expect(loginErrorKey('bat-ky')).toBe('auth.invalidCredentials');
  });
});
```

`src/i18n/messages-login-busy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Sửa lỗi P2028: nhóm i18n riêng `loginBusy` ở cuối file, vi/en cùng key, đúng chữ đã chốt, không gạch dài. */
const read = (f: string) => JSON.parse(readFileSync(join(process.cwd(), 'src/i18n/messages', f), 'utf-8')) as Record<string, Record<string, string>>;
const vi = read('vi.json');
const en = read('en.json');

describe('i18n loginBusy', () => {
  it('vi/en cung tap key, dung chu', () => {
    expect(Object.keys(vi.loginBusy ?? {})).toEqual(['systemBusy']);
    expect(Object.keys(en.loginBusy ?? {})).toEqual(['systemBusy']);
    expect(vi.loginBusy.systemBusy).toBe('Hệ thống đang bận, vui lòng thử lại sau ít phút.');
    expect(en.loginBusy.systemBusy).toBe('The system is busy, please try again in a few minutes.');
  });
  it('khong co dau gach dai', () => {
    expect(JSON.stringify([vi.loginBusy, en.loginBusy])).not.toMatch(/[–—]/);
  });
  it('nhom loginBusy nam CUOI file (khong chen giua key co san)', () => {
    expect(Object.keys(vi).at(-1)).toBe('loginBusy');
    expect(Object.keys(en).at(-1)).toBe('loginBusy');
  });
});
```

`src/lib/auth-authorize.test.ts`: thêm `import { Prisma } from '@prisma/client';` và `import { logger } from '@/lib/logger';` ở đầu (cùng nhóm import tĩnh), rồi thêm cuối file:

```ts
describe('authorize - loi he thong (sua loi P2028)', () => {
  const p2028 = () =>
    new Prisma.PrismaClientKnownRequestError(
      'Transaction API error: Transaction already closed: postgresql://user:matkhau@db:5432/x',
      { code: 'P2028', clientVersion: '6.19.3' },
    );

  it('giu cho IP loi P2028 (dung mat khau) -> nem dung "system_busy", khong tra null', async () => {
    vi.spyOn(store, 'reserveThrottle').mockRejectedValueOnce(p2028());
    const authorize = getAuthorize();
    await expect(authorize({ email: 'a@daidung.com.vn', password: REAL_PW })).rejects.toThrowError(/^system_busy$/);
  });

  it('nhanh tai khoan co that: reserveAccountGuess loi -> "system_busy"', async () => {
    vi.spyOn(store, 'reserveAccountGuess').mockRejectedValueOnce(p2028());
    await expect(getAuthorize()({ email: 'a@daidung.com.vn', password: REAL_PW })).rejects.toThrowError(/^system_busy$/);
  });

  it('nhanh email la: recordThrottle loi -> CUNG "system_busy" (khong thanh oracle email nao co tai khoan)', async () => {
    vi.spyOn(store, 'recordThrottle').mockRejectedValueOnce(new Error('db down'));
    await expect(getAuthorize()({ email: 'khong-co@daidung.com.vn', password: 'bat-ky' })).rejects.toThrowError(/^system_busy$/);
  });

  it('log chi co ma loi, khong lo message (chuoi ket noi DB)', async () => {
    const spy = vi.spyOn(logger, 'error');
    vi.spyOn(store, 'getAccountState').mockRejectedValueOnce(p2028());
    await expect(getAuthorize()({ email: 'a@daidung.com.vn', password: REAL_PW })).rejects.toThrowError(/^system_busy$/);
    expect(spy).toHaveBeenCalledWith('auth.authorize_failed', expect.objectContaining({ errCode: 'P2028' }));
    expect(JSON.stringify(spy.mock.calls)).not.toContain('postgresql://');
    expect(JSON.stringify(spy.mock.calls)).not.toContain('Transaction already closed');
  });

  it('sai mat khau van tra null (khong bi doi thanh system_busy)', async () => {
    expect(await getAuthorize()({ email: 'a@daidung.com.vn', password: 'sai' })).toBeNull();
  });
});
```

Lưu ý: `afterEach(() => vi.clearAllMocks())` có sẵn không gỡ `spyOn`; thêm `vi.restoreAllMocks()` vào `afterEach` hiện có (thành `afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); })`).
`store` được tạo mới trong `beforeEach` nên spy trên store không rò sang test khác.

`src/server/login-guard.test.ts` (test canh, kỳ vọng XANH ngay vì `checkCredentials` không đổi; mục đích khoá hành vi "lỗi store được ném lên, không biến thành invalid, chỗ đoán vẫn được rút"): thêm cuối file:

```ts
describe('checkCredentials - loi he thong duoc nem len (sua loi P2028, khong doi hanh vi)', () => {
  it('reserveAccountGuess loi -> reject, KHONG goi registerFailedLogin', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    vi.spyOn(store, 'reserveAccountGuess').mockRejectedValueOnce(new Error('P2028 gia'));
    const reg = vi.spyOn(store, 'registerFailedLogin');
    await expect(checkCredentials(store, { email: 'a@daidung.com.vn', password: REAL_PW, ip: '1.1.1.1' }, T0)).rejects.toThrow('P2028 gia');
    expect(reg).not.toHaveBeenCalled();
  });

  it('registerFailedLogin loi (sai mat khau) -> reject, cho doan van duoc rut trong finally', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    vi.spyOn(store, 'registerFailedLogin').mockRejectedValueOnce(new Error('db down'));
    const release = vi.spyOn(store, 'releaseThrottle');
    await expect(checkCredentials(store, { email: 'a@daidung.com.vn', password: 'sai', ip: '1.1.1.2' }, T0)).rejects.toThrow('db down');
    expect(release).toHaveBeenCalledTimes(1);
  });
});
```

Nếu file này chưa gỡ spy giữa các test thì thêm `vi.restoreAllMocks()` vào `beforeEach` hiện có (sau `vi.clearAllMocks()`).

Chạy: `npx vitest run src/lib/login-errors.test.ts src/i18n/messages-login-busy.test.ts src/lib/auth-authorize.test.ts src/server/login-guard.test.ts`.
Kỳ vọng: `login-errors.test.ts` FAIL (chưa có module), `messages-login-busy.test.ts` FAIL, 4 test `system_busy` trong `auth-authorize.test.ts` FAIL (đang trả `null`), test "sai mat khau van tra null" và 2 test canh của `login-guard.test.ts` PASS.

- [ ] **Bước 2.3: Tạo `src/lib/login-errors.ts`**

```ts
/**
 * Mã lỗi đăng nhập đi qua next-auth (`authorize` ném `new Error(<mã>)`, next-auth đưa vào `res.error` của
 * `signIn(..., { redirect: false })`). File không import gì để dùng được cả server (`src/lib/auth.ts`) lẫn
 * client (`LoginForm.tsx`).
 * `system_busy`: lỗi hệ thống/DB (không phải sai mật khẩu, không phải `locked`/`ip_limited`). Chuỗi cố định,
 * giống hệt ở mọi bước và mọi nhánh, không mang chi tiết kỹ thuật (không thành oracle email nào có tài khoản).
 */
export const LOGIN_SYSTEM_BUSY = 'system_busy' as const;

export type LoginErrorKey = 'authSecurity.locked' | 'authSecurity.ipLimited' | 'loginBusy.systemBusy' | 'auth.invalidCredentials';

/** `res.error` của next-auth -> key i18n hiện trên màn đăng nhập; mã lạ (vd `CredentialsSignin`) là sai email/mật khẩu. */
export function loginErrorKey(code: string): LoginErrorKey {
  if (code === 'locked') return 'authSecurity.locked';
  if (code === 'ip_limited') return 'authSecurity.ipLimited';
  if (code === LOGIN_SYSTEM_BUSY) return 'loginBusy.systemBusy';
  return 'auth.invalidCredentials';
}
```

- [ ] **Bước 2.4: Sửa `src/lib/auth.ts`**

Thêm `import { LOGIN_SYSTEM_BUSY } from '@/lib/login-errors';` vào nhóm import `@/lib/...`.
Thay khối `catch` của `authorize` (dòng 117-124) bằng:

```ts
        } catch (e) {
          // G5 - `locked`/`ip_limited` PHẢI ném nguyên văn (next-auth cần đúng 2 chuỗi này ở `res.error`).
          // Sửa lỗi P2028 - lỗi khác (Prisma huỷ giao dịch, mất kết nối...) là lỗi HỆ THỐNG, không phải sai
          // mật khẩu: ném `LOGIN_SYSTEM_BUSY` để màn đăng nhập báo "Hệ thống đang bận" thay vì `CredentialsSignin`.
          // Chuỗi cố định, giống hệt ở mọi nhánh (không lộ email nào có tài khoản), KHÔNG mang `e.message`
          // (có thể chứa chuỗi kết nối DB); log chỉ ghi `errorFields(e)`.
          if (e instanceof Error && (e.message === 'locked' || e.message === 'ip_limited')) throw e;
          logger.error('auth.authorize_failed', errorFields(e));
          throw new Error(LOGIN_SYSTEM_BUSY);
        }
```

Không đổi gì khác trong `auth.ts`.

- [ ] **Bước 2.5: Thêm i18n (file nóng đang giữ)**

Cuối `src/i18n/messages/vi.json`, sau nhóm `"monthField"` (thêm dấu phẩy sau `}` của `monthField`):

```json
  "loginBusy": {
    "systemBusy": "Hệ thống đang bận, vui lòng thử lại sau ít phút."
  }
```

Cuối `src/i18n/messages/en.json`, cùng vị trí:

```json
  "loginBusy": {
    "systemBusy": "The system is busy, please try again in a few minutes."
  }
```

Giữ thụt lề 2 dấu cách như file hiện có; không sửa key nào khác.

- [ ] **Bước 2.6: Sửa `src/components/auth/LoginForm.tsx`**

Thêm `import { loginErrorKey } from '@/lib/login-errors';` sau dòng import `@/components/ui/motion`.
Thay đoạn trong `if (res?.error) { ... }` (dòng 48-57) bằng:

```tsx
      // Task 6 (D3) + sửa lỗi P2028 - `authorize` ném nguyên văn 'locked'/'ip_limited'/'system_busy' qua
      // `res.error`; còn lại (sai email/mật khẩu) hiện chung 1 thông báo. Ánh xạ ở `loginErrorKey`.
      setError(t(loginErrorKey(res.error)));
```

Giữ nguyên `setBusy(false)` và mọi phần JSX, class, `AuthNotice`.

- [ ] **Bước 2.7: Chạy lại, xác nhận XANH**

`npx vitest run src/lib/login-errors.test.ts src/i18n/messages-login-busy.test.ts src/lib/auth-authorize.test.ts src/server/login-guard.test.ts src/components/auth/LoginForm.test.ts src/lib/auth-credentials-google-only.test.ts`: PASS hết.
`npx playwright test e2e/41-dang-nhap-he-thong-ban.spec.ts`: PASS (thông báo bận hiện, không có thông báo sai mật khẩu, 0 dòng `login_fail_ip` cho IP giả, đăng nhập lại vào được `/vi/overview`).
Chụp màn hình thông báo bận ở 1440 và 390 (trong lúc chạy tay, không cần đưa vào spec), so với thông báo `auth.invalidCredentials` hiện có: cùng khung, màu, cỡ chữ, không vỡ dòng xấu ở 390; ghi nhận xét vào `.bangiao/thay-doi.md`.

- [ ] **Bước 2.8: Cổng kiểm + commit**

1. `npx tsc --noEmit`: sạch.
2. `npm test` (không có `DATABASE_URL` trong shell): xanh hết.
3. Test DB thật (có `$env:DATABASE_URL` trỏ `_c`): `npx vitest run src/server/repo/prisma-repo-auth-tx-real-db.test.ts src/server/repo/prisma-repo-auth-real-db.test.ts`: xanh.
4. E2E liên quan đăng nhập: `npx playwright test e2e/01-login.spec.ts e2e/21-khoa-tai-khoan.spec.ts e2e/23-doi-mat-khau.spec.ts e2e/24-r2-1-hoi-sinh-phien.spec.ts e2e/27-giao-dien-dang-nhap.spec.ts e2e/41-dang-nhap-he-thong-ban.spec.ts`: xanh.

Dán output từng lệnh vào `.bangiao/thay-doi.md`; lệnh nào đỏ thì ghi đỏ kèm output, không bỏ qua.

```
git add src/lib/login-errors.ts src/lib/login-errors.test.ts src/lib/auth.ts src/lib/auth-authorize.test.ts src/server/login-guard.test.ts src/components/auth/LoginForm.tsx src/i18n/messages/vi.json src/i18n/messages/en.json src/i18n/messages-login-busy.test.ts e2e/41-dang-nhap-he-thong-ban.spec.ts .bangiao/thay-doi.md
git commit -m "fix(auth): loi he thong khi dang nhap bao 'He thong dang ban' thay vi sai email/mat khau (system_busy qua next-auth), them e2e 41

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Sau commit: bỏ `vi.json`, `en.json` khỏi mục "Đang giữ" trong `D:\_project\DDC_dieu-phoi\phien-C.md`.

---

## Trường hợp biên bắt buộc

1. Sai mật khẩu vẫn trả `null` (`auth.invalidCredentials`), không bị đổi thành `system_busy`.
2. `locked` và `ip_limited` vẫn được ném nguyên văn, kiểm TRƯỚC khi đổi sang `system_busy`.
3. Lỗi ở nhánh email lạ và nhánh tài khoản có thật cho ra CÙNG chuỗi `system_busy` (test ở Bước 2.2).
4. `Error` gửi về next-auth chỉ có message `system_busy`; log không chứa `e.message` (test ở Bước 2.2).
5. Giao dịch giữ chỗ bị huỷ không để lại dòng `auth_throttle` (test real-db thứ 3 và e2e 41).
6. Lỗi sau khi đã giữ chỗ đoán theo tài khoản: chỗ đó vẫn được rút trong `finally` (test canh ở `login-guard.test.ts`).
7. Không thử lại giao dịch (Q2); không có nhánh code nào gọi lại `reserveThrottle`/`reserveAccountGuess` sau lỗi.
8. Các test DB thật cũ (N2, R5-1, R3-1, K4, TT-1, TT-2) vẫn xanh sau khi đổi hạn giao dịch.
9. `LoginForm` với `initialError = 'googleDenied'` giữ nguyên hành vi (test `LoginForm.test.ts` hiện có vẫn xanh).

## Ngoài phạm vi (không làm)

- Các `$transaction` ở `prisma-repo.ts`, `prisma-repo-form.ts`, `prisma-repo-entry.ts`, `prisma-repo-backfill.ts`.
- Màn Đổi mật khẩu (`ChangePasswordModal`, `changePasswordAction`): hưởng lợi từ hạn mới qua `reserveAccountGuess`/`setPasswordIfHash` nhưng không đổi thông báo lỗi ở đó.
- Thử lại tự động, loading.tsx, đổi CSS hay bố cục màn đăng nhập.

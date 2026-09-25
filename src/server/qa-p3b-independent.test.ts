/**
 * Test kiểm thử ĐỘC LẬP của Tester (không phải coder) cho P3B — N-3 gate số tiền + Q6 quyền tài
 * chính từng người. Không sửa code sản phẩm. Bổ sung các trường hợp KHÔNG có sẵn trong bộ test của
 * coder, và một trường hợp tái hiện lỗi thật đã tìm thấy khi kiểm thử sống (live QA qua Playwright
 * MCP, xem .bangiao/ket-qua-test.md mục "T-2").
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { CurrentUser } from '@/lib/session';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { repo } from '@/server/repo/mock-repo';
import { setUserRoleAction } from '@/server/actions';
import { setUserCanViewFinanceAction } from '@/server/actions-user-finance';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };
const dataEntry = (email: string): CurrentUser => ({ name: email, email, role: 'data-entry', canViewFinance: false });
const viewer = (email: string): CurrentUser => ({ name: email, email, role: 'viewer', canViewFinance: false });

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('finance-gate.ts - bien tai lieu ke-hoach.md khong co test rieng o coder', () => {
  it('nguoi dung thieu han field canViewFinance -> coi nhu false (khong throw)', async () => {
    const { maskProjectSummary } = await import('@/lib/finance-gate');
    const summary = {
      id: 1, code: 'X', name: 'Du an X', customer: 'A', team: 'B', type: 'C', priority: 'P0',
      status: 'active', onTrack: true, pctPlan: 0.5, pctActual: 0.5, spi: 1, cpi: 1,
      contractValue: 100, eac: 90, vac: 10,
    } as never;
    // canViewFinance truyen vao la gia tri da resolve tu session; test nay khang dinh ham khong
    // “ro ri” khi goi voi undefined ep ve boolean falsy (gia lap truong hop upstream quen ‘?? false’).
    const masked = maskProjectSummary(summary, Boolean(undefined));
    expect(masked.contractValue).toBeNull();
    expect(masked.eac).toBeNull();
    expect(masked.vac).toBeNull();
  });

  it('isMoneyAlert: alert R5 that (co tien "ty") duoc nhan dung, alert SPI thuong khong bi nham', async () => {
    const { isMoneyAlert } = await import('@/lib/finance-gate');
    expect(isMoneyAlert({ ruleCode: 'ar_overdue', ruleTriggered: 'Cong no qua han' })).toBe(true);
    expect(
      isMoneyAlert({ ruleCode: null, ruleTriggered: 'Công nợ quá hạn 104.6 tỷ = 6.0% giá trị HĐ' }),
    ).toBe(true);
    expect(isMoneyAlert({ ruleCode: 'spi_low', ruleTriggered: 'SPI < 0.9' })).toBe(false);
    // Duong chay that bai: mot alert KHONG phai R5 nhung co chu "ty" trong message (vd ghi chu ngau
    // nhien) khong duoc coi la money-alert chi vi message chua "ty" - chi ruleCode/ruleTriggered moi
    // duoc dung de phan loai (K khong dua vao noi dung message).
    expect(
      isMoneyAlert({ ruleCode: 'spi_low', ruleTriggered: 'SPI < 0.9' } as never),
    ).toBe(false);
  });
});

describe('SSRF (notify-url.ts) - doc lap voi notify-url.test.ts cua coder, them bien the', () => {
  it('octal-style va URL co khoang trang dau/cuoi van bi nhan dung IP noi bo', async () => {
    const { checkWebhookUrl } = await import('@/lib/notify-url');
    const NO_ALLOW = { allowHttp: false, allowHosts: [] };
    // '0177.0.0.1' la dang octal cua 127.0.0.1 - WHATWG URL host-parser chuan hoa ve dang so.
    const r1 = checkWebhookUrl('https://0177.0.0.1/x', NO_ALLOW);
    expect(r1.ok).toBe(false);
    // URL co khoang trang bao quanh van duoc trim truoc khi kiem tra.
    const r2 = checkWebhookUrl('   https://127.0.0.1/x   ', NO_ALLOW);
    expect(r2).toEqual({ ok: false, error: 'blocked_ip' });
  });

  it('scheme viet HOA (HTTPS) van duoc chap nhan nhu https thuong (URL chuan hoa scheme ve lowercase)', async () => {
    const { checkWebhookUrl } = await import('@/lib/notify-url');
    const res = checkWebhookUrl('HTTPS://hooks.slack.com/x', { allowHttp: false, allowHosts: [] });
    expect(res.ok).toBe(true);
  });
});

describe('webhook.ts - khong theo redirect, ghim IP da kiem (tiem lookup/request gia)', () => {
  it('redirect 3xx tra ve http_3xx, KHONG tu dong goi lai request toi Location moi', async () => {
    const { sendWebhook } = await import('@/server/notify/webhook');
    let callCount = 0;
    const fakeRequest = vi.fn((_opts: unknown, cb: (res: unknown) => void) => {
      callCount += 1;
      const handlers: Record<string, (arg?: unknown) => void> = {};
      const res = {
        statusCode: 301,
        headers: { location: 'https://attacker.invalid/steal' },
        resume: vi.fn(),
        on: vi.fn(),
      };
      queueMicrotask(() => cb(res));
      return {
        on: (evt: string, h: (arg?: unknown) => void) => {
          handlers[evt] = h;
        },
        write: vi.fn(),
        end: vi.fn(),
        destroy: vi.fn(),
      };
    });
    const fakeLookup = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]);
    const result = await sendWebhook('https://example.com/hook', '{}', {
      request: fakeRequest as never,
      lookup: fakeLookup,
    });
    expect(result).toEqual({ ok: false, error: 'http_301' });
    // Chi 1 request duy nhat - khong theo redirect sang host thu 2.
    expect(callCount).toBe(1);
    expect(fakeRequest).toHaveBeenCalledTimes(1);
  });

  it('DNS tra ve 2 dia chi (1 cong khai + 1 noi bo) -> blocked_ip, KHONG ket noi toi bat ky dia chi nao', async () => {
    const { sendWebhook } = await import('@/server/notify/webhook');
    const fakeRequest = vi.fn();
    const fakeLookup = vi.fn(async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);
    const result = await sendWebhook('https://mixed.example.com/hook', '{}', {
      request: fakeRequest as never,
      lookup: fakeLookup,
    });
    expect(result).toEqual({ ok: false, error: 'blocked_ip' });
    expect(fakeRequest).not.toHaveBeenCalled();
  });
});

describe('Q6 - phan quyen doi canViewFinance qua action (server action, khong phai UI)', () => {
  it('nguoi khong phai admin (bod) goi setUserCanViewFinanceAction -> Forbidden, KHONG doi duoc DB', async () => {
    login(BOD);
    const before = repo.getUserRoles().find((u) => u.email === 'pm@daidung.com.vn')?.canViewFinance;
    const res = await setUserCanViewFinanceAction('pm@daidung.com.vn', false);
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
    const after = repo.getUserRoles().find((u) => u.email === 'pm@daidung.com.vn')?.canViewFinance;
    expect(after).toBe(before);
  });

  it('chua dang nhap goi setUserCanViewFinanceAction -> Forbidden', async () => {
    login(null);
    const res = await setUserCanViewFinanceAction('pm@daidung.com.vn', false);
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('data-entry (chinh minh) khong tu bat duoc quyen tai chinh cua minh', async () => {
    login(dataEntry('pm@daidung.com.vn'));
    const res = await setUserCanViewFinanceAction('pm@daidung.com.vn', true);
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('admin tat quyen mot tai khoan khong ton tai -> Not found', async () => {
    login(ADMIN);
    const res = await setUserCanViewFinanceAction('khong-ton-tai@daidung.com.vn', false);
    expect(res).toEqual({ ok: false, error: 'Not found' });
  });

  /**
   * TAI HIEN LOI THAT (tim thay khi kiem thu song qua Playwright MCP - xem ket-qua-test.md muc T-2,
   * khop voi phan quyet cua security-reviewer o .bangiao/danh-gia-bao-mat.md muc "T-2"):
   *
   * Admin tat canViewFinance cho 1 tai khoan data-entry (dung dung tinh nang moi cua Q6). Sau do,
   * admin doi VAI TRO cua tai khoan do bang setUserRoleAction (mot action CO SAN tu truoc P3B, o
   * actions.ts:276-284, khong thuoc pham vi P3B) - vi du doi tu 'data-entry' sang 'bod' roi doi lai
   * ve 'data-entry' (hoac bat ky doi vai tro nao khac 'viewer'). setUserRoleAction goi
   * `repo.setUserRole(email, role, role !== 'viewer')` - THAM SO THU 3 GHI DE canViewFinance ve true
   * MOI KHI DOI VAI TRO, bat ke admin da tat quyen do truoc do qua Q6.
   *
   * Ky vong DUNG: doi vai tro (khong lien quan toi Q6) KHONG duoc am tham bat lai quyen xem tai
   * chinh da bi tat rieng. Test nay se THAT BAI voi code hien tai - do la bang chung cho Reviewer,
   * KHONG phai loi viet test sai.
   */
  it('[BIET LOI - T-2] doi vai tro KHONG duoc am tham bat lai canViewFinance da bi admin tat truoc do', async () => {
    login(ADMIN);
    const off = await setUserCanViewFinanceAction('pm@daidung.com.vn', false);
    expect(off).toEqual({ ok: true });
    expect(repo.getUserRoles().find((u) => u.email === 'pm@daidung.com.vn')?.canViewFinance).toBe(false);

    // Doi vai tro khong lien quan (bod -> data-entry se ep true; o day doi data-entry -> bod ->
    // data-entry, van la doi vai tro "khac viewer" nen se kich hoat T-2).
    await setUserRoleAction('pm@daidung.com.vn', 'bod');
    await setUserRoleAction('pm@daidung.com.vn', 'data-entry');

    const finalFlag = repo.getUserRoles().find((u) => u.email === 'pm@daidung.com.vn')?.canViewFinance;
    // Ky vong DUNG (theo tinh than Q6 - quyen tung nguoi doc lap voi vai tro): van la false.
    expect(finalFlag).toBe(false);
  });
});

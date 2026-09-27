import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import {
  deleteExchangeRateAction, fetchRatesNowAction, saveExchangeRateAction, saveFactoryAction, saveStageAction, setFactoryActiveAction,
  setStageActiveAction,
} from '@/server/actions-master';
import { stageOrder } from '@/lib/stages';
import { valueChainColumns } from '@/lib/value-chain-view';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const dataEntry = (email: string): CurrentUser => ({ name: email, email, role: 'data-entry', canViewFinance: false });
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('saveFactoryAction', () => {
  it('admin tao khu vuc moi -> ok', async () => {
    login(ADMIN);
    const res = await saveFactoryAction({ name: 'Nhà máy Cần Thơ', region: 'Miền Tây', capacityTonPerYear: 20000 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(repo.getDims().factories.find((f) => f.id === res.id)?.name).toBe('Nhà máy Cần Thơ');
  });

  it('admin sua khu vuc co san -> ok', async () => {
    login(ADMIN);
    const res = await saveFactoryAction({ id: 1, name: 'Nhà máy Đồng Nai 2', region: 'Miền Nam', capacityTonPerYear: 61000 });
    expect(res).toEqual({ ok: true, id: 1 });
    expect(repo.getDims().factories.find((f) => f.id === 1)?.name).toBe('Nhà máy Đồng Nai 2');
  });

  it('trung ten (khac hoa thuong) -> duplicate_name', async () => {
    login(ADMIN);
    const uniqueName = `Nhà máy kiểm thử ${Date.now()}`;
    const created = await saveFactoryAction({ name: uniqueName, region: '', capacityTonPerYear: 1000 });
    expect(created.ok).toBe(true);

    const res = await saveFactoryAction({ name: uniqueName.toUpperCase(), region: '', capacityTonPerYear: 500 });
    expect(res).toEqual({ ok: false, error: 'duplicate_name' });
  });

  it('capacity 0 -> Invalid input', async () => {
    login(ADMIN);
    const res = await saveFactoryAction({ name: 'X', region: '', capacityTonPerYear: 0 });
    expect(res).toEqual({ ok: false, error: 'Invalid input' });
  });

  it('data-entry, bod, viewer -> Forbidden', async () => {
    for (const u of [dataEntry('pm@daidung.com.vn'), BOD, VIEWER]) {
      login(u);
      const res = await saveFactoryAction({ name: 'X', region: '', capacityTonPerYear: 100 });
      expect(res).toEqual({ ok: false, error: 'Forbidden' });
    }
  });
});

describe('setFactoryActiveAction', () => {
  it('admin ngung dung roi dung lai -> ok', async () => {
    login(ADMIN);
    expect(await setFactoryActiveAction(1, false)).toEqual({ ok: true });
    expect(repo.getDims().factories.find((f) => f.id === 1)?.isActive).toBe(false);
    expect(await setFactoryActiveAction(1, true)).toEqual({ ok: true });
  });

  it('id khong ton tai -> Not found', async () => {
    login(ADMIN);
    const res = await setFactoryActiveAction(999999, false);
    expect(res).toEqual({ ok: false, error: 'Not found' });
  });

  it('data-entry -> Forbidden', async () => {
    login(dataEntry('pm@daidung.com.vn'));
    const res = await setFactoryActiveAction(1, false);
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });
});

describe('saveExchangeRateAction / deleteExchangeRateAction', () => {
  it('admin luu ty gia -> ok, source manual', async () => {
    login(ADMIN);
    const res = await saveExchangeRateAction('USD', '2026-09', 25500);
    expect(res).toEqual({ ok: true });
    const row = repo.getExchangeRates().find((r) => r.currencyCode === 'USD' && r.yearMonth === '2026-09');
    expect(row).toMatchObject({ rateToVnd: 25500, source: 'manual' });
  });

  it('admin xoa ty gia -> ok', async () => {
    login(ADMIN);
    await saveExchangeRateAction('EUR', '2026-09', 27000);
    const res = await deleteExchangeRateAction('EUR', '2026-09');
    expect(res).toEqual({ ok: true });
    expect(repo.getExchangeRates().find((r) => r.currencyCode === 'EUR' && r.yearMonth === '2026-09')).toBeUndefined();
  });

  it("thang '2026-10' (tuong lai so voi 2026-09-16) -> Invalid input", async () => {
    login(ADMIN);
    const res = await saveExchangeRateAction('USD', '2026-10', 25000);
    expect(res).toEqual({ ok: false, error: 'Invalid input' });
  });

  it('rate 0 -> Invalid input', async () => {
    login(ADMIN);
    const res = await saveExchangeRateAction('USD', '2026-09', 0);
    expect(res).toEqual({ ok: false, error: 'Invalid input' });
  });

  it('data-entry -> Forbidden', async () => {
    login(dataEntry('pm@daidung.com.vn'));
    expect(await saveExchangeRateAction('USD', '2026-09', 25000)).toEqual({ ok: false, error: 'Forbidden' });
    expect(await deleteExchangeRateAction('USD', '2026-09')).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('xoa thang khong co du lieu -> Not found', async () => {
    login(ADMIN);
    const res = await deleteExchangeRateAction('EUR', '2020-01');
    expect(res).toEqual({ ok: false, error: 'Not found' });
  });
});

describe('fetchRatesNowAction', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('admin bam Lay ngay - fetch ok -> status ok', async () => {
    login(ADMIN);
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      text: async () => '<ExrateList><Exrate CurrencyCode="USD" Transfer="25,140.00"/><Exrate CurrencyCode="EUR" Transfer="27,500.00"/></ExrateList>',
    }) as Response));
    const res = await fetchRatesNowAction();
    expect(res).toEqual({ ok: true, status: 'ok', detail: expect.any(String) });
  });

  it('admin bam Lay ngay - fetch loi mang -> status error', async () => {
    login(ADMIN);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNRESET'); }));
    const res = await fetchRatesNowAction();
    expect(res).toEqual({ ok: true, status: 'error', detail: expect.stringContaining('ECONNRESET') });
  });

  it('data-entry -> Forbidden', async () => {
    login(dataEntry('pm@daidung.com.vn'));
    expect(await fetchRatesNowAction()).toEqual({ ok: false, error: 'Forbidden' });
  });
});

/** P7-C2 Task 8: quản trị giai đoạn chuỗi giá trị - chỉ admin. */
describe('saveStageAction / setStageActiveAction', () => {
  const NEW_STAGE = { nameVi: 'Bảo hành', nameEn: 'Warranty', side: 'left' as const, sortOrder: 5, calcMode: 'manual' as const };

  it('data-entry, bod, viewer -> Forbidden, khong doi du lieu', async () => {
    const before = repo.getStages().length;
    for (const u of [dataEntry('pm@daidung.com.vn'), BOD, VIEWER]) {
      login(u);
      expect(await saveStageAction(NEW_STAGE)).toEqual({ ok: false, error: 'Forbidden' });
      expect(await setStageActiveAction('design', false)).toEqual({ ok: false, error: 'Forbidden' });
    }
    expect(repo.getStages()).toHaveLength(before);
    expect(repo.getStages().find((s) => s.code === 'design')?.isActive).toBe(true);
  });

  it('admin tao Bao hanh -> custom_1, moi du an co trong so custom_1 = 0 ap dung, audit create', async () => {
    login(ADMIN);
    const res = await saveStageAction(NEW_STAGE);
    expect(res).toEqual({ ok: true, code: 'custom_1' });
    const st = repo.getStages().find((s) => s.code === 'custom_1');
    expect(st).toMatchObject({ nameVi: 'Bảo hành', nameEn: 'Warranty', side: 'left', sortOrder: 5, calcMode: 'manual', isActive: true });
    for (const p of repo.listProjects()) {
      expect(repo.getStageWeights(p.id).find((w) => w.stageCode === 'custom_1')).toMatchObject({ weightPct: 0, applicable: true });
    }
    expect(repo.getAuditLog().some((a) => a.tableName === 'dim_stage' && a.recordId === 'custom_1' && a.field === 'create')).toBe(true);
  });

  it('trung ten (khac hoa thuong, co khoang trang) -> duplicate_name', async () => {
    login(ADMIN);
    expect(await saveStageAction({ ...NEW_STAGE, nameVi: '  thanh quyết toán ' })).toEqual({ ok: false, error: 'duplicate_name' });
  });

  it('sua settlement sang ben trai -> valueChainColumns dua sang cot trai, giu code/isActive', async () => {
    login(ADMIN);
    const s = repo.getStages().find((x) => x.code === 'settlement')!;
    const res = await saveStageAction({ code: 'settlement', nameVi: s.nameVi, nameEn: s.nameEn, side: 'left', sortOrder: s.sortOrder, calcMode: s.calcMode });
    expect(res).toEqual({ ok: true, code: 'settlement' });
    const [left, right] = valueChainColumns(repo.getStages());
    expect(left.map((x) => x.code)).toContain('settlement');
    expect(right.map((x) => x.code)).not.toContain('settlement');
    expect(repo.getStages().find((x) => x.code === 'settlement')?.isActive).toBe(true);
  });

  it('sua code khong ton tai -> Not found', async () => {
    login(ADMIN);
    expect(await saveStageAction({ ...NEW_STAGE, code: 'custom_99' })).toEqual({ ok: false, error: 'Not found' });
  });

  it('ngung dung fabrication (seed co 40%) -> in_use kem so du an', async () => {
    login(ADMIN);
    const count = repo.listProjects().filter((p) =>
      repo.getStageWeights(p.id).some((w) => w.stageCode === 'fabrication' && w.applicable && w.weightPct > 0)).length;
    expect(count).toBeGreaterThan(0);
    expect(await setStageActiveAction('fabrication', false)).toEqual({ ok: false, error: 'in_use', count });
    expect(repo.getStages().find((s) => s.code === 'fabrication')?.isActive).toBe(true);
  });

  it('ngung dung custom_1 (0% moi du an) -> ok, stageOrder khong con; dung lai -> co lai', async () => {
    login(ADMIN);
    await saveStageAction(NEW_STAGE);
    expect(await setStageActiveAction('custom_1', false)).toEqual({ ok: true });
    expect(stageOrder(repo.getStages())).not.toContain('custom_1');
    expect(await setStageActiveAction('custom_1', true)).toEqual({ ok: true });
    expect(stageOrder(repo.getStages())).toContain('custom_1');
  });

  it('setStageActive code khong ton tai -> Not found', async () => {
    login(ADMIN);
    expect(await setStageActiveAction('custom_99', false)).toEqual({ ok: false, error: 'Not found' });
  });

  it('nameVi rong / thu tu 0 / code Bad Code -> Invalid input', async () => {
    login(ADMIN);
    expect(await saveStageAction({ ...NEW_STAGE, nameVi: '   ' })).toEqual({ ok: false, error: 'Invalid input' });
    expect(await saveStageAction({ ...NEW_STAGE, sortOrder: 0 })).toEqual({ ok: false, error: 'Invalid input' });
    expect(await saveStageAction({ ...NEW_STAGE, code: 'Bad Code' })).toEqual({ ok: false, error: 'Invalid input' });
    expect(await setStageActiveAction('Bad Code', false)).toEqual({ ok: false, error: 'Invalid input' });
  });
});

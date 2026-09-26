import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';
import { DEFAULT_STAGE_WEIGHTS, LEGACY_STAGE_WEIGHTS } from '@/lib/stages';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import {
  changeProjectCodeAction, removeSapCodeAction, saveStageWeightsAction, updateProjectAction,
} from '@/server/actions-project';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const PM: CurrentUser = { name: 'PM', email: 'pm@daidung.com.vn', role: 'data-entry', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('updateProjectAction - quyen', () => {
  it('admin -> ok', async () => {
    login(ADMIN);
    expect(await updateProjectAction(1, { tonnage: 500 })).toEqual({ ok: true });
  });

  it('pm@ la PIC du an 1 -> ok', async () => {
    login(PM);
    expect(await updateProjectAction(1, { tonnage: 500 })).toEqual({ ok: true });
  });

  it('pm@ khong phai PIC/Backup du an 16 -> Forbidden', async () => {
    login(PM);
    expect(await updateProjectAction(16, { tonnage: 500 })).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('viewer -> Forbidden', async () => {
    login(VIEWER);
    expect(await updateProjectAction(1, { tonnage: 500 })).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('bod -> Forbidden', async () => {
    login(BOD);
    expect(await updateProjectAction(1, { tonnage: 500 })).toEqual({ ok: false, error: 'Forbidden' });
  });
});

describe('updateProjectAction - luat ho so', () => {
  beforeEach(() => login(ADMIN));

  it('xoa Ngay BD ke hoach (dat null) -> date_required', async () => {
    expect(await updateProjectAction(1, { plannedStartDate: null })).toEqual({ ok: false, error: 'date_required' });
  });

  it('ngay lech (BD >= HT ke hoach) -> date_plan_order', async () => {
    const res = await updateProjectAction(1, { plannedStartDate: '2027-01-01', plannedFinishDate: '2026-01-01' });
    expect(res).toEqual({ ok: false, error: 'date_plan_order' });
  });

  it('tonnage ve 0 -> tonnage_required', async () => {
    expect(await updateProjectAction(1, { tonnage: 0 })).toEqual({ ok: false, error: 'tonnage_required' });
  });

  it('ten 161 ky tu -> Invalid input', async () => {
    const res = await updateProjectAction(1, { projectName: 'A'.repeat(161) });
    expect(res).toEqual({ ok: false, error: 'Invalid input' });
  });

  it('USD + nguyen te + ngay ky thang 2026-09 (seed co rate 25400) -> contractValue bi ghi de', async () => {
    const res = await updateProjectAction(1, {
      currencyCode: 'USD', contractValueOriginal: 1_000, contractDate: '2026-09-01', plannedStartDate: '2026-09-01',
    });
    expect(res).toEqual({ ok: true });
    expect(repo.getProject(1)!.contractValue).toBe(0.0254);
  });

  it('ngay ky thang 2025-01 (khong co ty gia) -> fx_rate_missing', async () => {
    const res = await updateProjectAction(1, { currencyCode: 'USD', contractValueOriginal: 1_000, contractDate: '2025-01-15' });
    expect(res).toEqual({ ok: false, error: 'fx_rate_missing' });
  });

  it('patch co key la (masterCode) -> Invalid input (.strict())', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateProjectAction(1, { masterCode: 'X' } as any);
    expect(res).toEqual({ ok: false, error: 'Invalid input' });
  });
});

describe('changeProjectCodeAction', () => {
  it('quyen: admin ok, pm PIC du an 1 ok, pm du an 16 Forbidden, viewer/bod Forbidden', async () => {
    login(ADMIN);
    expect((await changeProjectCodeAction(1, 'CT-ADMIN-OK', 'ly do doi ma hop le')).ok).toBe(true);
    repo.reset();

    login(PM);
    expect((await changeProjectCodeAction(1, 'CT-PM-OK', 'ly do doi ma hop le')).ok).toBe(true);
    expect(await changeProjectCodeAction(16, 'CT-PM-16', 'ly do doi ma hop le')).toEqual({ ok: false, error: 'Forbidden' });

    login(VIEWER);
    expect(await changeProjectCodeAction(1, 'CT-VIEWER', 'ly do doi ma hop le')).toEqual({ ok: false, error: 'Forbidden' });
    login(BOD);
    expect(await changeProjectCodeAction(1, 'CT-BOD', 'ly do doi ma hop le')).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('ma cua du an khac -> code_taken', async () => {
    login(ADMIN);
    const p2 = repo.getProject(2)!;
    const res = await changeProjectCodeAction(1, p2.currentAliasCode, 'ly do doi ma hop le');
    expect(res).toEqual({ ok: false, error: 'code_taken' });
  });

  it('ly do 3 ky tu -> Invalid input', async () => {
    login(ADMIN);
    expect(await changeProjectCodeAction(1, 'CT-NEW', 'abc')).toEqual({ ok: false, error: 'Invalid input' });
  });

  it('S-2 (vong sua 1): go tay theo mau masterCode tu sinh (khong phai cua chinh du an) -> code_reserved', async () => {
    login(ADMIN);
    const res = await changeProjectCodeAction(1, 'M-00099', 'ly do doi ma hop le');
    expect(res).toEqual({ ok: false, error: 'code_reserved' });
  });

  it('S-2: doi ve dung masterCode cua chinh du an -> khong bi chan la code_reserved', async () => {
    login(ADMIN);
    const p1 = repo.getProject(1)!;
    const res = await changeProjectCodeAction(1, p1.masterCode, 'ly do doi ve ma goc');
    expect(res).not.toEqual({ ok: false, error: 'code_reserved' });
  });

  it('thanh cong -> getAliases(1) co dong moi tu 2026-09-17', async () => {
    login(ADMIN);
    const res = await changeProjectCodeAction(1, 'CT-THANH-CONG', 'ly do doi ma hop le');
    expect(res).toEqual({ ok: true });
    const rows = repo.getAliases(1);
    expect(rows.some((a) => a.aliasCode === 'CT-THANH-CONG' && a.effectiveFrom === '2026-09-17')).toBe(true);
  });
});

describe('saveStageWeightsAction', () => {
  it('quyen: admin ok, pm PIC du an 1 ok, pm du an 16 Forbidden, viewer/bod Forbidden', async () => {
    login(ADMIN);
    expect((await saveStageWeightsAction(1, LEGACY_STAGE_WEIGHTS)).ok).toBe(true);

    login(PM);
    expect((await saveStageWeightsAction(1, LEGACY_STAGE_WEIGHTS)).ok).toBe(true);
    expect(await saveStageWeightsAction(16, LEGACY_STAGE_WEIGHTS)).toEqual({ ok: false, error: 'Forbidden' });

    login(VIEWER);
    expect(await saveStageWeightsAction(1, LEGACY_STAGE_WEIGHTS)).toEqual({ ok: false, error: 'Forbidden' });
    login(BOD);
    expect(await saveStageWeightsAction(1, LEGACY_STAGE_WEIGHTS)).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('tong 99 -> weights_invalid', async () => {
    login(ADMIN);
    const rows = LEGACY_STAGE_WEIGHTS.map((r, i) => (i === 0 ? { ...r, weightPct: r.weightPct - 1 } : r));
    expect(await saveStageWeightsAction(1, rows)).toEqual({ ok: false, error: 'weights_invalid' });
  });

  it('tong 100 -> getStageWeights(1) dung so vua gui', async () => {
    login(ADMIN);
    const rows = LEGACY_STAGE_WEIGHTS.map((r) => (r.stageCode === 'fabrication' ? { ...r, weightPct: 41 } : r.stageCode === 'transport' ? { ...r, weightPct: 4 } : r));
    const res = await saveStageWeightsAction(1, rows);
    expect(res).toEqual({ ok: true });
    expect(repo.getStageWeights(1).find((w) => w.stageCode === 'fabrication')?.weightPct).toBe(41);
  });

  it("P7-C2 (K8): 7 dong (thieu settlement) -> 'stages_changed'", async () => {
    login(ADMIN);
    const rows7 = DEFAULT_STAGE_WEIGHTS.filter((r) => r.stageCode !== 'settlement');
    expect(await saveStageWeightsAction(1, rows7)).toEqual({ ok: false, error: 'stages_changed' });
  });

  it('P7-C2: 8 dong LEGACY -> ok; them Thanh quyet toan 2 bot Lap dung 2 -> ok', async () => {
    login(ADMIN);
    expect((await saveStageWeightsAction(1, LEGACY_STAGE_WEIGHTS)).ok).toBe(true);

    const rows = LEGACY_STAGE_WEIGHTS.map((r) => {
      if (r.stageCode === 'erection') return { ...r, weightPct: 25 };
      if (r.stageCode === 'settlement') return { ...r, weightPct: 2 };
      return r;
    });
    const res = await saveStageWeightsAction(1, rows);
    expect(res).toEqual({ ok: true });
    expect(repo.getStageWeights(1).find((w) => w.stageCode === 'settlement')?.weightPct).toBe(2);
  });
});

describe('removeSapCodeAction', () => {
  it('quyen: admin ok, pm PIC du an 11 ok, pm du an 16 Forbidden, viewer/bod Forbidden', async () => {
    login(ADMIN);
    const sap11 = repo.getSapCodes(11)[0];
    expect((await removeSapCodeAction(11, sap11.id)).ok).toBe(true);
    repo.reset();

    login(PM);
    const sap11b = repo.getSapCodes(11)[0];
    expect((await removeSapCodeAction(11, sap11b.id)).ok).toBe(true);
    expect(await removeSapCodeAction(16, repo.getSapCodes(16)[0].id)).toEqual({ ok: false, error: 'Forbidden' });

    login(VIEWER);
    expect(await removeSapCodeAction(11, repo.getSapCodes(11)[0]?.id ?? 1)).toEqual({ ok: false, error: 'Forbidden' });
    login(BOD);
    expect(await removeSapCodeAction(11, repo.getSapCodes(11)[0]?.id ?? 1)).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('id SAP thuoc du an khac -> Not found', async () => {
    login(ADMIN);
    const sapOf16 = repo.getSapCodes(16)[0];
    expect(await removeSapCodeAction(11, sapOf16.id)).toEqual({ ok: false, error: 'Not found' });
  });
});

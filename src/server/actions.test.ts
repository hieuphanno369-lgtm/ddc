import { afterAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { repo } from '@/server/repo/mock-repo';
import { UPLOAD_ROOT, savePhotoFile } from '@/lib/uploads';
import type { CurrentUser } from '@/lib/session';

/**
 * Mục 6 - quyền upload/xóa ảnh hiện trường.
 * Session + repo + cache được mock để test tầng action như một đơn vị hành vi:
 * action phải từ chối trước khi chạm filesystem/DB khi không đủ quyền.
 */
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { addPhotoAction, deletePhotoAction, saveMonthlyData } from '@/server/actions';

const YM = '2026-09';
const PID_PIC = 1; // pm@daidung.com.vn là PIC
const PID_OTHER = 4; // admin@daidung.com.vn là PIC - pm@daidung.com.vn KHÔNG phải PIC

const dataEntry = (email: string): CurrentUser => ({ name: email, email, role: 'data-entry', canViewFinance: false });
const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };

const png = (name = 'hien-truong.png') => new File([Buffer.from([0x89, 0x50, 0x4e, 0x47])], name, { type: 'image/png' });

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

function uploadForm(projectId: number, file: File | null, over: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set('projectId', String(projectId));
  fd.set('yearMonth', YM);
  fd.set('caption', '');
  if (file) fd.set('file', file);
  for (const [k, v] of Object.entries(over)) fd.set(k, v);
  return fd;
}

/** Tạo 1 ảnh có file thật trên disk + record trong repo. */
async function seedPhoto(projectId: number, uploadedBy: string) {
  const rel = await savePhotoFile(projectId, YM, png(), 'png');
  const photo = repo.addPhoto(projectId, YM, rel, 'Ảnh kiểm thử', uploadedBy);
  return { photo, abs: path.join(UPLOAD_ROOT, rel) };
}

afterAll(() => {
  rmSync(path.join(UPLOAD_ROOT, String(PID_PIC)), { recursive: true, force: true });
  rmSync(path.join(UPLOAD_ROOT, String(PID_OTHER)), { recursive: true, force: true });
});

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('addPhotoAction', () => {
  it('PIC upload: ghi file vào data/uploads/<projectId>/<YYYY-MM>/ và tạo record DB', async () => {
    login(dataEntry('pm@daidung.com.vn'));

    const res = await addPhotoAction(uploadForm(PID_PIC, png()));

    expect(res.ok).toBe(true);
    const photo = repo.getPhotoById(res.id!);
    expect(photo).not.toBeNull();
    expect(photo!.url).toMatch(new RegExp(`^${PID_PIC}/${YM}/`));
    expect(photo!.uploadedBy).toBe('pm@daidung.com.vn');
    expect(existsSync(path.join(UPLOAD_ROOT, photo!.url))).toBe(true);
  });

  it('Admin upload được vào dự án không phải PIC của mình', async () => {
    login(ADMIN);
    const res = await addPhotoAction(uploadForm(PID_OTHER, png()));
    expect(res.ok).toBe(true);
  });

  it('chưa đăng nhập → Forbidden, không ghi file/record', async () => {
    login(null);
    const before = repo.getPhotos(PID_PIC).length;

    const res = await addPhotoAction(uploadForm(PID_PIC, png()));

    expect(res).toEqual({ ok: false, error: 'Forbidden' });
    expect(repo.getPhotos(PID_PIC).length).toBe(before);
  });

  it('data-entry KHÔNG phải PIC của dự án → Forbidden', async () => {
    login(dataEntry('pm@daidung.com.vn'));
    const before = repo.getPhotos(PID_OTHER).length;

    const res = await addPhotoAction(uploadForm(PID_OTHER, png()));

    expect(res).toEqual({ ok: false, error: 'Forbidden' });
    expect(repo.getPhotos(PID_OTHER).length).toBe(before);
  });

  it('viewer → Forbidden', async () => {
    login({ name: 'V', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false });
    const res = await addPhotoAction(uploadForm(PID_PIC, png()));
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('file không phải ảnh → từ chối', async () => {
    login(dataEntry('pm@daidung.com.vn'));
    const pdf = new File([Buffer.from('%PDF-1.4')], 'tai-lieu.pdf', { type: 'application/pdf' });

    const res = await addPhotoAction(uploadForm(PID_PIC, pdf));

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/ảnh/i);
  });

  it('file vượt 5MB → từ chối', async () => {
    login(dataEntry('pm@daidung.com.vn'));
    const huge = new File([Buffer.alloc(5 * 1024 * 1024 + 1)], 'to.png', { type: 'image/png' });

    const res = await addPhotoAction(uploadForm(PID_PIC, huge));

    expect(res.ok).toBe(false);
  });

  it('yearMonth sai định dạng → từ chối', async () => {
    login(dataEntry('pm@daidung.com.vn'));
    const res = await addPhotoAction(uploadForm(PID_PIC, png(), { yearMonth: '09-2026' }));
    expect(res.ok).toBe(false);
  });

  it('thiếu file → từ chối', async () => {
    login(dataEntry('pm@daidung.com.vn'));
    const res = await addPhotoAction(uploadForm(PID_PIC, null));
    expect(res.ok).toBe(false);
  });
});

describe('deletePhotoAction - ma trận quyền', () => {
  it('Admin xóa được ảnh của người khác - xóa CẢ file disk LẪN record DB', async () => {
    const { photo, abs } = await seedPhoto(PID_PIC, 'nguoi-khac@daidung.com.vn');
    expect(existsSync(abs)).toBe(true);
    login(ADMIN);

    const res = await deletePhotoAction(photo.id);

    expect(res).toEqual({ ok: true });
    expect(repo.getPhotoById(photo.id)).toBeNull();
    expect(existsSync(abs)).toBe(false);
  });

  it('người upload xóa được ảnh của chính mình', async () => {
    login(dataEntry('pm@daidung.com.vn'));
    const { photo, abs } = await seedPhoto(PID_PIC, 'pm@daidung.com.vn');

    const res = await deletePhotoAction(photo.id);

    expect(res).toEqual({ ok: true });
    expect(repo.getPhotoById(photo.id)).toBeNull();
    expect(existsSync(abs)).toBe(false);
  });

  it('data-entry LÀ PIC của dự án xóa được ảnh người khác upload', async () => {
    const { photo, abs } = await seedPhoto(PID_PIC, 'nguoi-khac@daidung.com.vn');
    login(dataEntry('pm@daidung.com.vn'));

    const res = await deletePhotoAction(photo.id);

    expect(res).toEqual({ ok: true });
    expect(repo.getPhotoById(photo.id)).toBeNull();
    expect(existsSync(abs)).toBe(false);
  });

  it('data-entry KHÁC PIC → Forbidden, giữ nguyên cả record lẫn file', async () => {
    const { photo, abs } = await seedPhoto(PID_OTHER, 'nguoi-khac@daidung.com.vn');
    login(dataEntry('pm@daidung.com.vn')); // PIC của dự án 4 là admin@..., không phải pm@daidung.com.vn

    const res = await deletePhotoAction(photo.id);

    expect(res).toEqual({ ok: false, error: 'Forbidden' });
    expect(repo.getPhotoById(photo.id)).not.toBeNull();
    expect(existsSync(abs)).toBe(true);
  });

  it('viewer → Forbidden, giữ nguyên record', async () => {
    const { photo } = await seedPhoto(PID_PIC, 'pm@daidung.com.vn');
    login({ name: 'V', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false });

    const res = await deletePhotoAction(photo.id);

    expect(res).toEqual({ ok: false, error: 'Forbidden' });
    expect(repo.getPhotoById(photo.id)).not.toBeNull();
  });

  it('chưa đăng nhập → Forbidden', async () => {
    const { photo } = await seedPhoto(PID_PIC, 'pm@daidung.com.vn');
    login(null);

    const res = await deletePhotoAction(photo.id);

    expect(res).toEqual({ ok: false, error: 'Forbidden' });
    expect(repo.getPhotoById(photo.id)).not.toBeNull();
  });

  it('ảnh không tồn tại → Not found', async () => {
    login(ADMIN);
    const res = await deletePhotoAction(999999);
    expect(res).toEqual({ ok: false, error: 'Not found' });
  });

  it('photoId không hợp lệ → từ chối, không crash', async () => {
    login(ADMIN);
    const res = await deletePhotoAction(0);
    expect(res.ok).toBe(false);
  });

  it('ảnh seed url rỗng (không có file vật lý) vẫn xóa được record, không lỗi', async () => {
    const seed = repo.getPhotos(PID_PIC).find((p) => p.url === '')!;
    login(ADMIN);

    const res = await deletePhotoAction(seed.id);

    expect(res).toEqual({ ok: true });
    expect(repo.getPhotoById(seed.id)).toBeNull();
  });
});

describe('saveMonthlyData - luu tao moi khi chua co dong fact/tai chinh', () => {
  it('du an moi chua co thang nao - luu duoc ca fact lan tai chinh', async () => {
    login(ADMIN);
    const created = repo.createProject({
      projectName: 'Du an test P1A', customerId: 1, teamKdId: 1, marketCode: 'TN',
      projectType: 'EPC', priority: 'P1', contractValue: 100,
    });
    const res = await saveMonthlyData(created.id, '2026-09', { pctPlan: 0.1, revenueCumulative: 3 });
    expect(res).toEqual({ ok: true });
    expect(repo.getLatestFact(created.id, '2026-09')).toBeDefined();
    expect(repo.getFinancial(created.id).find((f) => f.yearMonth === '2026-09')).toBeDefined();
  });

  it('du an khong ton tai -> Not found', async () => {
    login(ADMIN);
    const res = await saveMonthlyData(999999, '2026-09', { pctPlan: 0.1 });
    expect(res).toEqual({ ok: false, error: 'Not found' });
  });
});

describe('saveMonthlyData - T8 (Task 6, P2A): khu vuc san xuat + san luong', () => {
  it('PIC gui { factoryId: 2, volumeTonnage: 120 } du an 1 -> ok, ghi ca 2', async () => {
    login(dataEntry('pm@daidung.com.vn'));
    const res = await saveMonthlyData(1, YM, { factoryId: 2, volumeTonnage: 120 });
    expect(res).toEqual({ ok: true });
    expect(repo.getProject(1)!.factoryId).toBe(2);
    expect(repo.getVolumes(1, YM).find((v) => v.factoryId === 2)?.tonnageProcessed).toBe(120);
  });

  it('du an moi (factoryId null) chi gui volumeTonnage -> no_factory, khong ghi gi', async () => {
    login(ADMIN);
    const created = repo.createProject({
      projectName: 'Du an chua co khu vuc', customerId: 1, teamKdId: 1, marketCode: 'TN',
      projectType: 'EPC', priority: 'P1', contractValue: 100,
    });
    const before = repo.getFacts(created.id).length;
    const res = await saveMonthlyData(created.id, YM, { volumeTonnage: 50 });
    expect(res).toEqual({ ok: false, error: 'no_factory' });
    expect(repo.getFacts(created.id).length).toBe(before);
  });

  it('factory da ngung dung -> invalid_factory', async () => {
    login(ADMIN);
    repo.setFactoryActive(1, false, 'admin@daidung.com.vn');
    const res = await saveMonthlyData(1, YM, { factoryId: 1 });
    expect(res).toEqual({ ok: false, error: 'invalid_factory' });
  });
});

describe('saveMonthlyData - T11 (Task 8, P2A): engine canh bao', () => {
  it("lam SPI < 0.9 cho du an 3 (chua co alert SPI thang nay) -> co alert 'spi_low' moi", async () => {
    login(ADMIN);
    const before = repo.getAlerts().filter((a) => a.projectId === 3 && a.ruleCode === 'spi_low' && !a.closedAt);
    expect(before).toHaveLength(0);

    const weights = repo.getStageWeights(3);
    const chain = weights.map((w) => ({ stageCode: w.stageCode, pctComplete: 0.1, applicable: w.applicable }));
    const res = await saveMonthlyData(3, YM, { chain });

    expect(res).toEqual({ ok: true });
    const after = repo.getAlerts().filter((a) => a.projectId === 3 && a.ruleCode === 'spi_low' && !a.closedAt);
    expect(after).toHaveLength(1);
  });

  it('runAlertEngineSafe bi spy throw -> saveMonthlyData van { ok: true }', async () => {
    login(ADMIN);
    const spy = vi.spyOn(await import('@/server/alert-engine'), 'runAlertEngineSafe').mockRejectedValue(new Error('boom'));
    try {
      const res = await saveMonthlyData(1, YM, { ac: 10 });
      expect(res).toEqual({ ok: true });
    } finally {
      spy.mockRestore();
    }
  });
});

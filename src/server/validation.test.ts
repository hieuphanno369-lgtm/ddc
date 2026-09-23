import { describe, expect, it } from 'vitest';
import {
  PHOTO_MAX_BYTES,
  addPhotoSchema,
  createProjectSchema,
  deletePhotoSchema,
  photoFileSchema,
  saveKeyMilestonesSchema,
  saveMonthlyDataSchema,
} from './validation';
import { STAGE_ORDER } from '@/lib/stages';

describe('photoFileSchema - chặn file không phải ảnh / quá dung lượng (Mục 6)', () => {
  it('nhận file ảnh trong giới hạn', () => {
    const r = photoFileSchema.safeParse({ type: 'image/png', size: 1024 });
    expect(r.success).toBe(true);
  });

  it('nhận đúng mốc 5MB, chặn vượt 1 byte', () => {
    expect(photoFileSchema.safeParse({ type: 'image/jpeg', size: PHOTO_MAX_BYTES }).success).toBe(true);
    const over = photoFileSchema.safeParse({ type: 'image/jpeg', size: PHOTO_MAX_BYTES + 1 });
    expect(over.success).toBe(false);
  });

  it('chặn file không phải ảnh (pdf, zip, không có type)', () => {
    expect(photoFileSchema.safeParse({ type: 'application/pdf', size: 1024 }).success).toBe(false);
    expect(photoFileSchema.safeParse({ type: 'application/zip', size: 1024 }).success).toBe(false);
    expect(photoFileSchema.safeParse({ type: '', size: 1024 }).success).toBe(false);
  });

  it('chặn file rỗng (size 0)', () => {
    expect(photoFileSchema.safeParse({ type: 'image/png', size: 0 }).success).toBe(false);
  });
});

describe('addPhotoSchema (Mục 6)', () => {
  const ok = { projectId: 1, yearMonth: '2026-09', caption: '' };

  it('nhận payload hợp lệ (caption rỗng vì UI không nhập caption)', () => {
    expect(addPhotoSchema.safeParse(ok).success).toBe(true);
  });

  it.each(['2026-9', '09-2026', '2026/09', '', '2026-13-01'])('chặn yearMonth sai định dạng: %s', (ym) => {
    expect(addPhotoSchema.safeParse({ ...ok, yearMonth: ym }).success).toBe(false);
  });

  // N-7 (danh-gia.md, vòng 2): '2026-00'/'2026-99' KHỚP regex cũ /^\d{4}-\d{2}$/ (chỉ check
  // 2 chữ số bất kỳ, không check tháng 01-12 thật) - từng lọt qua đây, ghi 1 dòng vĩnh viễn vào
  // bảng append-only ở tháng không dropdown nào chọn được. Nay dùng chung isValidYearMonth().
  it.each(['2026-00', '2026-99', '9999-12'])('N-7: chặn yearMonth ĐÚNG format 2 chữ số nhưng SAI miền giá trị: %s', (ym) => {
    expect(addPhotoSchema.safeParse({ ...ok, yearMonth: ym }).success).toBe(false);
  });

  it('chặn caption dài quá 200 ký tự', () => {
    expect(addPhotoSchema.safeParse({ ...ok, caption: 'a'.repeat(200) }).success).toBe(true);
    expect(addPhotoSchema.safeParse({ ...ok, caption: 'a'.repeat(201) }).success).toBe(false);
  });

  it('chặn projectId không hợp lệ', () => {
    expect(addPhotoSchema.safeParse({ ...ok, projectId: 0 }).success).toBe(false);
    expect(addPhotoSchema.safeParse({ ...ok, projectId: -1 }).success).toBe(false);
    expect(addPhotoSchema.safeParse({ ...ok, projectId: 1.5 }).success).toBe(false);
  });
});

describe('deletePhotoSchema (Mục 6)', () => {
  it('nhận id nguyên dương, chặn 0 / số thực / chuỗi', () => {
    expect(deletePhotoSchema.safeParse({ photoId: 7 }).success).toBe(true);
    expect(deletePhotoSchema.safeParse({ photoId: 0 }).success).toBe(false);
    expect(deletePhotoSchema.safeParse({ photoId: 1.5 }).success).toBe(false);
    expect(deletePhotoSchema.safeParse({ photoId: '7' }).success).toBe(false);
  });
});

describe('Mục 5 - 4 trường ngày: chỉ còn gửi từ step "Hồ sơ dự án"', () => {
  const required = {
    projectName: 'Dự án kiểm thử',
    customerId: 1,
    teamKdId: 1,
    marketCode: 'TN' as const,
    projectType: 'EPC' as const,
    priority: 'P1' as const,
    contractValue: 1000,
  };

  it('createProjectSchema vẫn hợp lệ khi form tạo mới KHÔNG gửi 4 trường ngày', () => {
    const r = createProjectSchema.safeParse(required);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.contractDate).toBeUndefined();
      expect(r.data.plannedStartDate).toBeUndefined();
      expect(r.data.plannedFinishDate).toBeUndefined();
      expect(r.data.committedHandoverDate).toBeUndefined();
    }
  });

  it('saveMonthlyDataSchema step "Hồ sơ dự án" vẫn nhận đủ 4 trường ngày (null khi xoá trắng)', () => {
    const r = saveMonthlyDataSchema.safeParse({
      projectId: 1,
      month: '2026-09',
      patch: {
        contractDate: '2026-01-05',
        plannedStartDate: '2026-02-01',
        plannedFinishDate: null,
        committedHandoverDate: null,
      },
    });
    expect(r.success).toBe(true);
  });
});

describe('saveMonthlyDataSchema - chain 7 giai đoạn (thay ô nhập tay pctActual)', () => {
  const base = { projectId: 1, month: '2026-09' };
  // stageCode để dạng string để test được cả giá trị lạ 'kickoff'
  const chain7 = STAGE_ORDER.map((stageCode, i) => ({
    stageCode: String(stageCode),
    pctComplete: i / 10,
    applicable: true,
  }));
  const withFirst = (over: Record<string, unknown>) => chain7.map((c, i) => (i === 0 ? { ...c, ...over } : c));
  const parse = (chain: unknown) => saveMonthlyDataSchema.safeParse({ ...base, patch: { chain } });

  it('nhận chain đủ 7 giai đoạn, pctComplete trong [0, 1.5]', () => {
    const r = parse(chain7);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.patch.chain).toHaveLength(7);
  });

  it('chặn chain thiếu phần tử hoặc thừa phần tử (phải đúng 7)', () => {
    expect(parse(chain7.slice(0, 6)).success).toBe(false);
    expect(parse([...chain7, chain7[0]]).success).toBe(false);
  });

  it('chặn pctComplete vượt trần 1.5 - nhưng 1.5 đúng trần vẫn hợp lệ', () => {
    expect(parse(withFirst({ pctComplete: 1.5 })).success).toBe(true);
    expect(parse(withFirst({ pctComplete: 1.51 })).success).toBe(false);
    expect(parse(withFirst({ pctComplete: 2 })).success).toBe(false);
  });

  it('chặn pctComplete âm và chặn stageCode không thuộc 7 giai đoạn', () => {
    expect(parse(withFirst({ pctComplete: -0.1 })).success).toBe(false);
    expect(parse(withFirst({ stageCode: 'kickoff' })).success).toBe(false);
  });

  it('chặn 7 phần tử TRÙNG stageCode (đủ số lượng nhưng thiếu giai đoạn thật)', () => {
    const allDesign = STAGE_ORDER.map(() => ({ stageCode: 'design', pctComplete: 0.5, applicable: true }));
    expect(parse(allDesign).success).toBe(false);

    // 6 giai đoạn thật + 1 giai đoạn lặp → vẫn phải bị chặn
    const oneDuplicated = [...chain7.slice(0, 6), { ...chain7[0] }];
    expect(parse(oneDuplicated).success).toBe(false);
  });

  it('chặn khi có NHIỀU cặp trùng (7 phần tử chỉ 5 giai đoạn khác nhau)', () => {
    const pairDup = [chain7[0], chain7[0], chain7[1], chain7[1], chain7[2], chain7[3], chain7[4]];
    expect(pairDup).toHaveLength(7);
    expect(parse(pairDup).success).toBe(false);
  });

  it('đủ 7 stageCode KHÁC NHAU nhưng ĐẢO thứ tự vẫn hợp lệ (fix dùng refine distinct, không ép tuple thứ tự)', () => {
    const shuffled = [...chain7].reverse();
    expect(new Set(shuffled.map((c) => c.stageCode)).size).toBe(7);
    expect(parse(shuffled).success).toBe(true);
  });

  it('chặn phần tử thiếu applicable hoặc applicable không phải boolean', () => {
    expect(parse(withFirst({ applicable: undefined })).success).toBe(false);
    expect(parse(withFirst({ applicable: 'true' })).success).toBe(false);
  });

  it('pctActual KHÔNG còn được schema nhận (server tự suy từ chain, không tin client)', () => {
    const r = saveMonthlyDataSchema.safeParse({ ...base, patch: { pctActual: 0.9 } });
    expect(r.success).toBe(true);
    if (r.success) expect('pctActual' in r.data.patch).toBe(false);
  });
});

describe('saveKeyMilestonesSchema', () => {
  const ok = { name: 'Mốc A', plannedDate: '2026-09-20', actualDate: null };
  it('hop le + trim ten', () => {
    const r = saveKeyMilestonesSchema.safeParse({ projectId: 1, rows: [{ ...ok, name: '  Mốc A ' }] });
    expect(r.success && r.data.rows[0].name).toBe('Mốc A');
  });
  it('mang rong hop le (xoa het moc)', () => expect(saveKeyMilestonesSchema.safeParse({ projectId: 1, rows: [] }).success).toBe(true));
  it.each([
    ['ten rong', { ...ok, name: '   ' }],
    ['ten 161 ky tu', { ...ok, name: 'x'.repeat(161) }],
    ['thieu ngay KH', { ...ok, plannedDate: '' }],
    ['ngay KH khong ton tai', { ...ok, plannedDate: '2026-02-30' }],
    ['ngay TT sai dinh dang', { ...ok, actualDate: '20/09/2026' }],
  ])('tu choi: %s', (_, row) => expect(saveKeyMilestonesSchema.safeParse({ projectId: 1, rows: [row] }).success).toBe(false));
  it('tu choi > 50 dong', () => expect(saveKeyMilestonesSchema.safeParse({ projectId: 1, rows: Array(51).fill(ok) }).success).toBe(false));
  it('createProjectSchema nhan keyMilestones tuy chon', () => {
    const base = { projectName: 'X', customerId: 1, teamKdId: 1, marketCode: 'TN', projectType: 'EPC', priority: 'P1', contractValue: 1 };
    expect(createProjectSchema.safeParse(base).success).toBe(true);
    expect(createProjectSchema.safeParse({ ...base, keyMilestones: [ok] }).success).toBe(true);
    expect(createProjectSchema.safeParse({ ...base, keyMilestones: [{ ...ok, name: '' }] }).success).toBe(false);
  });
});

import { DEFAULT_STAGE_WEIGHTS, SEED_STAGE_CODES, fillWeightsForStages } from '@/lib/stages';
import type { ProjectType, StageCode, StageWeightInput } from '@/server/repo/types';

/**
 * G-6 (Q1, ĐÃ CHỐT 2026-09-25) / P7-C2 (Q3a): bộ trọng số các giai đoạn mặc định theo loại dự án -
 * điền sẵn khi TẠO dự án mới (mục 5 form). Cột theo `SEED_STAGE_CODES`:
 * design·shop·procurement·fabrication·transport·erection·handover·settlement. Mỗi bộ cũ (7 số)
 * thêm Thanh quyết toán 2, lấy 2 từ Lắp dựng (giống bộ mặc định).
 * `Khac` = `DEFAULT_STAGE_WEIGHTS` hiện tại (giữ nguyên hành vi cũ khi không chọn loại cụ thể).
 */
export const STAGE_WEIGHT_PRESETS: Record<ProjectType, StageWeightInput[]> = {
  EPC: build([8, 10, 15, 32, 5, 25, 3, 2]),
  San_bay: build([4, 8, 8, 42, 5, 28, 3, 2]),
  San_van_dong: build([5, 10, 8, 38, 6, 28, 3, 2]),
  Nha_xuong: build([3, 7, 20, 38, 5, 22, 3, 2]),
  Cau_cang: build([5, 10, 10, 38, 10, 22, 3, 2]),
  Cao_tang: build([5, 12, 10, 35, 5, 28, 3, 2]),
  Dong_tau: build([8, 12, 15, 45, 2, 13, 3, 2]),
  Cau_giao_thong: build([6, 10, 10, 37, 8, 24, 3, 2]),
  Khac: DEFAULT_STAGE_WEIGHTS.map((w) => ({ ...w })),
};

function build(pcts: number[]): StageWeightInput[] {
  return SEED_STAGE_CODES.map((code, i) => ({ stageCode: code, weightPct: pcts[i], applicable: true }));
}

/**
 * '' (chưa chọn loại) → `DEFAULT_STAGE_WEIGHTS`, khớp hành vi trước khi có bộ theo loại.
 * `order` có truyền → điền đủ (thiếu 0%, bỏ mã ngoài `order`) để khớp đúng danh sách giai đoạn
 * đang dùng (K9 - vd giai đoạn admin thêm sau này, hoặc 1 trong 8 mã gốc đã ngừng dùng).
 */
export function presetWeightsFor(type: ProjectType | '', order?: readonly StageCode[]): StageWeightInput[] {
  const rows = type === '' ? DEFAULT_STAGE_WEIGHTS.map((w) => ({ ...w })) : STAGE_WEIGHT_PRESETS[type].map((w) => ({ ...w }));
  return order ? fillWeightsForStages(rows, order) : rows;
}

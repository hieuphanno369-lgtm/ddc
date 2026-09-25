import { DEFAULT_STAGE_WEIGHTS, STAGE_ORDER } from '@/lib/stages';
import type { ProjectType, StageWeightInput } from '@/server/repo/types';

/**
 * G-6 (Q1, ĐÃ CHỐT 2026-09-25): bộ trọng số 7 giai đoạn mặc định theo loại dự án - điền sẵn khi
 * TẠO dự án mới (mục 5 form). Cột theo STAGE_ORDER: design·shop·procurement·fabrication·transport·erection·handover.
 * `Khac` = `DEFAULT_STAGE_WEIGHTS` hiện tại (giữ nguyên hành vi cũ khi không chọn loại cụ thể).
 */
export const STAGE_WEIGHT_PRESETS: Record<ProjectType, StageWeightInput[]> = {
  EPC: build([8, 10, 15, 32, 5, 27, 3]),
  San_bay: build([4, 8, 8, 42, 5, 30, 3]),
  San_van_dong: build([5, 10, 8, 38, 6, 30, 3]),
  Nha_xuong: build([3, 7, 20, 38, 5, 24, 3]),
  Cau_cang: build([5, 10, 10, 38, 10, 24, 3]),
  Cao_tang: build([5, 12, 10, 35, 5, 30, 3]),
  Dong_tau: build([8, 12, 15, 45, 2, 15, 3]),
  Cau_giao_thong: build([6, 10, 10, 37, 8, 26, 3]),
  Khac: DEFAULT_STAGE_WEIGHTS.map((w) => ({ ...w })),
};

function build(pcts: number[]): StageWeightInput[] {
  return STAGE_ORDER.map((code, i) => ({ stageCode: code, weightPct: pcts[i], applicable: true }));
}

/** '' (chưa chọn loại) → `DEFAULT_STAGE_WEIGHTS`, khớp hành vi trước khi có bộ theo loại. */
export function presetWeightsFor(type: ProjectType | ''): StageWeightInput[] {
  if (type === '') return DEFAULT_STAGE_WEIGHTS.map((w) => ({ ...w }));
  return STAGE_WEIGHT_PRESETS[type].map((w) => ({ ...w }));
}

/**
 * NGƯỠNG ĐÁNH GIÁ - nguồn duy nhất cho mọi ngưỡng trong hệ thống.
 * Spec: mục 4 + QuyUoc_DinhNghia_NguongDanhGia.docx.
 * Sửa ở đây, KHÔNG sửa rải rác trong component/SQL.
 */
export const THRESHOLDS = {
  /** SPI < 0.9 → cảnh báo trễ tiến độ theo giá trị (Amber) */
  spiWarn: 0.9,
  /** CPI < 0.9 → cảnh báo vượt chi phí (Amber) */
  cpiWarn: 0.9,
  /** Biên độ chấp nhận khi so %TT vs %KH (5%) - Đúng tiến độ nếu %TT >= %KH - 5% */
  scheduleTolerancePct: 0.05,
  /** Nguy cơ phạt HĐ: còn <= 30 ngày đến mốc cam kết */
  penaltyRiskDays: 30,
  /** Cảnh báo dồn tải xưởng: sản lượng tháng > 85% công suất */
  capacityWarnPct: 0.85,
  /** Cảnh báo công nợ quá hạn > 5% giá trị HĐ */
  overdueWarnPct: 0.05,
  /** Huy động thiết bị < 80% → cảnh báo thiếu nguồn lực */
  equipmentWarnPct: 0.8,
  /** Trạng thái "Hoàn thành" khi %TT >= 100% */
  completionPct: 1.0,
  /** Trần % nhập liệu hợp lệ (cho phép vượt tiến độ tới 150%) */
  pctInputMax: 1.5,
} as const;

export type ThresholdKey = keyof typeof THRESHOLDS;

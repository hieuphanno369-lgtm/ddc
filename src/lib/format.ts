/** Định dạng số tỷ VNĐ (giá trị hợp đồng/doanh thu/chi phí). */
export function formatVndTyd(value: number | null | undefined, locale: string = 'vi'): string {
  if (value == null || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    maximumFractionDigits: 1,
  }).format(value);
}

/** Định dạng tiền kèm đơn vị "tỷ VNĐ". */
export function formatTyd(value: number | null | undefined, locale: string = 'vi'): string {
  if (value == null || Number.isNaN(value)) return '-';
  return `${formatVndTyd(value, locale)} ${locale === 'vi' ? 'tỷ' : 'bn VND'}`;
}

/** Định dạng khối lượng tấn. */
export function formatTon(value: number | null | undefined, locale: string = 'vi'): string {
  if (value == null || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    maximumFractionDigits: 1,
  }).format(value);
}

/** Định dạng % - nhận giá trị dạng 0.8571 → "85.7%". */
export function formatPct(value: number | null | undefined, locale: string = 'vi'): string {
  if (value == null || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'percent',
    maximumFractionDigits: 2,
  }).format(value);
}

/** Định dạng tỷ số EVM (SPI/CPI/EAC) - 2 chữ số thập phân. */
export function formatRatio(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '-';
  return value.toFixed(2);
}

/** Định dạng ngày ngắn. */
export function formatDate(value: string | Date | null | undefined, locale: string = 'vi'): string {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/** Định dạng ngày + giờ. */
export function formatDateTime(value: string | Date | null | undefined, locale: string = 'vi'): string {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** Làm tròn 2 chữ số thập phân cho value input số (bỏ trailing zero). */
export function fmtNum(v: string): string {
  if (v === '' || v == null) return '';
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return String(Math.round(n * 100) / 100);
}

/** Viết hoa chữ cái đầu mỗi từ. */
export function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

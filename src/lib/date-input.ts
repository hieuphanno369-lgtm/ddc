/**
 * Nhập/hiển thị ngày dd/mm/yyyy cho ô ngày riêng (`DateField`). HÀM THUẦN.
 * Không phụ thuộc ngôn ngữ trình duyệt (ô `input[type=date]` gốc chỉ theo ngôn ngữ giao diện trình duyệt).
 */

import { isValidIsoDate } from './clock';
import type { IsoDate } from './clock';

/** Cùng khoảng năm với `parsePeriod` (src/lib/period.ts). */
const YEAR_MIN = 2000;
const YEAR_MAX = 2999;

/** '2026-09-29' -> '29/09/2026'; giá trị không phải ngày ISO -> ''. */
export function formatDmy(iso: string): string {
  return isValidIsoDate(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
}

/**
 * Chuẩn hoá chữ đang gõ: chỉ giữ chữ số (tối đa 8), chèn "/" sau ngày và tháng.
 * Không chèn "/" ở cuối để xoá lùi qua dấu "/" không bị kẹt.
 */
export function maskDmy(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  let out = d.slice(0, 2);
  if (d.length > 2) out += `/${d.slice(2, 4)}`;
  if (d.length > 4) out += `/${d.slice(4)}`;
  return out;
}

/** 'dd/mm/yyyy' (cho phép d/m/yyyy, phân tách "/", "-", "." hoặc 8 chữ số liền) -> ISO; sai (kể cả 30/02, năm ngoài 2000-2999) -> null. */
export function parseDmy(text: string): IsoDate | null {
  const s = text.trim();
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(s);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const year = Number(m[3]);
  return isValidIsoDate(iso) && year >= YEAR_MIN && year <= YEAR_MAX ? iso : null;
}

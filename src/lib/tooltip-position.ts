/**
 * Hình học thuần cho tooltip `.tip` (ChartTip.tsx). Tách riêng để test được không cần DOM/JSDOM
 * layout thật (vitest.config.ts chạy môi trường `node`).
 *
 * Bug CAN-1 (Doi 2, vong debug 1): vị trí cũ dùng hằng số cứng `w = 200` để quyết định lật
 * trái/phải, không khớp bề rộng thật đã render (dòng "Phụ trách" liệt kê nhiều nhà thầu có thể
 * rộng ~329-380px) → tooltip tràn phải ở khổ 1440px. Hàm này nhận bề rộng/chiều cao THẬT (đo bằng
 * `getBoundingClientRect()` sau khi mount) và luôn kẹp trong viewport ở cả 4 phía.
 */
export interface ClampTipPositionInput {
  /** Toạ độ con trỏ chuột (ev.clientX/clientY). */
  clientX: number;
  clientY: number;
  /** Bề rộng/chiều cao của tooltip — ước lượng ở lần render đầu, đo thật sau khi mount. */
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  /** Khoảng cách tối thiểu tới mép viewport. */
  margin?: number;
  /** Khoảng cách từ con trỏ chuột tới tooltip khi không cần lật. */
  offset?: number;
}

export interface TipPosition { x: number; y: number }

export function clampTipPosition({
  clientX,
  clientY,
  width,
  height,
  viewportWidth,
  viewportHeight,
  margin = 10,
  offset = 16,
}: ClampTipPositionInput): TipPosition {
  const flipGap = offset - 2;

  let x = clientX + offset;
  if (x + width > viewportWidth - margin) x = clientX - width - flipGap;
  let y = clientY + offset;
  if (y + height > viewportHeight - margin) y = clientY - height - flipGap;

  // Kẹp cứng trong viewport dù đã lật (vd tooltip quá rộng cho cả 2 phía, hoặc gần góc màn hình).
  const minX = margin;
  const maxX = Math.max(minX, viewportWidth - margin - width);
  x = Math.min(Math.max(x, minX), maxX);

  const minY = margin;
  const maxY = Math.max(minY, viewportHeight - margin - height);
  y = Math.min(Math.max(y, minY), maxY);

  return { x, y };
}

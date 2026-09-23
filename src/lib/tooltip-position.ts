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

/** Phần tử tối thiểu cần để đo-rồi-định-vị (khớp HTMLElement, nhưng test được bằng đối tượng giả). */
export interface MeasurableTipElement {
  style: { left: string; top: string };
  offsetWidth: number;
  offsetHeight: number;
}

/**
 * Đo bề rộng/cao THẬT của phần tử tooltip rồi tính vị trí đã kẹp trong viewport, và gán thẳng vào
 * `el.style.left/top`.
 *
 * Vòng debug 2 (CAN-2): sửa vòng 1 (đo bằng getBoundingClientRect() NGAY TẠI vị trí ước lượng ban
 * đầu) không có tác dụng vì phép đo đó "tự ứng nghiệm". CSS2.1 §10.3.7 case 3 — phần tử
 * `position:fixed` có `left` xác định, `width:auto`, `right:auto` (đúng CSS `.tip` hiện tại) —
 * trình duyệt tính "used width" bằng thuật toán shrink-to-fit bị chặn trên bởi khoảng trống còn
 * lại BÊN PHẢI của `left` hiện tại (= viewportWidth - left), KHÔNG phải bởi bề rộng nội dung mong
 * muốn. Ví dụ left ước lượng ban đầu = 1260 trong khổ 1440px chỉ còn ~180px bên phải: đo tại đó
 * luôn ra một bề rộng bị bó hẹp gần đúng bằng khoảng trống đó, rồi clampTipPosition lại tính ra
 * một vị trí gần giống hệt vị trí sai ban đầu (điểm bất động sai) — tooltip có vẻ như "không bao
 * giờ đo lại", dù effect vẫn chạy và setState vẫn xảy ra.
 *
 * Cách sửa: đặt phần tử về `left:0;top:0` (còn nguyên viewport bên phải/dưới) TRƯỚC khi đọc
 * `offsetWidth/offsetHeight`, để phép đo chỉ còn bị chặn bởi CSS `min-width/max-width` (đúng ý
 * muốn) chứ không phải bởi vị trí hiện tại. Dùng `offsetWidth/offsetHeight` (không phải
 * `getBoundingClientRect()`) vì không bị ảnh hưởng bởi `transform: scale()`.
 */
export function measureAndClampTip(
  el: MeasurableTipElement,
  tip: { clientX: number; clientY: number },
  viewportWidth: number,
  viewportHeight: number,
): TipPosition {
  el.style.left = '0px';
  el.style.top = '0px';
  const pos = clampTipPosition({
    clientX: tip.clientX,
    clientY: tip.clientY,
    width: el.offsetWidth,
    height: el.offsetHeight,
    viewportWidth,
    viewportHeight,
  });
  el.style.left = `${pos.x}px`;
  el.style.top = `${pos.y}px`;
  return pos;
}

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

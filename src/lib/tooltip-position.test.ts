import { describe, expect, it } from 'vitest';
import { clampBubbleX, clampTipPosition, measureAndClampTip, openBubbleStyle, type MeasurableTipElement } from './tooltip-position';

const VIEWPORT = { viewportWidth: 1440, viewportHeight: 1000 };

/**
 * Giả lập hành vi CSS thật của `.tip` (position:fixed; left xác định; width:auto; right:auto —
 * CSS2.1 §10.3.7 case 3): `offsetWidth` bị chặn bởi khoảng trống còn lại bên phải của `left` hiện
 * tại (= viewportWidth - left), không chỉ bởi CSS min/max-width. Dùng để tái hiện bug CAN-2 (đo
 * "tự ứng nghiệm") mà không cần DOM/trình duyệt thật.
 */
function makeSelfReferentialEl(trueWidth: number, trueHeight: number, viewportWidth: number): MeasurableTipElement {
  let left = 0;
  let top = 0;
  return {
    style: {
      get left() { return `${left}px`; },
      set left(v: string) { left = parseFloat(v) || 0; },
      get top() { return `${top}px`; },
      set top(v: string) { top = parseFloat(v) || 0; },
    },
    get offsetWidth() {
      const availableRight = Math.max(0, viewportWidth - left);
      return Math.min(trueWidth, Math.max(availableRight, 160)); // 160 = min-width CSS cua .tip
    },
    get offsetHeight() {
      return trueHeight;
    },
  };
}

describe('clampTipPosition', () => {
  it('duong chay thuan: khong tran, dat ben phai/duoi con tro theo offset mac dinh', () => {
    const r = clampTipPosition({ clientX: 500, clientY: 300, width: 200, height: 100, ...VIEWPORT });
    expect(r.x).toBe(516); // clientX + offset(16)
    expect(r.y).toBe(316);
  });

  it('CAN-1 (Dot 2, vong debug 1): tooltip rong that ~329px (dong "Phu trach" nhieu nha thau) khong duoc tran phai o 1440px', () => {
    // Tai hien so lieu tester do duoc: right = 1588.89 khi dung hang w=200 cu; bay gio dung
    // be rong THAT (~329px) va phai kep trong viewport.
    const clientX = 1243.99; // uoc luong tu right/left tester ghi lai (1588.89 - 329 - 16 = 1243.89, sai so lam tron)
    const width = 329;
    const r = clampTipPosition({ clientX, clientY: 100, width, height: 150, ...VIEWPORT });
    expect(r.x + width).toBeLessThanOrEqual(VIEWPORT.viewportWidth - 10);
    expect(r.x).toBeGreaterThanOrEqual(10);
  });

  it('lat trai khi sap tran phai', () => {
    const r = clampTipPosition({ clientX: 1300, clientY: 100, width: 200, height: 100, ...VIEWPORT });
    // 1300 + 16 + 200 = 1516 > 1430 (viewportWidth - margin) -> lat trai: 1300 - 200 - 14 = 1086
    expect(r.x).toBe(1086);
  });

  it('lat tren khi sap tran duoi', () => {
    const r = clampTipPosition({ clientX: 500, clientY: 950, width: 200, height: 100, ...VIEWPORT });
    expect(r.y).toBe(950 - 100 - 14);
  });

  it('tooltip rong hon ca viewport (sau khi lat van tran) -> kep sat mep, khong am', () => {
    const r = clampTipPosition({ clientX: 700, clientY: 100, width: 1500, height: 50, ...VIEWPORT });
    expect(r.x).toBe(10); // margin, khong the < 0
  });

  it('gan goc trai/tren man hinh -> khong am toa do', () => {
    const r = clampTipPosition({ clientX: 2, clientY: 2, width: 200, height: 100, ...VIEWPORT });
    expect(r.x).toBeGreaterThanOrEqual(10);
    expect(r.y).toBeGreaterThanOrEqual(10);
  });
});

describe('measureAndClampTip (CAN-2, vong debug 2)', () => {
  it('tai hien bug: do NGAY TAI vi tri uoc luong sai (khong reset ve 0 truoc) -> be rong do duoc bi bop nho lai theo khoang trong con lai, khong phai be rong that', () => {
    // "Phu trach" that rong 329px, nhung uoc luong ban dau dat el o left=1260 trong khong 1440px
    // -> chi con ~180px ben phai -> offsetWidth do ngay tai do bi bop con ~180, KHONG phai 329.
    const el = makeSelfReferentialEl(329, 150, VIEWPORT.viewportWidth);
    el.style.left = '1260px';
    const wrongWidthReadDirectly = el.offsetWidth;
    expect(wrongWidthReadDirectly).toBeLessThan(329);
    expect(wrongWidthReadDirectly).toBeCloseTo(VIEWPORT.viewportWidth - 1260, 0);
  });

  it('sua bug: dat lai left:0/top:0 truoc khi do -> ra dung be rong that va vi tri cuoi cung nam gon trong viewport', () => {
    const el = makeSelfReferentialEl(329, 150, VIEWPORT.viewportWidth);
    // El dang o vi tri UOC LUONG SAI (mo phong render dau tien voi estW=200 truoc khi do).
    el.style.left = '1260px';
    el.style.top = '100px';

    const pos = measureAndClampTip(el, { clientX: 1243.99, clientY: 100 }, VIEWPORT.viewportWidth, VIEWPORT.viewportHeight);

    // Vi measureAndClampTip da dat tam left:0 truoc khi doc offsetWidth, be rong do duoc phai la
    // be rong THAT (329), khong bi bop theo vi tri cu.
    expect(pos.x + 329).toBeLessThanOrEqual(VIEWPORT.viewportWidth - 10);
    expect(pos.x).toBeGreaterThanOrEqual(10);
    // Ham phai ghi thang vi tri da kep vao style cua phan tu (khong con o left=1260 sai nua).
    expect(el.style.left).toBe(`${pos.x}px`);
    expect(el.style.top).toBe(`${pos.y}px`);
  });

  it('goi lai measureAndClampTip nhieu lan lien tiep (mo phong nhieu lan do-lai khi tip doi) van hoi tu ve cung 1 vi tri dung, khong dao dong', () => {
    const el = makeSelfReferentialEl(329, 150, VIEWPORT.viewportWidth);
    el.style.left = '1260px';
    const first = measureAndClampTip(el, { clientX: 1243.99, clientY: 100 }, VIEWPORT.viewportWidth, VIEWPORT.viewportHeight);
    const second = measureAndClampTip(el, { clientX: 1243.99, clientY: 100 }, VIEWPORT.viewportWidth, VIEWPORT.viewportHeight);
    expect(second).toEqual(first);
    expect(second.x + 329).toBeLessThanOrEqual(VIEWPORT.viewportWidth - 10);
  });
});

describe('clampBubbleX (GOP-3 - bong bong HelpTip)', () => {
  const btn = { anchorWidth: 15, bubbleWidth: 268 };

  it('du cho -> can giua theo nut, mui ten o giua bong bong', () => {
    const { left, arrow } = clampBubbleX({ ...btn, anchorLeft: 700, viewportWidth: 1600 });
    expect(left).toBeCloseTo(7.5 - 134, 5);
    expect(arrow).toBeCloseTo(134, 5);
  });

  it('nut sat mep phai (heading tieng Viet dai, mobile 433) -> khong tran phai, mui ten van chi vao nut', () => {
    const anchorLeft = 362;
    const { left, arrow } = clampBubbleX({ ...btn, anchorLeft, viewportWidth: 433 });
    const x = anchorLeft + left;
    expect(x + 268).toBeLessThanOrEqual(433 - 12);
    expect(x + arrow).toBeCloseTo(anchorLeft + 7.5, 5);
  });

  it('nut gan mep trai (heading tieng Anh ngan, .rt tung tran trai -102px) -> khong tran trai', () => {
    const anchorLeft = 150;
    const { left } = clampBubbleX({ ...btn, anchorLeft, viewportWidth: 433 });
    expect(anchorLeft + left).toBeGreaterThanOrEqual(12);
  });

  it('viewport hep hon bong bong -> thu nho vua (vw - 2*margin), nam gon 2 mep', () => {
    const anchorLeft = 100;
    const { left, arrow } = clampBubbleX({ ...btn, anchorLeft, viewportWidth: 250 });
    expect(anchorLeft + left).toBe(12);
    expect(arrow).toBeLessThanOrEqual(250 - 24 - 12);
  });
});

describe('openBubbleStyle (HelpTip mo bang bam)', () => {
  it('hien bong bong: display block, opacity 1, visibility visible', () => {
    const s = openBubbleStyle(false);
    expect(s).toMatchObject({ display: 'block', opacity: '1', visibility: 'visible' });
  });

  it('chua kep viewport: giu can giua -50%; da kep (clamped): khong dich ngang', () => {
    expect(openBubbleStyle(false).transform).toBe('translateX(-50%) translateY(0) scale(1)');
    expect(openBubbleStyle(true).transform).toBe('translateY(0) scale(1)');
  });
});

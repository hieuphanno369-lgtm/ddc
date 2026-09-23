import { describe, expect, it } from 'vitest';
import { clampTipPosition } from './tooltip-position';

const VIEWPORT = { viewportWidth: 1440, viewportHeight: 1000 };

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

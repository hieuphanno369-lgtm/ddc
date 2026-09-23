'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { clampTipPosition, measureAndClampTip } from '@/lib/tooltip-position';

/** SSR (renderToStaticMarkup trong test) không có DOM -> useLayoutEffect sẽ cảnh báo "does nothing
 *  on the server". Dùng useEffect ở đó, useLayoutEffect ở trình duyệt thật (bắt buộc phải đo TRƯỚC
 *  khi paint, xem giải thích ở dưới). */
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface TipRow { k: string; v: string; color?: string; valueColor?: string }
export interface TipState {
  /** Toạ độ chuột gốc — dùng để tính lại vị trí khi đo được bề rộng thật sau khi mount. */
  clientX: number;
  clientY: number;
  /** Vị trí ước lượng cho lần vẽ đầu (trước khi đo DOM thật); tránh nhấp nháy khi mở tip mới. */
  x: number;
  y: number;
  title: string;
  rows: TipRow[];
}

/**
 * Tooltip kính `.tip` của mock-up (dòng 1325-1335). PHẢI portal ra body: Card có transform (hover
 * lift, motion.ts), khiến position:fixed bên trong tính theo Card chứ không theo viewport.
 *
 * Vong debug 1 (CAN-1): vi tri ban dau chi la UOC LUONG (be rong that phu thuoc noi dung, vd dong
 * "Phu trach" liet ke nhieu nha thau co the rong ~329-380px) — ChartTip do lai bang DOM that va kep
 * trong viewport ca 4 phia (xem clampTipPosition).
 *
 * Vong debug 2 (CAN-2): vong 1 do NGAY TAI vi tri uoc luong sai bang getBoundingClientRect() trong
 * useEffect -> phep do "tu ung nghiem" (xem giai thich chi tiet trong measureAndClampTip), ket qua
 * hoi tu ve gan dung vi tri sai ban dau nen tooltip nhu the "khong bao gio do lai". Sua bang
 * measureAndClampTip (dat tam left:0/top:0 truoc khi doc offsetWidth/offsetHeight) chay trong
 * useLayoutEffect (dong bo, TRUOC khi trinh duyet ve khung hinh dau) thay vi useEffect (bat dong bo,
 * SAU khi da ve 1 khung hinh o vi tri uoc luong) de khong bi nhap nhay 1 frame o vi tri sai.
 */
export function useChartTip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const show = useCallback((ev: MouseEvent, title: string, rows: TipRow[]) => {
    const estW = 200;
    const estH = 34 + rows.length * 20;
    const { x, y } = clampTipPosition({
      clientX: ev.clientX,
      clientY: ev.clientY,
      width: estW,
      height: estH,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
    setTip({ clientX: ev.clientX, clientY: ev.clientY, x, y, title, rows });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  return { tip, show, hide };
}

export function ChartTip({ tip }: { tip: TipState | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<{ x: number; y: number } | null>(null);

  useIsoLayoutEffect(() => {
    if (!tip || !ref.current) {
      setMeasured(null);
      return;
    }
    setMeasured(
      measureAndClampTip(ref.current, tip, window.innerWidth, window.innerHeight),
    );
    // Chỉ cần đo lại khi tip đổi nội dung/vị trí gốc (title dùng làm khoá nội dung đủ rẻ + ổn định).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tip?.clientX, tip?.clientY, tip?.title, tip?.rows]);

  if (!tip || typeof document === 'undefined') return null;
  const pos = measured ?? { x: tip.x, y: tip.y };
  return createPortal(
    <div ref={ref} className="tip show" role="tooltip" style={{ left: pos.x, top: pos.y }}>
      <b>{tip.title}</b>
      {tip.rows.map((r) => (
        <div key={r.k} className="r">
          <span>{r.color && <i style={{ background: r.color }} />}{r.k}</span>
          <span style={r.valueColor ? { color: r.valueColor } : undefined}>{r.v}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
}

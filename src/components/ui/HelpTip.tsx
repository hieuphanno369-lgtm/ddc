'use client';

import { useCallback, useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { clampBubbleX, openBubbleStyle } from '@/lib/tooltip-position';

/** Bề rộng `.help .bub` trong app/globals.css — giữ đồng bộ. */
const BUB_WIDTH = 268;
const OPEN_KEYS = ['display', 'opacity', 'visibility', 'transform'] as const;

/**
 * Nút "?" + bong bóng `.help .bub` (mock-up dòng 437-458). Card chứa nó phải có className="overflow-visible".
 * GOP-3: khi mở (hover/focus/chạm), kẹp bong bóng trong viewport theo vị trí nút thật (clampBubbleX);
 * SSR vẫn render như cũ, vị trí CSS mặc định chỉ dùng trước lần tương tác đầu.
 * P4 (E3): BẤM mở/đóng (điện thoại không có hover, iOS Safari bấm không focus nút). Khi mở, gán style inline cho
 * `.bub` (không sửa globals.css); đóng khi bấm lại, Escape, bấm ra ngoài hoặc mất focus. Hover/focus cũ vẫn chạy.
 * Thẻ chứa "?" được nâng z-index lúc mở để bong bóng không bị thẻ kề sau che (mỗi `.kpi` là 1 stacking context).
 */
export function HelpTip({ text, label, alignRight = false, onDark = false }: { text: string; label: string; alignRight?: boolean; onDark?: boolean }) {
  const bubId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef(false);
  const [open, setOpen] = useState(false);

  const place = useCallback((ev: SyntheticEvent<HTMLButtonElement>) => {
    const btn = ev.currentTarget;
    const bub = btn.querySelector<HTMLElement>('.bub');
    if (!bub) return;
    const r = btn.getBoundingClientRect();
    const { left, arrow } = clampBubbleX({
      anchorLeft: r.left,
      anchorWidth: r.width,
      bubbleWidth: BUB_WIDTH,
      viewportWidth: document.documentElement.clientWidth,
    });
    bub.style.setProperty('--bub-left', `${left}px`);
    bub.style.setProperty('--bub-arrow', `${arrow}px`);
    bub.classList.add('clamped');
    // Đang mở bằng bấm thì giữ nguyên display:block inline.
    if (!openRef.current) bub.style.removeProperty('display');
  }, []);

  const bubble = () => btnRef.current?.querySelector<HTMLElement>('.bub') ?? null;
  const host = () => btnRef.current?.closest<HTMLElement>('.kpi, .card') ?? null;

  const openIt = useCallback(() => {
    const bub = bubble();
    if (!bub) return;
    const style = openBubbleStyle(bub.classList.contains('clamped'));
    for (const k of OPEN_KEYS) bub.style.setProperty(k, style[k]);
    const h = host();
    if (h) h.style.zIndex = '30';
    openRef.current = true;
    setOpen(true);
  }, []);

  /** `keepHidden`: Escape muốn ẩn hẳn kể cả khi con trỏ vẫn đang hover (giữ hành vi cũ của phím Escape). */
  const closeIt = useCallback((keepHidden = false) => {
    const bub = bubble();
    if (bub) {
      for (const k of OPEN_KEYS) bub.style.removeProperty(k);
      if (keepHidden) bub.style.setProperty('display', 'none');
    }
    const h = host();
    if (h) h.style.removeProperty('z-index');
    openRef.current = false;
    setOpen(false);
  }, []);

  // Đang mở: bấm ra ngoài hoặc Escape ở bất kỳ đâu thì đóng; gỡ listener khi đóng/unmount.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!btnRef.current?.contains(e.target as Node)) closeIt();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeIt(true);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, closeIt]);

  const hide = useCallback((ev: SyntheticEvent<HTMLButtonElement>) => {
    if (openRef.current) return;
    ev.currentTarget.querySelector<HTMLElement>('.bub')?.style.removeProperty('display');
  }, []);

  return (
    <button ref={btnRef} type="button" className={alignRight ? 'help rt' : 'help'} aria-label={label} aria-describedby={bubId}
      aria-expanded={open}
      style={onDark ? { background: 'rgba(255,255,255,.24)', color: 'white' } : undefined}
      onPointerEnter={place} onFocus={place} onPointerLeave={hide}
      onBlur={(e) => { if (openRef.current) closeIt(); else hide(e); }}
      onClick={(e) => {
        // "?" nằm trong thẻ có thể là <a href> (KpiCard href): bấm "?" chỉ mở giải thích, không điều hướng.
        e.preventDefault();
        e.stopPropagation();
        if (openRef.current) { closeIt(); return; }
        place(e);
        openIt();
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        if (openRef.current) closeIt(true);
        else e.currentTarget.querySelector<HTMLElement>('.bub')?.style.setProperty('display', 'none');
      }}>
      ?<span className="bub" id={bubId} role="tooltip">{text}</span>
    </button>
  );
}

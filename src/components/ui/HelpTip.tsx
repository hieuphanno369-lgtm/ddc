'use client';

import { useCallback, useId, type SyntheticEvent } from 'react';
import { clampBubbleX } from '@/lib/tooltip-position';

/** Bề rộng `.help .bub` trong app/globals.css — giữ đồng bộ. */
const BUB_WIDTH = 268;

/**
 * Nút "?" + bong bóng `.help .bub` (mock-up dòng 437-458). Card chứa nó phải có className="overflow-visible".
 * GOP-3: khi mở (hover/focus/chạm), kẹp bong bóng trong viewport theo vị trí nút thật (clampBubbleX);
 * SSR vẫn render như cũ, vị trí CSS mặc định chỉ dùng trước lần tương tác đầu.
 */
export function HelpTip({ text, label, alignRight = false }: { text: string; label: string; alignRight?: boolean }) {
  const bubId = useId();
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
    bub.style.removeProperty('display');
  }, []);
  const hide = useCallback((ev: SyntheticEvent<HTMLButtonElement>) => {
    ev.currentTarget.querySelector<HTMLElement>('.bub')?.style.removeProperty('display');
  }, []);
  return (
    <button type="button" className={alignRight ? 'help rt' : 'help'} aria-label={label} aria-describedby={bubId}
      onPointerEnter={place} onFocus={place} onBlur={hide} onPointerLeave={hide}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.currentTarget.querySelector<HTMLElement>('.bub')?.style.setProperty('display', 'none');
      }}>
      ?<span className="bub" id={bubId} role="tooltip">{text}</span>
    </button>
  );
}

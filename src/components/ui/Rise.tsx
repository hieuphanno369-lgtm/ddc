'use client';

import { useRef, type HTMLAttributes } from 'react';
import { useRise } from './motion';

/**
 * Client wrapper mong: goi useRise() quanh mot vung chua cac phan tu mang
 * class ".rise" (vd. luoi .kpis) de card troi len so le khi trang tai, dung
 * dung engine spring that trong motion.ts (Q4=(a), CS-3). Khong doi markup/
 * logic ben trong - chi bao mot <div ref> de useEffect querySelectorAll(".rise")
 * trong pham vi cua chinh no, khong dung toi document.
 */
export function Rise({
  baseDelay = 0,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement> & { baseDelay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useRise(ref, baseDelay);
  return <div ref={ref} className={className} {...props} />;
}

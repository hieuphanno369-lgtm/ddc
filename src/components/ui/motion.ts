'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Port nguyen ham "MOTION ENGINE" cua mockup-apple-glass.html (dong 1156-1230)
 * sang TypeScript - tich phan semi-implicit Euler chay theo rAF, KHONG xap xi
 * bang CSS keyframes. Q4=(a).
 *
 * Da gan (CS-3): useRise o src/components/ui/Rise.tsx (bao .kpis), useHoverLift
 * o src/components/ui/Card.tsx, usePressable o nut dang nhap chinh trong
 * LoginForm.tsx. spring()/riseIn() deu tra ve ham huy de cleanup dung trong
 * useEffect return - khong con vong rAF/setTimeout chay tiep sau khi unmount,
 * khong con 2 spring chong nhau tren cung 1 phan tu khi bam/re nhanh lien tiep.
 */

type SpringPreset = 'snappy' | 'smooth' | 'gentle' | 'bouncy';

const SPRING: Record<SpringPreset, { stiffness: number; damping: number; mass: number }> = {
  snappy: { stiffness: 400, damping: 30, mass: 1 }, // nut bam, hover
  smooth: { stiffness: 260, damping: 28, mass: 1 }, // card vao trang
  gentle: { stiffness: 170, damping: 26, mass: 1 }, // chuyen trang
  bouncy: { stiffness: 320, damping: 18, mass: 1 }, // nhan giu
};

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface SpringOptions {
  preset?: SpringPreset;
  stiffness?: number;
  damping?: number;
  mass?: number;
  from: number;
  to: number;
  velocity?: number;
  delay?: number;
  onUpdate: (value: number) => void;
  onDone?: () => void;
}

/**
 * Tich phan spring vat ly - dung y het cong thuc mock-up dong 1164-1187.
 * Tra ve ham huy: goi de dung vong rAF giua chung (unmount, hoac spring moi
 * tren cung 1 phan tu can thay spring cu - xem usePressable/useHoverLift).
 * Neu khong co requestAnimationFrame (moi truong test khong co window/rAF)
 * thi nhay thang ve gia tri dich, khong throw, khong treo.
 */
export function spring(opts: SpringOptions): () => void {
  const cfg = opts.preset ? SPRING[opts.preset] : SPRING.smooth;
  const k = opts.stiffness || cfg.stiffness;
  const c = opts.damping || cfg.damping;
  const m = opts.mass || cfg.mass;
  let x = opts.from;
  let v = opts.velocity || 0;
  const to = opts.to;
  const { onUpdate, onDone, delay = 0 } = opts;

  if (reducedMotion() || typeof requestAnimationFrame === 'undefined') {
    onUpdate(to);
    onDone?.();
    return () => {};
  }

  let cancelled = false;
  let rafId = 0;
  let t0: number | null = null;
  let last = 0;
  function frame(ts: number) {
    if (cancelled) return;
    if (t0 === null) t0 = ts;
    if (ts - t0 < delay * 1000) {
      rafId = requestAnimationFrame(frame);
      return;
    }
    // dt lay theo nhip that cua man hinh, kep de khong no khi tab bi treo
    const dt = Math.min((ts - (last || ts)) / 1000, 1 / 30);
    last = ts;
    // sub-step 240Hz de 60Hz va 120Hz cho ra cung mot duong cong vat ly
    const steps = Math.max(1, Math.round(dt * 240));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const F = -k * (x - to) - c * v;
      v += (F / m) * h;
      x += v * h;
    }
    onUpdate(x);
    if (Math.abs(x - to) < 0.0015 && Math.abs(v) < 0.015) {
      onUpdate(to);
      onDone?.();
      return;
    }
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);
  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
  };
}

/**
 * Card troi len theo stagger - "spatial elevation" chuan Apple (mock-up dong 1190-1205).
 * Tra ve ham huy: clear setTimeout failsafe + huy tat ca spring con dang chay
 * (component unmount giua luc dang troi len).
 */
function riseIn(scope: ParentNode, baseDelay: number): () => void {
  const els = Array.from(scope.querySelectorAll<HTMLElement>('.rise'));
  if (reducedMotion()) {
    els.forEach((el) => {
      el.style.opacity = '';
      el.style.transform = '';
    });
    return () => {};
  }
  const cancelSprings: Array<() => void> = [];
  // failsafe: neu rAF khong chay (tab an, snapshot...) thi tra lai hien thi sau 900ms.
  // Phai huy spring goc TRUOC KHI gan gia tri cuoi - neu khong, spring con song
  // se ghi de lai o khung rAF ke tiep, gay chop-sang-roi-mo-lai (B-5, danh-gia.md
  // VONG 2).
  const timeoutId = setTimeout(() => {
    els.forEach((el, i) => {
      if (parseFloat(el.style.opacity || '1') < 1) {
        cancelSprings[i]?.();
        el.style.opacity = '';
        el.style.transform = '';
      }
    });
  }, 900);
  els.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translate3d(0,14px,0)';
    cancelSprings.push(
      spring({
        preset: 'smooth',
        from: 0,
        to: 1,
        delay: baseDelay + i * 0.035,
        onUpdate: (p) => {
          el.style.opacity = String(Math.min(1, p));
          el.style.transform = `translate3d(0,${(14 * (1 - p)).toFixed(2)}px,0)`;
        },
        onDone: () => {
          el.style.transform = '';
          el.style.opacity = '';
          el.style.willChange = 'auto';
        },
      }),
    );
  });
  return () => {
    clearTimeout(timeoutId);
    cancelSprings.forEach((cancel) => cancel());
  };
}

/** Chay riseIn cho moi phan tu .rise trong pham vi ref khi mount. Chi dung trong Client Component. */
export function useRise(ref: RefObject<HTMLElement>, baseDelay = 0): void {
  useEffect(() => {
    const scope = ref.current;
    if (!scope) return;
    return riseIn(scope, baseDelay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Nhan: co lai roi bat ve bang spring, giong UIKit (mock-up dong 1207-1218).
 * Huy spring dang chay truoc khi tao spring moi tren cung phan tu (bam/tha
 * nhanh lien tiep se khong con 2 vong rAF cung ghi el.style.transform).
 */
export function usePressable(ref: RefObject<HTMLElement>, scaleTo = 0.972): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let cancelCurrent: (() => void) | null = null;

    function onDown() {
      cancelCurrent?.();
      cancelCurrent = spring({
        preset: 'snappy',
        from: 1,
        to: scaleTo,
        onUpdate: (v) => {
          el!.style.transform = `scale(${v})`;
        },
      });
    }
    function onRelease() {
      cancelCurrent?.();
      const match = el!.style.transform.match(/scale\(([\d.]+)\)/);
      const from = match ? parseFloat(match[1]) : 1;
      cancelCurrent = spring({
        preset: 'bouncy',
        from,
        to: 1,
        onUpdate: (v) => {
          el!.style.transform = `scale(${v})`;
        },
      });
    }

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onRelease);
    el.addEventListener('pointerleave', onRelease);
    el.addEventListener('pointercancel', onRelease);
    return () => {
      cancelCurrent?.();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onRelease);
      el.removeEventListener('pointerleave', onRelease);
      el.removeEventListener('pointercancel', onRelease);
    };
  }, [ref, scaleTo]);
}

/**
 * Hover nang do cao (elevation e2 -> e3), mock-up dong 1220-1230.
 * Huy spring dang chay truoc khi tao spring moi tren cung phan tu (re chuot
 * ra/vao nhanh lien tiep se khong con 2 vong rAF cung ghi el.style.transform).
 */
export function useHoverLift(ref: RefObject<HTMLElement>, dy = 3): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let cancelCurrent: (() => void) | null = null;

    function onEnter() {
      cancelCurrent?.();
      cancelCurrent = spring({
        preset: 'snappy',
        from: 0,
        to: 1,
        onUpdate: (p) => {
          el!.style.transform = `translate3d(0,${(-dy * p).toFixed(2)}px,0)`;
        },
      });
    }
    function onLeave() {
      cancelCurrent?.();
      cancelCurrent = spring({
        preset: 'smooth',
        from: 1,
        to: 0,
        onUpdate: (p) => {
          el!.style.transform = `translate3d(0,${(-dy * p).toFixed(2)}px,0)`;
        },
      });
    }

    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      cancelCurrent?.();
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [ref, dy]);
}

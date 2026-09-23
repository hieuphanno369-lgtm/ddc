import type { HTMLAttributes } from 'react';

export type BadgeTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

const TONES: Record<BadgeTone, string> = {
  ok: 'c-ok',
  warn: 'c-warn',
  danger: 'c-dan',
  info: 'c-info',
  neutral: 'c-plain',
};

export function Badge({
  tone = 'neutral',
  className = '',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={`chip ${TONES[tone]} ${className}`} {...props} />;
}

/** Cham trang thai nho - mau lay tu token, an theo theme. */
export function Dot({ tone }: { tone: 'ok' | 'warn' | 'danger' | 'neutral' }) {
  const v = { ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)', neutral: 'var(--label3)' }[tone];
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ backgroundColor: v }}
    />
  );
}

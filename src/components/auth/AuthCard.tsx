import s from './auth.module.css';
import { cx } from './cx';

/** Thẻ kính mờ chứa form ở nửa phải (mobile: rộng 100%, tối đa 480). */
export function AuthCard({ width, children }: { width: 452 | 480; children: React.ReactNode }) {
  return (
    <div className={cx(s.glass, s.card, width === 480 && s.card480)} data-auth="card">
      {children}
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { passwordStrength4 } from '@/lib/password-strength';
import s from './auth.module.css';
import { cx } from './cx';

/** Thanh 4 vạch độ mạnh mật khẩu; ẩn khi ô rỗng. */
export function PasswordStrength({ value }: { value: string }) {
  const t = useTranslations();
  const level = passwordStrength4(value);
  return (
    <div aria-live="polite" data-auth="strength">
      {level > 0 && (
        <div className={s.strength}>
          <div className={s.strengthBars}>
            {[1, 2, 3, 4].map((i) => <i key={i} className={cx(i <= level && s.on)} />)}
          </div>
          <span className={s.strengthLabel}>{t(`authPage.strength${level}`)}</span>
        </div>
      )}
    </div>
  );
}

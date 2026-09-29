import Image from 'next/image';
import { useTranslations } from 'next-intl';
import s from './auth.module.css';
import { cx } from './cx';

/** Logo + tên app. Dòng 1 là `app.headerTitle` (CSS đổi thành "Báo cáo quản trị"), dòng 2 là `app.name` in hoa. */
export function AuthBrand({ size }: { size: 'lg' | 'sm' }) {
  const t = useTranslations();
  const px = size === 'lg' ? 44 : 36;
  return (
    <div className={cx(s.brand, size === 'sm' && s.brandSm)}>
      <div className={s.logoBox}>
        <Image src="/logo.png" alt={t('app.name')} width={px} height={px} priority />
      </div>
      <div className={s.brandText}>
        <span className={s.brandTitle} data-auth="brand-title">{t('app.headerTitle')}</span>
        <span className={s.brandSub}>{t('app.name')}</span>
      </div>
    </div>
  );
}

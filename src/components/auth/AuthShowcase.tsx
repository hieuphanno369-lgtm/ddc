'use client';

import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { IconCheck } from '@/components/icons';
import s from './auth.module.css';
import { cx } from './cx';
import { AuthBrand } from './AuthBrand';
import { AuthLocaleSwitch } from './AuthLocaleSwitch';
import { CraneArt } from './CraneArt';
import { GanttArt } from './GanttArt';

/**
 * Nửa trái minh hoạ (desktop) + khối đầu trang (mobile). Biến thể theo đường dẫn:
 * `/dang-ky` -> 'register', còn lại -> 'login'. Nằm trong layout nhóm (auth) nên không chạy lại animation khi đổi trang.
 */
export function AuthShowcase() {
  const t = useTranslations();
  const pathname = usePathname();
  const register = pathname === '/dang-ky';

  return (
    <>
      <div
        className={cx(s.glass2, s.showcase, register && s.showcaseReg)}
        data-auth="showcase"
        data-variant={register ? 'register' : 'login'}
      >
        <AuthBrand size="lg" />

        <div className={cx(s.heroBlock, register && s.heroBlockReg)}>
          <div className={cx(s.heroRow, register && s.heroRowReg)}>
            <div className={cx(s.heroText, s.up)} data-auth="hero-text">
              {register ? (
                <h2 className={cx(s.heroTitle, s.heroTitleReg)}>
                  {t('authPage.registerHero1')}<br />
                  {t('authPage.registerHero2')}<br />
                  <span>{t('authPage.registerHero3')}</span>
                </h2>
              ) : (
                <h2 className={s.heroTitle}>
                  {t('authPage.heroLine1')}<br />
                  <span>{t('authPage.heroLine2')}</span>
                </h2>
              )}
              <p className={cx(s.heroBody, register && s.heroBodyReg)}>
                {register ? t('authPage.registerBody') : t('authPage.heroBody')}
              </p>
            </div>
            <CraneArt size={register ? 'md' : 'lg'} />
          </div>

          <GanttArt variant={register ? 'compact' : 'full'} />

          {register ? (
            <div className={s.doneRow}>
              <div className={cx(s.glass, s.doneCard)} data-auth="done-toast">
                <IconCheck size={18} strokeWidth={2} />
                <span className={s.doneText}>{t('authPage.doneToast')}</span>
              </div>
            </div>
          ) : (
            <div className={cx(s.alertRow, s.pop)}>
              <div className={cx(s.glass, s.alertCard)} data-auth="alert-card">
                <div className={s.pulse} />
                <div className={s.alertBody}>
                  <span className={s.alertLabel}>{t('authPage.alertLabel')}</span>
                  <span className={s.alertText}>{t('authPage.alertText')}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={s.foot}>
          <span>{register ? t('authPage.footerShort') : t('authPage.footerNote')}</span>
          <span>{t('authPage.copyright')}</span>
        </div>
      </div>

      <div className={s.mobileHead} data-auth="mobile-head">
        <div className={s.mobileTop}>
          <AuthBrand size="sm" />
          <Suspense fallback={null}>
            <AuthLocaleSwitch compact />
          </Suspense>
        </div>
        <h2 className={s.mobileHero}>
          {t('authPage.heroLine1')}<br />
          <span>{t('authPage.heroLine2')}</span>
        </h2>
      </div>
      <div className={s.mobileFoot} data-auth="mobile-foot">
        {t('authPage.footerShort')} · {t('authPage.copyright')}
      </div>
    </>
  );
}

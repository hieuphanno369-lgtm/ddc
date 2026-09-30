'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import s from './auth.module.css';
import { cx } from './cx';

/**
 * Đổi ngôn ngữ giữ nguyên đường dẫn và query (trang đặt lại mật khẩu cần `?token=`).
 * Bản thường: 2 nút VI/EN; bản compact (đầu trang di động): 1 nút hiện ngôn ngữ đang dùng, bấm để đổi sang ngôn ngữ kia.
 */
export function AuthLocaleSwitch({ compact = false }: { compact?: boolean }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function switchTo(next: Locale) {
    if (next === locale) return;
    router.replace({ pathname, query: Object.fromEntries(searchParams.entries()) }, { locale: next });
  }

  if (compact) {
    const other = routing.locales.find((l) => l !== locale) ?? locale;
    return (
      <button
        type="button"
        className={cx(s.glass, s.segCompact)}
        data-auth="lang-compact"
        aria-label={t('authPage.changeLanguage')}
        onClick={() => switchTo(other)}
      >
        {locale.toUpperCase()}
      </button>
    );
  }

  return (
    <div className={cx(s.glass, s.seg)} data-auth="lang-switch">
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          className={s.segBtn}
          aria-pressed={l === locale}
          onClick={() => switchTo(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

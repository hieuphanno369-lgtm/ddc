'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { IconProject } from '@/components/icons';

export default function NotFound() {
  const t = useTranslations();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="card" style={{ padding: '32px 40px' }}>
        <div
          className="mx-auto grid h-16 w-16 place-items-center"
          style={{ borderRadius: 'var(--r-icon)', background: 'var(--accent-tint)', color: 'var(--accent)' }}
        >
          <IconProject size={30} />
        </div>
        <h1 className="mt-4 text-title1 font-bold tracking-large">404</h1>
        <p className="mt-1 text-footnote text-label2">{t('common.noData')}</p>
        <Link href="/overview" className="btn mt-4 inline-flex">
          {t('nav.overview')}
        </Link>
      </div>
    </div>
  );
}

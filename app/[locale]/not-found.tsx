'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { IconProject } from '@/components/icons';

export default function NotFound() {
  const t = useTranslations();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-navy-50 text-navy-500">
        <IconProject size={30} />
      </div>
      <h1 className="mt-4 text-2xl font-semibold text-navy-900">404</h1>
      <p className="mt-1 text-sm text-slate-500">{t('common.noData')}</p>
      <Link href="/overview" className="mt-4 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white">
        {t('nav.overview')}
      </Link>
    </div>
  );
}

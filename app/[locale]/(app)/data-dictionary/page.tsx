import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getCurrentUser, homeForRole } from '@/lib/session';
import { DATA_DICTIONARY } from '@/lib/data-dictionary';
import { IconChevronDown } from '@/components/icons';

export default async function DataDictionaryPage() {
  // RBAC server-side: trang hệ thống chỉ dành cho admin (không phó mặc middleware).
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'admin') redirect(`/${locale}${homeForRole(user.role)}`);
  const t = await getTranslations();
  const isVi = locale === 'vi';

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-lg font-semibold text-navy-900">{t('settings.dataDictionary')}</h1>
      <p className="text-sm text-slate-500">
        {isVi
          ? 'Giải thích ý nghĩa + công thức từng field, cách đọc chart và cách dùng What-if - cho người không chuyên.'
          : 'Meaning + formula of every field, how to read each chart, and how to use What-if - for non-technical users.'}
      </p>

      {DATA_DICTIONARY.map((section, si) => (
        <details key={si} className="card group overflow-hidden">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-accent [&::-webkit-details-marker]:hidden">
            <span>{isVi ? section.titleVi : section.titleEn}</span>
            <IconChevronDown size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-2.5 px-5 pb-5">
            {section.entries.map((e, ei) => (
              <div key={ei} className="rounded-xl border border-slate-100 p-3 dark:border-slate-700">
                <div className="text-sm font-medium text-navy-900 dark:text-slate-100">
                  {isVi ? e.fieldVi : e.fieldEn}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {isVi ? e.meaningVi : e.meaningEn}
                </p>
                {(isVi ? e.formulaVi : e.formulaEn) && (
                  <p className="mt-1.5 font-mono text-xs text-emerald-700 dark:text-emerald-400">
                    {isVi ? e.formulaVi : e.formulaEn}
                  </p>
                )}
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

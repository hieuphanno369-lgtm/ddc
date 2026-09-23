import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { getCurrentUser, homeForRole } from '@/lib/session';
import { DATA_DICTIONARY } from '@/lib/data-dictionary';
import { IconChevronDown } from '@/components/icons';

export default async function DataDictionaryPage() {
  // RBAC server-side: trang hệ thống chỉ dành cho admin (không phó mặc middleware).
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'admin') redirect(`/${locale}${homeForRole(user.role)}`);
  const isVi = locale === 'vi';

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3.5">
      <div className="card">
        <div className="bd">
          <p className="hintline">
            {isVi
              ? 'Giải thích ý nghĩa + công thức từng field, cách đọc chart và cách dùng What-if - cho người không chuyên.'
              : 'Meaning + formula of every field, how to read each chart, and how to use What-if - for non-technical users.'}
          </p>
        </div>
      </div>

      {DATA_DICTIONARY.map((section, si) => (
        <details key={si} className="card group">
          <summary className="hd cursor-pointer [&::-webkit-details-marker]:hidden">
            <span>{isVi ? section.titleVi : section.titleEn}</span>
            <IconChevronDown size={16} className="shrink-0 text-label3 transition-transform duration-fast group-open:rotate-180" />
          </summary>
          <div className="bd flex flex-col gap-2.5">
            {section.entries.map((e, ei) => (
              <div key={ei} className="sumbar" style={{ display: 'block' }}>
                <div className="text-footnote font-semibold text-label">
                  {isVi ? e.fieldVi : e.fieldEn}
                </div>
                <p className="mt-1 text-caption1 leading-relaxed text-label2">
                  {isVi ? e.meaningVi : e.meaningEn}
                </p>
                {(isVi ? e.formulaVi : e.formulaEn) && (
                  <p className="mono mt-1.5" style={{ color: 'var(--ok)' }}>
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

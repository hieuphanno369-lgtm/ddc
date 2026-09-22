import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getCurrentUser, homeForRole } from '@/lib/session';
import { getReportData } from '@/server/report';
import { currentMonth } from '@/server/repo';
import { Link } from '@/i18n/navigation';
import { formatPct, formatRatio, formatTyd } from '@/lib/format';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { PenaltyBadge, PriorityBadge } from '@/components/ui/Badges';
import {
  IconAlert,
  IconExport,
  IconFactory,
  IconFlag,
  IconMoney,
  IconProject,
  IconTrend,
} from '@/components/icons';

export default async function ReportPage() {
  // RBAC server-side: trang vận hành dành cho admin + bod (không phó mặc middleware).
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect(`/${locale}/login`);
  if (!['admin', 'bod'].includes(user.role)) redirect(`/${locale}${homeForRole(user.role)}`);
  const t = await getTranslations();
  const { kpis, p0Red, rows } = await getReportData(currentMonth);
  const prevLabel = t('common.previousMonth');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-navy-900">{t('report.title')}</h1>
        <a
          href="/api/report/export"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          <IconExport size={16} /> {t('common.export')}
        </a>
      </div>

      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label={t('kpi.totalProjects')} value={String(kpis.totalProjects)} delta={kpis.delta.totalProjects} deltaSuffix={prevLabel} icon={IconProject} />
        <KpiCard label={t('kpi.inProgress')} value={String(kpis.inProgress)} delta={kpis.delta.inProgress} deltaSuffix={prevLabel} tone="ok" icon={IconFactory} />
        <KpiCard label={t('kpi.behindSchedule')} value={String(kpis.behindSchedule)} delta={kpis.delta.behindSchedule} deltaSuffix={prevLabel} tone="warn" invertDelta hero icon={IconTrend} />
        <KpiCard label={t('kpi.penaltyRisk')} value={String(kpis.penaltyRisk)} delta={kpis.delta.penaltyRisk} deltaSuffix={prevLabel} tone="warn" invertDelta icon={IconFlag} />
        <KpiCard label={t('kpi.penalized')} value={String(kpis.penalized)} delta={kpis.delta.penalized} deltaSuffix={prevLabel} tone="danger" invertDelta icon={IconAlert} />
        <KpiCard label={t('kpi.backlog')} value={formatTyd(kpis.backlog, locale)} delta={kpis.delta.backlog} deltaSuffix={prevLabel} tone="neutral" icon={IconMoney} />
      </div>

      <Card>
        <CardHeader title={t('report.p0Red')} />
        <CardBody>
          {p0Red.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">{t('common.noData')}</p>
          ) : (
            <ul className="space-y-2">
              {p0Red.map((w) => (
                <li key={w.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-navy-900">{w.projectName}</span>
                  <PriorityBadge priority={w.priority} />
                  <PenaltyBadge penalty={w.penalty} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('report.projectTable')} />
        <CardBody className="pt-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm table-zebra">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Mã DA</th>
                  <th className="px-4 py-2.5 font-medium">{t('form.projectName')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">SPI</th>
                  <th className="px-4 py-2.5 text-right font-medium">CPI</th>
                  <th className="px-4 py-2.5 text-right font-medium">% TT</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t('kpi.backlog')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.code}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/projects/${r.id}`} className="font-medium text-navy-900 hover:text-accent">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className={r.spi != null && r.spi < 0.9 ? 'font-medium text-amber-600' : 'text-slate-700'}>
                        {formatRatio(r.spi)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className={r.cpi != null && r.cpi < 0.9 ? 'font-medium text-amber-600' : 'text-slate-700'}>
                        {formatRatio(r.cpi)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{formatPct(r.pctActual, locale)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{formatTyd(r.backlog, locale)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                      {t('common.noData')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getCurrentUser, homeForRole } from '@/lib/session';
import { getReportData } from '@/server/report';
import { currentMonth } from '@/lib/clock';
import { Link } from '@/i18n/navigation';
import { formatPct, formatRatio, formatTyd } from '@/lib/format';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { Badge } from '@/components/ui/Badge';
import { PenaltyBadge, PriorityBadge } from '@/components/ui/Badges';
import { THRESHOLDS } from '@/lib/thresholds';
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
  const { kpis, p0Red, rows } = await getReportData(currentMonth());
  const prevLabel = t('common.previousMonth');

  return (
    <>
      {/* Topbar da hien ten trang (nav.report); giu h1 an cho cau truc heading/a11y +
          khop test operation-pages-render.test.ts dang doi 'report.title' trong HTML. */}
      <h1 className="sr-only">{t('report.title')}</h1>
      <div className="flex justify-end">
        <a
          href="/api/report/export"
          className="btn"
        >
          <IconExport size={16} /> {t('common.export')}
        </a>
      </div>

      <div className="kpis">
        <KpiCard label={t('kpi.totalProjects')} value={String(kpis.totalProjects)} delta={kpis.delta.totalProjects} deltaSuffix={prevLabel} icon={IconProject} />
        <KpiCard label={t('kpi.inProgress')} value={String(kpis.inProgress)} delta={kpis.delta.inProgress} deltaSuffix={prevLabel} tone="ok" icon={IconFactory} />
        <KpiCard label={t('kpi.behindSchedule')} value={String(kpis.behindSchedule)} delta={kpis.delta.behindSchedule} deltaSuffix={prevLabel} tone="warn" invertDelta hero heroTagLabel={t('kpi.focusTag')} icon={IconTrend} />
        <KpiCard label={t('kpi.penaltyRisk')} value={String(kpis.penaltyRisk)} delta={kpis.delta.penaltyRisk} deltaSuffix={prevLabel} tone="warn" invertDelta icon={IconFlag} />
        <KpiCard label={t('kpi.penalized')} value={String(kpis.penalized)} delta={kpis.delta.penalized} deltaSuffix={prevLabel} tone="danger" invertDelta icon={IconAlert} />
        <KpiCard label={t('kpi.backlog')} value={formatTyd(kpis.backlog, locale)} delta={kpis.delta.backlog} deltaSuffix={prevLabel} tone="neutral" icon={IconMoney} />
      </div>

      <Card>
        <CardHeader title={t('report.p0Red')} />
        <CardBody>
          {p0Red.length === 0 ? (
            <p className="empty">{t('common.noData')}</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {p0Red.map((w) => (
                <div key={w.id} className="alert">
                  <h4 className="min-w-0 flex-1 truncate">{w.projectName}</h4>
                  <PriorityBadge priority={w.priority} />
                  <PenaltyBadge penalty={w.penalty} />
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('report.projectTable')} />
        <CardBody>
          <div className="scroll">
            <table className="tbl" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>Mã DA</th>
                  <th>{t('form.projectName')}</th>
                  <th className="num">SPI</th>
                  <th className="num">CPI</th>
                  <th className="num">% TT</th>
                  <th className="num">{t('kpi.backlog')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.code}</td>
                    <td>
                      <Link href={`/projects/${r.id}`}>
                        {r.name}
                      </Link>
                    </td>
                    <td className="num">
                      <Badge tone={r.spi != null && r.spi < THRESHOLDS.spiWarn ? 'warn' : 'ok'}>
                        {formatRatio(r.spi)}
                      </Badge>
                    </td>
                    <td className="num">
                      <Badge tone={r.cpi != null && r.cpi < THRESHOLDS.cpiWarn ? 'warn' : 'ok'}>
                        {formatRatio(r.cpi)}
                      </Badge>
                    </td>
                    <td className="num">{formatPct(r.pctActual, locale)}</td>
                    <td className="num">{formatTyd(r.backlog, locale)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      {t('common.noData')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

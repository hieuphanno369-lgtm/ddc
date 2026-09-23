'use client';

import { Fragment, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatDateShort, formatDayMonth } from '@/lib/format';
import { TONE_CHIP, TONE_VAR, daysUsedTone, mobilizationTone, mobilizationTotalTone } from '@/lib/resources';
import {
  buildEquipmentView, buildLogView, buildMatrixView, buildTrackingSummary, equipmentColor, type WeeklyTracking,
} from '@/lib/tracking';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { HelpTip } from '@/components/ui/HelpTip';
import { ChartTip, useChartTip } from './ChartTip';

type View = 'log' | 'mx' | 'eq';

export function WeeklyTrackingCard({ data, locale }: { data: WeeklyTracking; locale: string }) {
  const t = useTranslations();
  const [view, setView] = useState<View>('log');
  const { tip, show, hide } = useChartTip();

  const dName = (d: string) => t(`detail.track.weekday.d${new Date(`${d}T00:00:00Z`).getUTCDay()}`);
  const pct0 = (r: number | null) => (r == null ? '-' : `${Math.round(r * 100)}%`);
  const pct1 = (r: number | null) =>
    r == null ? '-' : new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(r);
  const eqInfo = new Map(data.equipments.map((e, i) => [e.id, { name: e.name, color: equipmentColor(i) }]));
  const b = (c: React.ReactNode) => <b>{c}</b>;

  const sum = buildTrackingSummary(data);
  const sumTone = mobilizationTotalTone(sum.weekRatio);
  const sumClass = `sumbar${sumTone === 'ok' ? ' good' : sumTone === 'warn' ? ' bad' : ''}`;

  return (
    <Card className="overflow-visible">
      <CardHeader
        title={t('detail.track.title')}
        titleExtra={<HelpTip text={t('detail.track.help')} label={t('common.explain')} alignRight />}
        action={
          <div className="seg">
            <button type="button" className={view === 'log' ? 'on' : undefined} onClick={() => setView('log')}>{t('detail.track.tabLog')}</button>
            <button type="button" className={view === 'mx' ? 'on' : undefined} onClick={() => setView('mx')}>{t('detail.track.tabMatrix')}</button>
            <button type="button" className={view === 'eq' ? 'on' : undefined} onClick={() => setView('eq')}>{t('detail.track.tabEquipment')}</button>
          </div>
        }
      />
      <CardBody>
        <div className={sumClass}>
          <span>{t.rich('detail.track.sumLeft', { from: formatDayMonth(sum.from), to: formatDayMonth(sum.to), contractors: sum.contractorCount, equipments: sum.equipmentCount, b })}</span>
          <span>{t.rich('detail.track.sumRight', { day: sum.lastDayIsToday ? t('common.today') : t('detail.track.dayOn', { date: formatDayMonth(sum.to) }), actual: sum.lastActual, planned: sum.lastPlanned, pct: pct1(sum.weekRatio), b })}</span>
        </div>
        <div className="trackwrap scroll" style={{ marginTop: 12 }}>
          <table className="tbl">
            {view === 'log' && (
              <>
                <thead>
                  <tr>
                    <th>{t('detail.track.colDate')}</th>
                    <th>{t('detail.track.colContractor')}</th>
                    <th>{t('detail.track.colScope')}</th>
                    <th className="num">{t('detail.track.colPlanned')}</th>
                    <th className="num">{t('detail.track.colActual')}</th>
                    <th className="num">{t('detail.track.colDiff')}</th>
                    <th style={{ minWidth: 240, whiteSpace: 'normal' }}>{t('detail.track.colEquipment')}</th>
                  </tr>
                </thead>
                <tbody>
                  {buildLogView(data).map((d) => (
                    <Fragment key={d.date}>
                      <tr className="dayhead">
                        <td colSpan={3}>
                          {dName(d.date)} · {formatDateShort(d.date)}
                          {d.isToday && <>{' '}<span className="chip c-info">{t('common.today')}</span></>}
                        </td>
                        <td className="num">{d.planned}</td>
                        <td className="num">{d.actual}</td>
                        <td className="num"><span className={`chip ${TONE_CHIP[mobilizationTone(d.ratio)]}`}>{pct0(d.ratio)}</span></td>
                        <td>{t('detail.track.eqTypes', { n: d.equipmentTypeCount })}</td>
                      </tr>
                      {d.rows.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ color: 'var(--label3)' }}>{t('detail.track.noDataDay')}</td>
                        </tr>
                      ) : (
                        d.rows.map((r) => (
                          <tr key={r.contractorId}>
                            <td>{formatDayMonth(d.date)}</td>
                            <td style={{ fontWeight: 600 }}>{r.name}</td>
                            <td style={{ color: 'var(--label2)' }}>{r.scope || '-'}</td>
                            <td className="num">{r.planned}</td>
                            <td className="num" style={{ fontWeight: 750 }}>{r.actual}</td>
                            <td className="num"><span className={`chip ${TONE_CHIP[mobilizationTone(r.ratio)]}`}>{r.diff >= 0 ? '+' : ''}{r.diff}</span></td>
                            <td>
                              <div className="eqchips">
                                {r.equipmentIds.length === 0 ? (
                                  <span style={{ color: 'var(--label3)', fontSize: 'var(--t-caption2)' }}>{t('detail.track.noEquipment')}</span>
                                ) : (
                                  r.equipmentIds.map((id) => (
                                    <span key={id} className="eqchip"><i style={{ background: eqInfo.get(id)?.color }} />{eqInfo.get(id)?.name}</span>
                                  ))
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </>
            )}
            {view === 'mx' && (() => {
              const mx = buildMatrixView(data);
              return (
                <>
                  <thead>
                    <tr>
                      <th>{t('detail.track.colContractor')}</th>
                      {data.days.map((d, i) => (
                        <th key={d}>{dName(d)}<br />{formatDayMonth(d)}{i === data.days.length - 1 && d === data.today ? ' ●' : ''}</th>
                      ))}
                      <th className="num">{t('detail.track.colWeekAvg')}</th>
                    </tr>
                  </thead>
                  <tbody className="mx">
                    {mx.rows.map((row) => (
                      <tr key={row.contractorId}>
                        <td style={{ textAlign: 'left' }}>
                          {row.name}
                          <div style={{ fontSize: 'var(--t-caption2)', color: 'var(--label3)' }}>{row.scope}</div>
                        </td>
                        {row.cells.map((c, i) => (
                          <td key={i}>
                            {c ? (
                              <div className="cell"><b style={{ color: TONE_VAR[mobilizationTone(c.ratio)] }}>{c.actual}</b><span>{t('detail.track.planShort', { n: c.planned })}</span></div>
                            ) : (
                              <span style={{ color: 'var(--label4)' }}>-</span>
                            )}
                          </td>
                        ))}
                        <td className="num"><span className={`chip ${TONE_CHIP[mobilizationTone(row.weekRatio)]}`}>{pct0(row.weekRatio)}</span></td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ textAlign: 'left', fontWeight: 800 }}>{t('detail.track.siteTotal')}</td>
                      {mx.totals.map((m, i) => (
                        <td key={i}>
                          <div className="cell"><b>{m.actual}</b><span>{t('detail.track.planShort', { n: m.planned })}</span></div>
                        </td>
                      ))}
                      <td className="num"><span className={`chip ${TONE_CHIP[mobilizationTone(mx.weekRatio)]}`}>{pct1(mx.weekRatio)}</span></td>
                    </tr>
                  </tbody>
                </>
              );
            })()}
            {view === 'eq' && (() => {
              const rows = buildEquipmentView(data);
              return (
                <>
                  <thead>
                    <tr>
                      <th>{t('detail.track.colEquipmentName')}</th>
                      {data.days.map((d) => <th key={d}>{dName(d)}<br />{formatDayMonth(d)}</th>)}
                      <th className="num">{t('detail.track.colDaysUsed')}</th>
                    </tr>
                  </thead>
                  <tbody className="mx">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={data.days.length + 2}>{t('detail.track.noDataDay')}</td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.equipmentId}>
                          <td><span className="eqchip"><i style={{ background: row.color }} />{row.name}</span></td>
                          {row.cells.map((users, i) => (
                            <td key={i}>
                              {users.length === 0 ? (
                                <span style={{ color: 'var(--label4)' }}>-</span>
                              ) : (
                                <div
                                  className="cell"
                                  style={{ cursor: 'pointer' }}
                                  onMouseMove={(ev) => show(ev, `${row.name} · ${formatDateShort(data.days[i])}`, users.map((u) => ({ k: u.name, v: u.actualHeadcount == null ? '-' : t('detail.track.peopleN', { n: u.actualHeadcount }) })))}
                                  onMouseLeave={hide}
                                >
                                  <b style={{ color: 'var(--accent)' }}>{users.length}</b><span>{t('detail.track.contractorsUnit')}</span>
                                </div>
                              )}
                            </td>
                          ))}
                          <td className="num"><span className={`chip ${TONE_CHIP[daysUsedTone(row.daysUsed)]}`}>{row.daysUsed}/{data.days.length}</span></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </>
              );
            })()}
          </table>
        </div>
      </CardBody>
      <ChartTip tip={tip} />
    </Card>
  );
}

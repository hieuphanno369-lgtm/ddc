'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { groupImportByDay, type DailyImportRow } from '@/lib/daily-import';
import { commitDailyImportAction, previewDailyImportAction, type DailyImportError, type DailySaveError } from '@/server/actions-entry';
import { Badge } from '@/components/ui/Badge';

export interface DailyImportBlockProps {
  projectId: number;
  disabled: boolean;
}

export function DailyImportBlock({ projectId, disabled }: DailyImportBlockProps) {
  const t = useTranslations();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<DailyImportRow[] | null>(null);
  const [summary, setSummary] = useState<{ okCount: number; invalidCount: number; days: number } | null>(null);
  const [err, setErr] = useState<{ error: DailyImportError | DailySaveError | 'too_many_days'; sheet?: 'manpower' | 'equipment'; month?: string; workDate?: string } | null>(null);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState<{ days: number; created: number; updated: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function preview() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    setDone(null);
    try {
      const fd = new FormData();
      fd.set('projectId', String(projectId));
      fd.set('file', file);
      const res = await previewDailyImportAction(fd);
      if (res.ok) {
        setRows(res.rows);
        setSummary({ okCount: res.okCount, invalidCount: res.invalidCount, days: res.days });
      } else {
        setRows(null);
        setSummary(null);
        setErr(res);
      }
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!rows) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await commitDailyImportAction(projectId, groupImportByDay(rows), reason || undefined);
      if (res.ok) {
        setDone({ days: res.days, created: res.created, updated: res.updated });
        setRows(null);
        setSummary(null);
        router.refresh();
      } else {
        setErr(res);
      }
    } finally {
      setBusy(false);
    }
  }

  function errMessage(): string {
    if (!err) return '';
    if (err.error === 'bad_header') return t('dailyImport.err.bad_header', { sheet: t(`dailyImport.sheet.${err.sheet}`) });
    if (err.error === 'too_many_rows') return t('dailyImport.err.too_many_rows');
    if (err.error === 'too_many_days') return t('dailyImport.err.too_many_days');
    if (err.error === 'bad_file') return t('dailyImport.err.bad_file');
    if (err.error === 'Forbidden') return t('dailyEntry.err.forbidden');
    if (err.error === 'locked') return t('dailyEntry.err.locked', { month: err.month ?? '' });
    if (err.error === 'Invalid input' || err.error === 'Not found') return t('dailyEntry.err.generic', { msg: err.error });
    return t(`dailyEntry.err.${err.error}`);
  }

  if (disabled) return null;

  return (
    <div>
      <div className="sect"><b>{t('dailyImport.title')}</b><i /></div>
      <div className="flex flex-wrap items-center gap-2">
        <a href={`/api/templates/daily-resources?project=${projectId}`} className="btn ghost">
          {t('dailyImport.template')}
        </a>
        <input ref={fileRef} type="file" accept=".xlsx" className="inp" style={{ width: 'auto' }} />
        <button type="button" className="btn" disabled={busy} onClick={preview}>
          {t('dailyImport.preview')}
        </button>
      </div>

      {summary && (
        <p className="hintline">{t('dailyImport.summary', { ok: summary.okCount, invalid: summary.invalidCount })}</p>
      )}

      {rows && rows.length > 0 && (
        <div className="scroll" style={{ maxHeight: 320 }}>
          <table className="tbl sticky">
            <thead>
              <tr>
                <th>{t('dailyImport.rowNo')}</th>
                <th>{t('dailyImport.sheetCol')}</th>
                <th>{t('dailyEntry.date')}</th>
                <th>{t('dailyEntry.contractor')}</th>
                <th>{t('dailyEntry.equipment')}</th>
                <th>{t('dailyImport.statusCol')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.sheet}-${r.rowNo}-${i}`}>
                  <td>{r.rowNo}</td>
                  <td>{t(`dailyImport.sheet.${r.sheet}`)}</td>
                  <td>{r.workDate ?? '-'}</td>
                  <td>{r.contractorName}</td>
                  <td>{r.equipmentName}</td>
                  <td>
                    {r.status === 'ok' ? (
                      <Badge tone="ok">{t('dailyImport.ok')}</Badge>
                    ) : (
                      <Badge tone="danger">{t(`dailyImport.reason.${r.reason}`)}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {err?.error === 'reason_required' && (
        <div className="field">
          <span className="lb">{t('dailyEntry.reason')}</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="inp" />
        </div>
      )}

      {err && <p className="sumbar bad">{errMessage()}</p>}
      {done && (
        <span className="chip c-ok">
          {t('dailyImport.done', { days: done.days, created: done.created, updated: done.updated })}
        </span>
      )}

      {rows && rows.length > 0 && summary && (
        <div>
          <button type="button" className="btn" disabled={busy} onClick={commit}>
            {t('dailyImport.commit', { n: summary.days })}
          </button>
        </div>
      )}
    </div>
  );
}

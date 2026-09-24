'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { SapQueueItem } from '@/server/repo/types';
import { commitImportAction, importExcelAction, resolveSapQueueAction } from '@/server/actions';
import { Badge } from '@/components/ui/Badge';
import { CardHeader } from '@/components/ui/Card';
import { IconUpload } from '@/components/icons';

type ImportRowReason = 'no_sap' | 'no_pct' | 'bad_pct' | 'not_assigned';
interface ImportResult {
  ok: boolean;
  error?: string;
  total?: number;
  mapped?: number;
  queued?: number;
  invalid?: number;
  preview?: {
    rowNo: number;
    sapCode: string;
    projectName: string;
    pctActual: number | null;
    status: 'mapped' | 'queued' | 'invalid';
    reason: ImportRowReason | null;
    projectId: number | null;
  }[];
}

export function ImportPanel({
  projects,
  queue,
  months,
  currentMonth,
}: {
  projects: { id: number; name: string; code: string }[];
  queue: SapQueueItem[];
  months: string[];
  currentMonth: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [resolveSel, setResolveSel] = useState<Record<number, number>>({});
  const [month, setMonth] = useState(currentMonth);
  const [committed, setCommitted] = useState<{ imported: number; failed: { projectId: number; reason: 'not_assigned' | 'not_found' }[] } | null>(null);

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = (await importExcelAction(fd)) as ImportResult;
    setResult(res);
    setBusy(false);
    router.refresh();
  }

  async function resolve(id: number) {
    const projectId = resolveSel[id];
    if (!projectId) return;
    await resolveSapQueueAction(id, projectId);
    router.refresh();
  }

  async function commit() {
    const mapped = (result?.preview ?? []).filter(
      (r) => r.status === 'mapped' && r.projectId != null && r.pctActual != null,
    );
    if (mapped.length === 0) return;
    setBusy(true);
    const res = (await commitImportAction(
      month,
      mapped.map((r) => ({ projectId: r.projectId as number, pctActual: r.pctActual as number })),
    )) as { ok: boolean; imported?: number; failed?: { projectId: number; reason: 'not_assigned' | 'not_found' }[] };
    setCommitted(res.ok ? { imported: res.imported ?? 0, failed: res.failed ?? [] } : null);
    setBusy(false);
    router.refresh();
  }

  const pending = queue.filter((q) => q.status === 'pending');

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className="card">
        <div className="bd">
          <label
            className="flex cursor-pointer items-center gap-3 px-4 py-5 text-footnote transition-colors duration-fast hover:bg-fill"
            style={{ border: '1px dashed var(--sep-2)', borderRadius: 'var(--r-md)' }}
          >
            <IconUpload size={20} className="text-brand" />
            <span className="flex-1">
              <span className="font-medium">{t('import.upload')}</span>{' '}
              <span className="en">{t('import.hint')}</span>
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => onFile(e.target.files)}
            />
          </label>
          {busy && <p className="hintline">{t('common.loading')}</p>}
        </div>
      </div>

      {/* Preview result */}
      {result && result.ok && (
        <div className="card overflow-visible">
          <div className="bd">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{t('import.total')}: {result.total}</Badge>
            <Badge tone="ok">{t('import.mapped')}: {result.mapped}</Badge>
            <Badge tone="warn">{t('import.queued')}: {result.queued}</Badge>
            <Badge tone="danger">{t('dataGuard.import.invalid')}: {result.invalid}</Badge>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="inp"
              style={{ width: 'auto', padding: '5px 10px', fontSize: 'var(--t-caption1)' }}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button
              onClick={commit}
              disabled={busy || (result.mapped ?? 0) === 0}
              className="btn"
              style={{ padding: '6px 12px', fontSize: 'var(--t-caption1)' }}
            >
              {t('import.commit')}
            </button>
            {committed && (
              <span className="chip c-ok">
                {t('import.committed', { n: committed.imported })}
              </span>
            )}
          </div>
          {committed && committed.failed.length > 0 && (
            <p className="sumbar bad">
              {t('dataGuard.import.failed', { n: committed.failed.length })}
              {': '}
              {committed.failed.map((f) => `${f.projectId} · ${t(`dataGuard.import.reason.${f.reason}`)}`).join(', ')}
            </p>
          )}
          {result.preview && result.preview.length > 0 && (
            <div className="scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('dataGuard.import.rowNo')}</th>
                    <th>SAP</th>
                    <th>{t('form.projectName')}</th>
                    <th>% TT</th>
                    <th>{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.preview.map((r, i) => (
                    <tr key={i}>
                      <td className="mono">{r.rowNo}</td>
                      <td className="mono">{r.sapCode}</td>
                      <td>{r.projectName}</td>
                      <td>{r.pctActual ?? '-'}</td>
                      <td>
                        {r.status === 'invalid' ? (
                          <Badge tone="danger">{r.reason ? t(`dataGuard.import.reason.${r.reason}`) : t('dataGuard.import.invalid')}</Badge>
                        ) : (
                          <Badge tone={r.status === 'mapped' ? 'ok' : 'warn'}>
                            {r.status === 'mapped' ? t('import.mapped') : t('import.queued')}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </div>
      )}

      {/* SAP queue */}
      <div className="card overflow-visible">
        <CardHeader title={t('import.sapQueue')} />
        <div className="bd">
          {pending.length === 0 ? (
            <p className="empty">{t('common.noData')}</p>
          ) : (
            <ul className="mt-2 flex flex-col">
              {pending.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center gap-2 py-2.5 border-t-[0.5px] border-sep first:border-t-0">
                  <span className="mono">{q.sapCode}</span>
                  <span className="min-w-0 flex-1 truncate text-caption1 text-label3">{q.projectNameHint}</span>
                  <select
                    value={resolveSel[q.id] ?? ''}
                    onChange={(e) => setResolveSel((s) => ({ ...s, [q.id]: Number(e.target.value) }))}
                    className="inp"
                    style={{ width: 'auto', padding: '5px 10px', fontSize: 'var(--t-caption1)' }}
                  >
                    <option value="">{t('common.select')}</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => resolve(q.id)}
                    disabled={!resolveSel[q.id]}
                    className="btn"
                    style={{ padding: '6px 12px', fontSize: 'var(--t-caption1)' }}
                  >
                    {t('import.resolve')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

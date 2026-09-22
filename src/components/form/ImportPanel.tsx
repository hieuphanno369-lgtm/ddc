'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { SapQueueItem } from '@/server/repo/types';
import { commitImportAction, importExcelAction, resolveSapQueueAction } from '@/server/actions';
import { Badge } from '@/components/ui/Badge';
import { IconUpload } from '@/components/icons';

interface ImportResult {
  ok: boolean;
  error?: string;
  total?: number;
  mapped?: number;
  queued?: number;
  preview?: { sapCode: string; projectName: string; pctActual: number | null; status: 'mapped' | 'queued'; projectId: number | null }[];
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
  const [committed, setCommitted] = useState<{ imported: number; skipped: number } | null>(null);

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
    )) as { ok: boolean; imported?: number; skipped?: number };
    setCommitted(res.ok ? { imported: res.imported ?? 0, skipped: res.skipped ?? 0 } : null);
    setBusy(false);
    router.refresh();
  }

  const pending = queue.filter((q) => q.status === 'pending');

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className="card p-4">
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-navy-800 hover:bg-slate-50">
          <IconUpload size={20} className="text-accent" />
          <span className="flex-1">
            <span className="font-medium">{t('import.upload')}</span>
            <span className="ml-2 text-xs text-slate-400">{t('import.hint')}</span>
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => onFile(e.target.files)}
          />
        </label>
        {busy && <p className="mt-2 text-sm text-slate-500">{t('common.loading')}</p>}
      </div>

      {/* Preview result */}
      {result && result.ok && (
        <div className="card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{t('import.total')}: {result.total}</Badge>
            <Badge tone="ok">{t('import.mapped')}: {result.mapped}</Badge>
            <Badge tone="warn">{t('import.queued')}: {result.queued}</Badge>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 px-2 text-xs text-navy-800 focus:outline-none"
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
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-40"
            >
              {t('import.commit')}
            </button>
            {committed && (
              <span className="text-xs text-emerald-600">
                {t('import.committed', { n: committed.imported })}
                {committed.skipped > 0 ? ` · ${t('import.skipped', { n: committed.skipped })}` : ''}
              </span>
            )}
          </div>
          {result.preview && result.preview.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-400">
                    <th className="py-1.5 font-medium">SAP</th>
                    <th className="py-1.5 font-medium">{t('form.projectName')}</th>
                    <th className="py-1.5 font-medium">% TT</th>
                    <th className="py-1.5 font-medium">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.preview.map((r, i) => (
                    <tr key={i}>
                      <td className="py-1.5 font-mono text-xs text-navy-800">{r.sapCode}</td>
                      <td className="py-1.5 text-slate-600">{r.projectName}</td>
                      <td className="py-1.5 text-slate-600">{r.pctActual ?? '-'}</td>
                      <td className="py-1.5">
                        <Badge tone={r.status === 'mapped' ? 'ok' : 'warn'}>
                          {r.status === 'mapped' ? t('import.mapped') : t('import.queued')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SAP queue */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-navy-900">{t('import.sapQueue')}</h3>
        {pending.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">{t('common.noData')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {pending.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="font-mono text-xs text-navy-800">{q.sapCode}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{q.projectNameHint}</span>
                <select
                  value={resolveSel[q.id] ?? ''}
                  onChange={(e) => setResolveSel((s) => ({ ...s, [q.id]: Number(e.target.value) }))}
                  className="h-8 rounded-lg border border-slate-200 px-2 text-xs text-navy-800 focus:outline-none"
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
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-40"
                >
                  {t('import.resolve')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

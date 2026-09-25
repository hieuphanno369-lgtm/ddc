'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FX_CURRENCIES, type FxCurrency } from '@/lib/fx';
import { formatDateTime, formatTon } from '@/lib/format';
import type { ExchangeRate, JobRunEntry } from '@/server/repo/types';
import { deleteExchangeRateAction, fetchRatesNowAction, saveExchangeRateAction } from '@/server/actions-master';
import { Badge } from '@/components/ui/Badge';

export interface ExchangeRateEditorProps {
  months: string[];
  rates: ExchangeRate[];
  lastRun: JobRunEntry | null;
}

/** T6 (Task 7, P2A): tỷ giá theo tháng - tự lấy VCB + sửa tay. */
export function ExchangeRateEditor({ months, rates, lastRun }: ExchangeRateEditorProps) {
  const t = useTranslations();
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null); // key = `${cur}-${month}`
  const [draft, setDraft] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rowErr, setRowErr] = useState<string | null>(null);

  function find(cur: FxCurrency, month: string): ExchangeRate | undefined {
    return rates.find((r) => r.currencyCode === cur && r.yearMonth === month);
  }

  async function fetchNow() {
    setFetching(true);
    setFetchMsg(null);
    try {
      const res = await fetchRatesNowAction();
      if (res.ok) {
        setFetchMsg({ ok: res.status === 'ok', text: t(res.status === 'ok' ? 'fxRates.fetchOk' : 'fxRates.fetchErr', { detail: res.detail }) });
        router.refresh();
      } else {
        setFetchMsg({ ok: false, text: t('dailyEntry.err.forbidden') });
      }
    } finally {
      setFetching(false);
    }
  }

  async function save(cur: FxCurrency, month: string) {
    const rate = Number(draft);
    if (!Number.isFinite(rate) || rate <= 0) {
      setRowErr(t('fxRates.err.invalid'));
      return;
    }
    const res = await saveExchangeRateAction(cur, month, rate);
    if (res.ok) {
      setEditing(null);
      setRowErr(null);
      router.refresh();
    } else {
      setRowErr(res.error === 'Forbidden' ? t('dailyEntry.err.forbidden') : t('fxRates.err.invalid'));
    }
  }

  async function del(cur: FxCurrency, month: string) {
    if (!window.confirm(t('fxRates.confirmDelete', { cur, month }))) return;
    const res = await deleteExchangeRateAction(cur, month);
    if (res.ok) {
      setRowErr(null);
      router.refresh();
    } else {
      setRowErr(res.error === 'Forbidden' ? t('dailyEntry.err.forbidden') : t('dailyEntry.err.generic', { msg: res.error }));
    }
  }

  return (
    <div id="fx-rates" className="space-y-2">
      <p className="hintline">{t('fxRates.hint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn" disabled={fetching} onClick={fetchNow}>
          {t('fxRates.fetchNow')}
        </button>
        <span className="text-caption1 text-label3">
          {lastRun
            ? t('fxRates.lastRun', { time: formatDateTime(lastRun.startedAt), status: t(`fxRates.status.${lastRun.status}`) })
            : t('fxRates.never')}
        </span>
      </div>
      {fetchMsg && <p className={fetchMsg.ok ? 'hintline' : 'sumbar bad'}>{fetchMsg.text}</p>}
      {rowErr && <p className="sumbar bad">{rowErr}</p>}

      <div className="scroll" style={{ maxHeight: 320 }}>
        <table className="tbl sticky">
          <thead>
            <tr>
              <th>{t('fxRates.month')}</th>
              {FX_CURRENCIES.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr key={month}>
                <td>{month}</td>
                {FX_CURRENCIES.map((cur) => {
                  const row = find(cur, month);
                  const key = `${cur}-${month}`;
                  if (editing === key) {
                    return (
                      <td key={cur}>
                        <div className="flex items-center gap-2">
                          <input
                            type="number" step="1" value={draft} onChange={(e) => setDraft(e.target.value)}
                            className="inp" style={{ width: 100 }}
                          />
                          <button type="button" className="btn ghost" onClick={() => save(cur, month)}>{t('fxRates.save')}</button>
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td key={cur}>
                      <div className="flex items-center gap-2">
                        {row ? (
                          <>
                            <span>{formatTon(row.rateToVnd)}</span>
                            <Badge tone={row.source === 'vcb' ? 'info' : 'neutral'}>{t(`fxRates.source.${row.source}`)}</Badge>
                          </>
                        ) : (
                          <span>-</span>
                        )}
                        <button
                          type="button" className="btn ghost"
                          onClick={() => { setEditing(key); setDraft(row ? String(row.rateToVnd) : ''); setRowErr(null); }}
                        >
                          {t('fxRates.edit')}
                        </button>
                        {row && (
                          <button type="button" className="btn ghost" onClick={() => del(cur, month)}>×</button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

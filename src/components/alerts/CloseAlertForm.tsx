'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { closeAlertAction } from '@/server/actions';

/** T11 (Task 8, P2A): đóng alert - bắt buộc ghi "Hành động đã xử lý" (Q12). */
export function CloseAlertForm({ alertId, onDone }: { alertId: number; onDone: () => void }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await closeAlertAction(alertId, action, note);
      if (res.ok) {
        setOpen(false);
        setAction('');
        setNote('');
        onDone();
      } else {
        setError(t(`alertClose.err.${res.error === 'Forbidden' ? 'forbidden' : res.error}`));
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn ghost"
        style={{ padding: '6px 12px', fontSize: 'var(--t-caption1)' }}
      >
        {t('alert.closeAlert')}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2" style={{ minWidth: 260 }}>
      <textarea
        className="inp"
        rows={2}
        placeholder={t('alertClose.action')}
        value={action}
        onChange={(e) => setAction(e.target.value)}
      />
      <textarea
        className="inp"
        rows={2}
        placeholder={t('alertClose.note')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && <p className="hintline" style={{ color: 'var(--danger)' }}>{error}</p>}
      <div className="flex items-center gap-2">
        <button type="button" className="btn" disabled={busy} onClick={confirm}>
          {t('alertClose.confirm')}
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => { setOpen(false); setAction(''); setNote(''); setError(null); }}
        >
          {t('alertClose.cancel')}
        </button>
      </div>
    </div>
  );
}

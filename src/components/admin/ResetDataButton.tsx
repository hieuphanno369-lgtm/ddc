'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { resetDataAction } from '@/server/actions';

export function ResetDataButton() {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await resetDataAction();
      setConfirming(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="btn ghost"
        style={{ color: 'var(--danger)', borderColor: 'var(--danger-fill)', padding: '6px 12px', fontSize: 'var(--t-caption1)' }}
      >
        {t('admin.resetData')}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="chip c-dan">{t('admin.resetConfirm')}</span>
      <button
        onClick={run}
        disabled={busy}
        className="btn danger disabled:opacity-50"
        style={{ padding: '6px 12px', fontSize: 'var(--t-caption1)' }}
      >
        {t('common.delete')}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="btn ghost"
        style={{ padding: '6px 12px', fontSize: 'var(--t-caption1)' }}
      >
        {t('common.cancel')}
      </button>
    </div>
  );
}

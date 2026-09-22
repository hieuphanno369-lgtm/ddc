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
        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        {t('admin.resetData')}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-red-600">{t('admin.resetConfirm')}</span>
      <button
        onClick={run}
        disabled={busy}
        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {t('common.delete')}
      </button>
      <button onClick={() => setConfirming(false)} className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
        {t('common.cancel')}
      </button>
    </div>
  );
}

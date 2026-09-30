'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { IsoDate } from '@/lib/clock';
import { BACKFILL_MAX_MONTHS, BACKFILL_NOTE_MAX, BACKFILL_NOTE_MIN, backfillState } from '@/lib/backfill';
import { formatDmy } from '@/lib/date-input';
import { formatDateTime } from '@/lib/format';
import type { BackfillWindow } from '@/server/repo/types';
import { disableBackfillAction, enableBackfillAction } from '@/server/actions-backfill';
import { Badge } from '@/components/ui/Badge';
import { DateField } from '@/components/ui/DateField';

/**
 * P4 (D-24): thẻ "Nhập bù lịch sử" ở Hồ sơ dự án, CHỈ admin thấy (trang chỉ render khi role admin; server action
 * vẫn kiểm quyền lại). Chọn khoảng ngày + ghi chú, bật; danh sách khoảng đang bật có nút Tắt; lịch sử ở dưới.
 */
export function BackfillPanel({
  projectId,
  windows,
  today,
  locale,
}: {
  projectId: number;
  windows: BackfillWindow[];
  today: IsoDate;
  locale: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [from, setFrom] = useState<IsoDate | ''>('');
  const [to, setTo] = useState<IsoDate | ''>('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const now = new Date();
  const withState = windows.map((w) => ({ w, state: backfillState(w, now) }));
  const active = withState.filter((x) => x.state === 'active');
  const past = withState.filter((x) => x.state !== 'active');

  function errText(code: string): string {
    if (code === 'Forbidden') return t('backfill.errForbidden');
    if (code === 'too_long') return t('backfill.errTooLong', { n: BACKFILL_MAX_MONTHS });
    if (code === 'overlap') return t('backfill.errOverlap');
    if (code === 'Invalid input') return t('backfill.errInvalid');
    if (code === 'Not found') return t('backfill.errNotFound');
    if (code === 'already') return t('backfill.errAlready');
    return t('backfill.errGeneric');
  }

  async function enable() {
    setErr(null);
    if (!from || !to) return setErr(t('backfill.errInvalid'));
    if (from > to) return setErr(t('backfill.errOrder'));
    const trimmed = note.trim();
    if (trimmed.length < BACKFILL_NOTE_MIN || trimmed.length > BACKFILL_NOTE_MAX) return setErr(t('backfill.errNote'));
    setBusy(true);
    try {
      const res = await enableBackfillAction(projectId, from, to, trimmed);
      if (res.ok) {
        setFrom('');
        setTo('');
        setNote('');
        router.refresh();
      } else {
        setErr(errText(res.error));
      }
    } finally {
      setBusy(false);
    }
  }

  async function disable(id: number) {
    setErr(null);
    setBusy(true);
    try {
      const res = await disableBackfillAction(id);
      if (res.ok) router.refresh();
      else setErr(errText(res.error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fsec" data-testid="backfill-panel">
      {/* Tiêu đề một dòng, câu mô tả xuống dòng riêng (mặc định `.fsec>.h` xếp cạnh nhau nên tiêu đề bị ép hẹp, rớt chữ). */}
      <div className="h" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
        <h4>{t('backfill.title')}</h4>
        <p style={{ marginLeft: 0 }}>{t('backfill.hint')}</p>
      </div>

      {active.length === 0 ? (
        <p className="hintline" data-testid="backfill-none">{t('backfill.none')}</p>
      ) : (
        <ul className="space-y-2" data-testid="backfill-active">
          {active.map(({ w }) => (
            <li key={w.id} className="flex flex-wrap items-center gap-2">
              <Badge tone="gold">{t('backfill.active', { from: formatDmy(w.fromDate), to: formatDmy(w.toDate) })}</Badge>
              {w.expiresAt && <span className="hintline">{t('backfill.expires', { date: formatDmy(w.expiresAt.slice(0, 10)) })}</span>}
              <span className="hintline">{w.note}</span>
              <button type="button" className="btn ghost" style={{ padding: '4px 10px', fontSize: 'var(--t-caption1)' }} disabled={busy} onClick={() => disable(w.id)} data-testid="backfill-disable">
                {t('backfill.disable')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="f4 feven" style={{ marginTop: 14 }}>
        <div className="field">
          <span className="lb">{t('backfill.from')}</span>
          <DateField variant="form" allowEmpty max={today} ariaLabel={t('backfill.from')} testId="backfill-from" value={from} onChange={setFrom} />
        </div>
        <div className="field">
          <span className="lb">{t('backfill.to')}</span>
          <DateField variant="form" allowEmpty max={today} ariaLabel={t('backfill.to')} testId="backfill-to" value={to} onChange={setTo} />
        </div>
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <span className="lb">{t('backfill.note')}</span>
          <input
            className="inp"
            value={note}
            maxLength={BACKFILL_NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            data-testid="backfill-note"
          />
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 13 }}>
        <button type="button" className="btn" disabled={busy} onClick={enable} data-testid="backfill-enable">
          {t('backfill.enable')}
        </button>
        {err && <span className="hintline" style={{ color: 'var(--danger)' }} role="alert" data-testid="backfill-error">{err}</span>}
      </div>

      {past.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="sect"><b>{t('backfill.history')}</b><i /></div>
          <ul className="space-y-1">
            {past.map(({ w, state }) => (
              <li key={w.id} className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{state === 'disabled' ? t('backfill.stateDisabled') : t('backfill.stateExpired')}</Badge>
                <span className="hintline">{`${formatDmy(w.fromDate)} - ${formatDmy(w.toDate)}`}</span>
                <span className="hintline">{t('backfill.enabledBy', { who: w.enabledBy, time: formatDateTime(w.enabledAt, locale) })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

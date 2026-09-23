'use client';

import { useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { IsoDate } from '@/lib/clock';
import { isValidIsoDate } from '@/lib/clock';
import {
  KEY_MS_MAX_ROWS, KEY_MS_NAME_MAX, KEY_MS_TONE_VAR, addKeyMilestone, keyMilestoneState, keyMsSuggestions,
  removeKeyMilestone, updateKeyMilestone, type KeyMilestoneDraft, type KeyMsErrors, type KeyMsField,
} from '@/lib/key-milestones';
import { keyMsStateText } from '@/components/project/keyMsText';

const SUGGEST_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];

export function KeyMilestoneEditor({ id, value, onChange, today, errors = {} }: {
  id?: string; value: KeyMilestoneDraft[]; onChange: (rows: KeyMilestoneDraft[]) => void; today: IsoDate; errors?: KeyMsErrors;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const tableRef = useRef<HTMLTableElement>(null);
  const focusLast = useRef(false);
  useEffect(() => {
    if (!focusLast.current) return;
    focusLast.current = false;
    const inputs = tableRef.current?.querySelectorAll<HTMLInputElement>('input[data-ms="name"]');
    const last = inputs?.[inputs.length - 1];
    last?.focus();
    last?.select();
  }, [value.length]);

  const done = value.filter((r) => r.actualDate).length;
  const full = value.length >= KEY_MS_MAX_ROWS;
  const suggestions = keyMsSuggestions(value, SUGGEST_KEYS.map((k) => t(`form.keyMs.suggest.${k}`)));
  const cls = (i: number, f: KeyMsField) => `inp${errors[i]?.includes(f) ? ' bad' : ''}`;
  const b = (c: React.ReactNode) => <b>{c}</b>;

  return (
    <div className="fsec" id={id}>
      <div className="h">
        <h4>{t('form.keyMs.title')}{locale === 'vi' && <>{' '}<span className="en">{t('form.keyMs.titleEn')}</span></>}</h4>
        <p>{t('form.keyMs.subtitle')}</p>
      </div>
      <div className="sumbar" style={{ marginBottom: 12 }}>
        <span>{t.rich('form.keyMs.intro', { b })}</span>
        <span>{t.rich('form.keyMs.count', { count: value.length, done, b })}</span>
      </div>
      <div className="scroll">
        <table className="tbl" ref={tableRef}>
          <thead>
            <tr>
              <th style={{ width: 34 }}>#</th>
              <th>{t('form.keyMs.colName')}</th>
              <th style={{ width: 160 }}>{t('form.keyMs.colPlanned')} <span className="req">*</span></th>
              <th style={{ width: 160 }}>{t('form.keyMs.colActual')}</th>
              <th style={{ width: 150 }}>{t('form.keyMs.colStatus')}</th>
              <th style={{ width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {value.map((r, i) => {
              const st = isValidIsoDate(r.plannedDate)
                ? keyMilestoneState(r.plannedDate, r.actualDate && isValidIsoDate(r.actualDate) ? r.actualDate : null, today)
                : null;
              const color = st ? KEY_MS_TONE_VAR[st.tone] : 'var(--label3)';
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td><input data-ms="name" className={cls(i, 'name')} value={r.name} maxLength={KEY_MS_NAME_MAX} onChange={(e) => onChange(updateKeyMilestone(value, i, { name: e.target.value }))} /></td>
                  <td><input type="date" className={cls(i, 'plannedDate')} value={r.plannedDate} onChange={(e) => onChange(updateKeyMilestone(value, i, { plannedDate: e.target.value }))} /></td>
                  <td><input type="date" className={cls(i, 'actualDate')} value={r.actualDate ?? ''} onChange={(e) => onChange(updateKeyMilestone(value, i, { actualDate: e.target.value || null }))} /></td>
                  <td><span className="chip" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>{st ? keyMsStateText(t, st) : '-'}</span></td>
                  <td>
                    <button type="button" className="btn ghost" title={t('form.keyMs.remove')} aria-label={t('form.keyMs.remove')} style={{ padding: '5px 9px', minWidth: 0 }} onClick={() => onChange(removeKeyMilestone(value, i))}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 13 }}>
        <button type="button" className="btn ghost" style={{ padding: '7px 13px' }} disabled={full}
          onClick={() => { focusLast.current = true; onChange(addKeyMilestone(value, t('form.keyMs.newName', { n: value.length + 1 }), today)); }}>
          {t('form.keyMs.add')}
        </button>
        <span className="hintline" style={{ margin: '0 4px 0 6px' }}>{t('form.keyMs.suggestLabel')}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {suggestions.map((s) => (
            <button key={s} type="button" className="chip c-plain" style={{ border: 'none', cursor: 'pointer' }} disabled={full} onClick={() => onChange(addKeyMilestone(value, s, today))}>{`+ ${s}`}</button>
          ))}
        </div>
        {full && <span className="hintline">{t('form.keyMs.limit', { n: KEY_MS_MAX_ROWS })}</span>}
      </div>
      <p className="hintline" style={{ marginTop: 10 }}>{t.rich('form.keyMs.naming', { b })}</p>
    </div>
  );
}

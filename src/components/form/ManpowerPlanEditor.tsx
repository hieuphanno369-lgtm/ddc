'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { addMonths, type IsoDate } from '@/lib/clock';
import type { ManpowerPlanMonthRow, Shift, ShiftRatio } from '@/server/repo/types';
import {
  addMonth, initPlanState, parsePcts, removeMonth, resetRow, setCell, setPct, setTotal, toPlanInput,
} from './manpowerPlanState';
import { saveManpowerPlanAction } from '@/server/actions-entry';

/** P3C-A (T5): bảng nhập kế hoạch nhân lực theo tháng × ca, chia theo tỷ lệ, giữ ô sửa tay. */
export function ManpowerPlanEditor(p: {
  projectId: number;
  shifts: Shift[];
  months: ManpowerPlanMonthRow[];
  ratios: ShiftRatio[];
  today: IsoDate;
}) {
  const { projectId, shifts, months, ratios, today } = p;
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [state, setState] = useState(() => initPlanState(shifts, months, ratios));
  const [newMonth, setNewMonth] = useState(() => {
    const last = [...state.rows].map((r) => r.yearMonth).sort().pop();
    return last ? addMonths(last, 1) : today.slice(0, 7);
  });
  const [addErr, setAddErr] = useState<'duplicate' | 'too_many' | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const pcts = parsePcts(state.pctInputs);
  const pctSum = state.pctInputs.reduce((sum, v) => sum + (Number(v.trim()) || 0), 0);
  const input = toPlanInput(state);

  function onAddMonth() {
    const r = addMonth(state, newMonth);
    if (r === 'duplicate' || r === 'too_many') { setAddErr(r); return; }
    if (r === 'invalid') return;
    setAddErr(null);
    setState(r);
    setNewMonth(addMonths(newMonth, 1));
    setMsg(null);
  }

  async function save() {
    if (!input) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await saveManpowerPlanAction(projectId, input);
      if (res.ok) {
        setMsg({ tone: 'ok', text: (res.changedMonths === 0 && !res.ratioChanged) ? t('manpowerPlan.noChange') : t('manpowerPlan.saved', { n: res.changedMonths }) });
        router.refresh();
      } else if (res.error === 'invalid_plan') {
        setMsg({ tone: 'bad', text: t('manpowerPlan.err.invalid') });
      } else if (res.error === 'Forbidden') {
        setMsg({ tone: 'bad', text: t('manpowerPlan.err.forbidden') });
      } else {
        setMsg({ tone: 'bad', text: t('manpowerPlan.err.generic', { msg: res.error }) });
      }
    } catch {
      setMsg({ tone: 'bad', text: t('manpowerPlan.err.generic', { msg: '' }) });
    } finally {
      setSaving(false);
    }
  }

  if (shifts.length === 0) {
    return (
      <div>
        <div className="sect"><b>{t('manpowerPlan.title')}</b><i /></div>
        <p className="empty">{t('manpowerPlan.noShift')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="sect"><b>{t('manpowerPlan.title')}</b><i /></div>
      <p className="hintline">{t('manpowerPlan.help')}</p>
      <div className="scroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('manpowerPlan.colMonth')}</th>
              {shifts.map((s) => <th key={s.code}>{locale === 'vi' ? s.nameVi : s.nameEn}</th>)}
              <th>{t('manpowerPlan.colTotal')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{t('manpowerPlan.ratioRow')}</td>
              {state.pctInputs.map((v, i) => (
                <td key={i}>
                  <input
                    type="number" step="0.1" min={0} max={100}
                    value={v}
                    onChange={(e) => setState(setPct(state, i, e.target.value))}
                    className="inp"
                    style={{ width: 72 }}
                  />
                </td>
              ))}
              <td className={pcts == null ? 'inp bad' : ''}>{pctSum}%</td>
              <td />
            </tr>
            {pcts == null && (
              <tr>
                <td />
                <td colSpan={shifts.length + 2} className="hintline" style={{ color: 'var(--danger)' }}>{t('manpowerPlan.err.ratioSum')}</td>
              </tr>
            )}
            {state.rows.map((r, ri) => {
              const allManual = r.cells.every((c) => c.isManual);
              const manualSum = r.cells.filter((c) => c.isManual).reduce((s, c) => s + c.planned, 0);
              const hasManual = r.cells.some((c) => c.isManual);
              return (
                <tr key={r.yearMonth}>
                  <td>{`${r.yearMonth.slice(5, 7)}/${r.yearMonth.slice(0, 4)}`}</td>
                  {r.cells.map((c, ci) => (
                    <td key={ci}>
                      <input
                        type="number" min={0}
                        value={String(c.planned)}
                        onChange={(e) => setState(setCell(state, ri, ci, e.target.value))}
                        className="inp"
                        data-manual={c.isManual ? '1' : undefined}
                        title={c.isManual ? t('manpowerPlan.manualHint') : undefined}
                        style={c.isManual ? { borderColor: 'var(--accent)', fontWeight: 650, width: 88 } : { width: 88 }}
                      />
                    </td>
                  ))}
                  <td>
                    <input
                      type="number" min={0}
                      value={r.totalInput}
                      readOnly={allManual}
                      onChange={(e) => setState(setTotal(state, ri, e.target.value))}
                      onBlur={() => {
                        const trimmed = r.totalInput.trim();
                        const validFormat = /^\d+$/.test(trimmed);
                        if (validFormat && !r.error) return;
                        setState((s) => ({
                          ...s,
                          rows: s.rows.map((row, i) => (i === ri ? { ...row, totalInput: String(row.cells.reduce((sum, c) => sum + c.planned, 0)), error: null } : row)),
                        }));
                      }}
                      className={`inp${r.error ? ' bad' : ''}`}
                      style={{ width: 88 }}
                    />
                    {r.error === 'below_manual' && <p className="hintline" style={{ color: 'var(--danger)' }}>{t('manpowerPlan.err.belowManual', { manual: manualSum })}</p>}
                    {r.error === 'all_manual' && <p className="hintline" style={{ color: 'var(--danger)' }}>{t('manpowerPlan.err.allManual')}</p>}
                  </td>
                  <td>
                    {hasManual && <button type="button" className="btn ghost" onClick={() => setState(resetRow(state, ri))}>{t('manpowerPlan.recalc')}</button>}
                    <button type="button" className="btn ghost" onClick={() => setState(removeMonth(state, ri))}>{t('manpowerPlan.removeMonth')}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <input type="month" value={newMonth} onChange={(e) => { setNewMonth(e.target.value); setAddErr(null); }} className="inp" style={{ width: 140 }} />
        <button type="button" className="btn ghost" onClick={onAddMonth}>{t('manpowerPlan.addMonth')}</button>
        {addErr && <span className="hintline" style={{ color: 'var(--danger)' }}>{t(`manpowerPlan.err.${addErr === 'duplicate' ? 'duplicate' : 'tooMany'}`)}</span>}
        <button type="button" className="btn" onClick={save} disabled={saving || input == null}>{t('manpowerPlan.save')}</button>
        <span className="hintline">{t('manpowerPlan.legend')}</span>
      </div>
      {msg && (
        <div className={`sumbar ${msg.tone === 'bad' ? 'bad' : 'good'}`} style={{ marginTop: 8 }}>
          <span>{msg.text}</span>
        </div>
      )}
    </div>
  );
}

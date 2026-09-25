'use client';

import { useLocale, useTranslations } from 'next-intl';
import { STAGE_ORDER, validateStageWeights } from '@/lib/stages';
import { stageKey } from '@/lib/labels';
import { Switch } from '@/components/ui/Switch';
import type { StageWeightInput } from '@/server/repo/types';

/** Task 7 (P3A, G-6): bảng trọng số 7 giai đoạn - Chi tiết dự án dùng làm bảng "Chuỗi giá trị". */
export function StageWeightEditor(p: {
  value: StageWeightInput[];
  onChange: (rows: StageWeightInput[]) => void;
  onApplyPreset?: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { value, onChange, onApplyPreset } = p;
  const check = validateStageWeights(value);
  const fmt1 = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);

  function updateRow(code: string, patch: Partial<StageWeightInput>) {
    onChange(value.map((r) => (r.stageCode === code ? { ...r, ...patch } : r)));
  }

  return (
    <div>
      <div className="scroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('projectForm.weights.colStage')}</th>
              <th>{t('projectForm.weights.colWeight')}</th>
              <th>{t('projectForm.weights.colApplicable')}</th>
              <th>{t('projectForm.weights.colMax')}</th>
            </tr>
          </thead>
          <tbody>
            {STAGE_ORDER.map((code, i) => {
              const row = value.find((r) => r.stageCode === code);
              const weightPct = row?.weightPct ?? 0;
              const applicable = row?.applicable ?? false;
              return (
                <tr key={code} style={applicable ? undefined : { opacity: 0.45 }}>
                  <td>{i + 1}</td>
                  <td>{t(stageKey[code])}</td>
                  <td>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      max={100}
                      value={weightPct}
                      onChange={(e) => updateRow(code, { weightPct: Number(e.target.value) })}
                      className="inp"
                      style={{ width: 88, textAlign: 'right' }}
                    />
                  </td>
                  <td>
                    <Switch
                      checked={applicable}
                      onChange={(v) => updateRow(code, { applicable: v })}
                      label={t('projectForm.weights.colApplicable')}
                    />
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{applicable ? weightPct : 0}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={`sumbar ${check.ok ? 'good' : 'bad'}`}>
        {check.ok && <span>{t('projectForm.weights.ok')}</span>}
        {!check.ok && check.error === 'empty' && <span>{t('projectForm.weights.empty')}</span>}
        {!check.ok && check.error !== 'empty' && (
          <span>{t('projectForm.weights.bad', { sum: fmt1(check.total), diff: fmt1(Math.abs(check.total - 100)) })}</span>
        )}
        <span>{t('projectForm.weights.note')}</span>
        <span>{t('projectForm.weights.nextSave')}</span>
      </div>
      {onApplyPreset && (
        <button type="button" className="btn ghost" onClick={onApplyPreset}>
          {t('projectForm.weights.applyPreset')}
        </button>
      )}
    </div>
  );
}

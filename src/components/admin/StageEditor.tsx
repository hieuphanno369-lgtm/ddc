'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Stage, StageCalcMode, StageCode, StageSide } from '@/server/repo/types';
import { saveStageAction, setStageActiveAction } from '@/server/actions-master';

interface RowDraft {
  sortOrder: string;
  nameVi: string;
  nameEn: string;
  side: StageSide;
  calcMode: StageCalcMode;
}

const EMPTY_ROW: RowDraft = { sortOrder: '', nameVi: '', nameEn: '', side: 'left', calcMode: 'manual' };

function toDraft(s: Stage): RowDraft {
  return { sortOrder: String(s.sortOrder), nameVi: s.nameVi, nameEn: s.nameEn, side: s.side ?? 'left', calcMode: s.calcMode };
}

/** P7-C2 Task 8: thêm/sửa giai đoạn chuỗi giá trị, ngừng dùng/dùng lại - khuôn `FactoryEditor.tsx`. */
export function StageEditor({ stages }: { stages: Stage[] }) {
  const router = useRouter();
  const t = useTranslations();
  const sorted = [...stages].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  const [drafts, setDrafts] = useState<Record<StageCode, RowDraft>>(() =>
    Object.fromEntries(stages.map((s) => [s.code, toDraft(s)])),
  );
  const [newRow, setNewRow] = useState<RowDraft>(EMPTY_ROW);
  const [err, setErr] = useState<string | null>(null);

  function draftOf(s: Stage): RowDraft {
    return drafts[s.code] ?? toDraft(s);
  }

  function setDraft(s: Stage, patch: Partial<RowDraft>) {
    setDrafts((d) => ({ ...d, [s.code]: { ...(d[s.code] ?? toDraft(s)), ...patch } }));
  }

  async function save(code: StageCode | undefined, draft: RowDraft) {
    setErr(null);
    const sortOrder = Number(draft.sortOrder);
    if (!draft.nameVi.trim() || !draft.nameEn.trim() || !Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > 999) {
      setErr(t('stageAdmin.err.invalid'));
      return;
    }
    const res = await saveStageAction({
      code, nameVi: draft.nameVi, nameEn: draft.nameEn, side: draft.side, sortOrder, calcMode: draft.calcMode,
    });
    if (res.ok) {
      if (code == null) setNewRow(EMPTY_ROW);
      router.refresh();
    } else if (res.error === 'duplicate_name' || res.error === 'too_many') {
      setErr(t(`stageAdmin.err.${res.error}`));
    } else {
      setErr(t(res.error === 'Invalid input' ? 'stageAdmin.err.invalid' : 'stageAdmin.err.generic'));
    }
  }

  async function toggleActive(s: Stage) {
    setErr(null);
    const res = await setStageActiveAction(s.code, s.isActive === false);
    if (res.ok) router.refresh();
    else if (res.error === 'in_use') setErr(t('stageAdmin.err.in_use', { n: res.count ?? 0 }));
    else if (res.error === 'last_active') setErr(t('stageAdmin.err.last_active'));
    else setErr(t('stageAdmin.err.generic'));
  }

  function cells(draft: RowDraft, onChange: (patch: Partial<RowDraft>) => void) {
    return (
      <>
        <td>
          <input
            type="number" step="1" min="1" max="999" value={draft.sortOrder}
            onChange={(e) => onChange({ sortOrder: e.target.value })}
            className="inp" aria-label={t('stageAdmin.order')}
          />
        </td>
        <td>
          <input value={draft.nameVi} onChange={(e) => onChange({ nameVi: e.target.value })} className="inp" aria-label={t('stageAdmin.nameVi')} />
        </td>
        <td>
          <input value={draft.nameEn} onChange={(e) => onChange({ nameEn: e.target.value })} className="inp" aria-label={t('stageAdmin.nameEn')} />
        </td>
        <td>
          <select
            value={draft.side} onChange={(e) => onChange({ side: e.target.value as StageSide })}
            className="inp" aria-label={t('stageAdmin.side')}
          >
            <option value="left">{t('stageAdmin.left')}</option>
            <option value="right">{t('stageAdmin.right')}</option>
          </select>
        </td>
        <td>
          <select
            value={draft.calcMode} onChange={(e) => onChange({ calcMode: e.target.value as StageCalcMode })}
            className="inp" aria-label={t('stageAdmin.calcMode')}
          >
            <option value="manual">{t('stageAdmin.manual')}</option>
            <option value="volume">{t('stageAdmin.volume')}</option>
          </select>
        </td>
      </>
    );
  }

  return (
    <div className="space-y-2">
      {err && <p className="sumbar bad">{err}</p>}
      <div className="scroll" style={{ maxHeight: 420 }}>
        <table className="tbl sticky">
          <thead>
            <tr>
              <th>{t('stageAdmin.order')}</th>
              <th>{t('stageAdmin.nameVi')}</th>
              <th>{t('stageAdmin.nameEn')}</th>
              <th>{t('stageAdmin.side')}</th>
              <th>{t('stageAdmin.calcMode')}</th>
              <th>{t('stageAdmin.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const draft = draftOf(s);
              const active = s.isActive !== false;
              return (
                <tr key={s.code}>
                  {cells(draft, (patch) => setDraft(s, patch))}
                  <td>{active ? t('stageAdmin.active') : t('stageAdmin.inactive')}</td>
                  <td>
                    <div className="flex gap-2">
                      <button type="button" className="btn ghost" onClick={() => save(s.code, draft)}>
                        {t('stageAdmin.save')}
                      </button>
                      <button type="button" className="btn ghost" onClick={() => toggleActive(s)}>
                        {active ? t('stageAdmin.deactivate') : t('stageAdmin.activate')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr>
              {cells(newRow, (patch) => setNewRow((r) => ({ ...r, ...patch })))}
              <td />
              <td>
                <button type="button" className="btn" onClick={() => save(undefined, newRow)}>
                  {t('stageAdmin.add')}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="hintline">{t('stageAdmin.hint')}</p>
    </div>
  );
}

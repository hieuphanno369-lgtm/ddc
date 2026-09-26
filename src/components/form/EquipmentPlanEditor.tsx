'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Equipment, ProjectEquipmentPlan, ProjectWorkItem } from '@/server/repo/types';
import {
  EQUIP_PLAN_MAX_ROWS, nextUnitNo, normalizeEquipmentPlans, toEquipmentPlanDraft, validateEquipmentPlans,
  type EquipPlanErrors, type EquipPlanField, type EquipmentPlanDraft,
} from '@/lib/equipment-plan';
import { saveEquipmentPlansAction } from '@/server/actions-entry';

/** Task 12 (P3A, T14): bảng nhập kế hoạch sử dụng thiết bị theo từng chiếc - nguồn Gantt thiết bị. */
export function EquipmentPlanEditor(p: {
  projectId: number;
  plans: ProjectEquipmentPlan[];
  equipments: Equipment[];
  workItems: ProjectWorkItem[];
}) {
  const { projectId, plans, equipments, workItems } = p;
  const t = useTranslations();
  const router = useRouter();

  const [rows, setRows] = useState<EquipmentPlanDraft[]>(() => plans.map(toEquipmentPlanDraft));
  const [errors, setErrors] = useState<EquipPlanErrors>({});
  const [overlaps, setOverlaps] = useState<[number, number][]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  function update(i: number, patch: Partial<EquipmentPlanDraft>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
    setMsg(null);
  }

  function addRow() {
    const equipmentId = equipments[0] ? String(equipments[0].id) : '';
    setRows((r) => [...r, { equipmentId, unitNo: String(nextUnitNo(r, equipmentId)), workItemId: '', plannedStart: '', plannedFinish: '', note: '' }]);
  }

  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
    setMsg(null);
  }

  async function save() {
    const input = normalizeEquipmentPlans(rows);
    const equipmentIds = new Set(equipments.map((e) => e.id));
    const workItemIds = new Set(workItems.map((w) => w.id));
    const check = validateEquipmentPlans(input, { equipmentIds, workItemIds });
    setErrors(check.errors);
    setOverlaps(check.overlaps);
    if (!check.ok) {
      setMsg({ tone: 'bad', text: t('equipmentPlan.err.invalid') });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await saveEquipmentPlansAction(projectId, input);
      if (res.ok) {
        setMsg({ tone: 'ok', text: t('equipmentPlan.saved', { n: res.count }) });
        router.refresh();
      } else if (res.error === 'invalid_rows') {
        setErrors(res.errors ?? {});
        setOverlaps(res.overlaps ?? []);
        setMsg({ tone: 'bad', text: t('equipmentPlan.err.invalid') });
      } else {
        const key = `equipmentPlan.err.${res.error === 'Forbidden' ? 'forbidden' : 'generic'}`;
        setMsg({ tone: 'bad', text: t(key, { msg: res.error }) });
      }
    } finally {
      setSaving(false);
    }
  }

  const units = new Set(rows.map((r) => `${r.equipmentId}#${r.unitNo}`)).size;
  const cellCls = (i: number, field: EquipPlanField) => (errors[i]?.includes(field) ? 'inp bad' : 'inp');

  if (equipments.length === 0) {
    return (
      <div>
        <div className="sect"><b>{t('equipmentPlan.title')}</b><i /></div>
        <p className="empty">{t('equipmentPlan.noEquipment')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="sect"><b>{t('equipmentPlan.title')}</b><i /></div>
      <p className="hintline">{t('equipmentPlan.help')}</p>
      <div className="scroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('equipmentPlan.colEquipment')}</th>
              <th>{t('equipmentPlan.colUnit')}</th>
              <th>{t('equipmentPlan.colWorkItem')}</th>
              <th>{t('equipmentPlan.colStart')}</th>
              <th>{t('equipmentPlan.colFinish')}</th>
              <th>{t('equipmentPlan.colNote')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>
                  <select value={r.equipmentId} onChange={(e) => update(i, { equipmentId: e.target.value })} className={cellCls(i, 'equipmentId')}>
                    {equipments.map((eq) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
                    {!equipments.some((eq) => String(eq.id) === r.equipmentId) && r.equipmentId && (
                      <option value={r.equipmentId}>#{r.equipmentId}</option>
                    )}
                  </select>
                </td>
                <td>
                  <input type="number" min={1} max={99} value={r.unitNo} onChange={(e) => update(i, { unitNo: e.target.value })} className={cellCls(i, 'unitNo')} style={{ width: 80 }} />
                </td>
                <td>
                  <select value={r.workItemId} onChange={(e) => update(i, { workItemId: e.target.value })} className={cellCls(i, 'workItemId')}>
                    <option value="">{t('equipmentGantt.noWorkItem')}</option>
                    {workItems.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </td>
                <td>
                  <input type="date" value={r.plannedStart} onChange={(e) => update(i, { plannedStart: e.target.value })} className={cellCls(i, 'plannedStart')} />
                </td>
                <td>
                  <input type="date" value={r.plannedFinish} onChange={(e) => update(i, { plannedFinish: e.target.value })} className={cellCls(i, 'plannedFinish')} />
                </td>
                <td>
                  <input value={r.note} maxLength={200} onChange={(e) => update(i, { note: e.target.value })} className={cellCls(i, 'note')} />
                </td>
                <td>
                  <button type="button" className="btn ghost" onClick={() => removeRow(i)}>{t('equipmentPlan.remove')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <button type="button" className="btn ghost" onClick={addRow} disabled={rows.length >= EQUIP_PLAN_MAX_ROWS}>
          {t('equipmentPlan.add')}
        </button>
        <button type="button" className="btn" onClick={save} disabled={saving}>
          {t('equipmentPlan.save')}
        </button>
        <span className="hintline">{t('equipmentPlan.count', { n: rows.length, units })}</span>
        {rows.length >= EQUIP_PLAN_MAX_ROWS && <span className="hintline">{t('equipmentPlan.limit', { n: EQUIP_PLAN_MAX_ROWS })}</span>}
      </div>
      {msg && (
        <div className={`sumbar ${msg.tone === 'bad' ? 'bad' : 'good'}`} style={{ marginTop: 8 }}>
          <span>{msg.text}</span>
          {msg.tone === 'bad' && overlaps.map(([a, b], idx) => (
            <span key={idx}>{t('equipmentPlan.err.overlap', { a: a + 1, b: b + 1 })}</span>
          ))}
        </div>
      )}
    </div>
  );
}

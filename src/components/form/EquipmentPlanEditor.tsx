'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { Equipment, EquipmentPlanSegment, EquipmentQuota } from '@/server/repo/types';
import { addDaysIso, isValidIsoDate } from '@/lib/clock';
import { formatDate } from '@/lib/format';
import {
  EQUIP_GROUP_MAX, EQUIP_PLAN_MAX_ROWS, EQUIP_QTY_MAX, normalizeEquipmentGroups, toEquipmentGroupDrafts,
  validateEquipmentPlan, type EquipGroupField, type EquipPlanCheck, type EquipSegField, type EquipmentGroupDraft,
} from '@/lib/equipment-plan';
import { saveEquipmentPlansAction } from '@/server/actions-entry';

/** P3C-A (T4): bảng nhập kế hoạch dùng thiết bị theo loại (Tổng SL + các đợt) - nguồn Gantt thiết bị. */
export function EquipmentPlanEditor(p: {
  projectId: number;
  quotas: EquipmentQuota[];
  segments: EquipmentPlanSegment[];
  equipments: Equipment[];
}) {
  const { projectId, quotas, segments, equipments } = p;
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [groups, setGroups] = useState<EquipmentGroupDraft[]>(() => toEquipmentGroupDrafts(quotas, segments));
  const [check, setCheck] = useState<EquipPlanCheck | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  // Danh sách chọn thiết bị = thiết bị đang dùng ∪ thiết bị đã ngừng dùng mà còn quota cũ.
  const activeIds = new Set(equipments.map((e) => e.id));
  const options = [
    ...equipments.map((e) => ({ id: e.id, name: e.name })),
    ...quotas
      .filter((q) => !activeIds.has(q.equipmentId))
      .map((q) => ({ id: q.equipmentId, name: `${q.equipmentName} ${t('equipmentPlan.inactive')}` })),
  ];
  const equipmentIds = new Set(options.map((o) => o.id));

  function optionsForGroup(gi: number) {
    const usedElsewhere = new Set(groups.filter((_, idx) => idx !== gi).map((g) => Number(g.equipmentId)));
    return options.filter((o) => !usedElsewhere.has(o.id) || Number(groups[gi].equipmentId) === o.id);
  }

  function updateGroup(gi: number, patch: Partial<EquipmentGroupDraft>) {
    setGroups((g) => g.map((row, idx) => (idx === gi ? { ...row, ...patch } : row)));
    setMsg(null);
  }

  function addGroup() {
    const used = new Set(groups.map((g) => Number(g.equipmentId)));
    const next = options.find((o) => !used.has(o.id));
    if (!next) return;
    setGroups((g) => [...g, { equipmentId: String(next.id), totalQty: '', segments: [] }]);
    setMsg(null);
  }

  function removeGroup(gi: number) {
    setGroups((g) => g.filter((_, idx) => idx !== gi));
    setMsg(null);
  }

  function addSegment(gi: number) {
    setGroups((g) => g.map((grp, idx) => {
      if (idx !== gi) return grp;
      const last = grp.segments[grp.segments.length - 1];
      const from = last && isValidIsoDate(last.to) ? addDaysIso(last.to, 1) : '';
      return { ...grp, segments: [...grp.segments, { from, to: '', qty: '1' }] };
    }));
    setMsg(null);
  }

  function updateSegment(gi: number, si: number, patch: Partial<{ from: string; to: string; qty: string }>) {
    setGroups((g) => g.map((grp, idx) => {
      if (idx !== gi) return grp;
      return { ...grp, segments: grp.segments.map((s, sidx) => (sidx === si ? { ...s, ...patch } : s)) };
    }));
    setMsg(null);
  }

  function removeSegment(gi: number, si: number) {
    setGroups((g) => g.map((grp, idx) => (idx === gi ? { ...grp, segments: grp.segments.filter((_, sidx) => sidx !== si) } : grp)));
    setMsg(null);
  }

  const totalSegments = groups.reduce((s, g) => s + g.segments.length, 0);
  const groupCls = (gi: number, f: EquipGroupField) => `inp${check?.groupErrors[gi]?.includes(f) ? ' bad' : ''}`;
  const segCls = (gi: number, si: number, f: EquipSegField) => `inp${check?.segmentErrors[`${gi}:${si}`]?.includes(f) ? ' bad' : ''}`;

  async function save() {
    const input = normalizeEquipmentGroups(groups);
    const result = validateEquipmentPlan(input, { equipmentIds });
    setCheck(result);
    if (!result.ok) {
      setMsg({ tone: 'bad', text: t('equipmentPlan.err.invalid') });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await saveEquipmentPlansAction(projectId, input);
      if (res.ok) {
        setMsg({ tone: 'ok', text: t('equipmentPlan.saved', { groups: res.groups, segments: res.segments }) });
        router.refresh();
      } else if (res.error === 'invalid_plan') {
        setCheck(res.check ?? null);
        setMsg({ tone: 'bad', text: t('equipmentPlan.err.invalid') });
      } else if (res.error === 'Forbidden') {
        setMsg({ tone: 'bad', text: t('equipmentPlan.err.forbidden') });
      } else {
        setMsg({ tone: 'bad', text: t('equipmentPlan.err.generic', { msg: res.error }) });
      }
    } catch {
      setMsg({ tone: 'bad', text: t('equipmentPlan.err.generic', { msg: '' }) });
    } finally {
      setSaving(false);
    }
  }

  if (equipments.length === 0 && quotas.length === 0) {
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
      {groups.map((g, gi) => (
        <div key={gi} style={{ marginTop: 14 }}>
          <div className="inline" style={{ flexWrap: 'wrap', gap: 9 }}>
            <select
              value={g.equipmentId}
              onChange={(e) => updateGroup(gi, { equipmentId: e.target.value })}
              className={groupCls(gi, 'equipmentId')}
            >
              {optionsForGroup(gi).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <input
              type="number" min={1} max={EQUIP_QTY_MAX}
              value={g.totalQty}
              onChange={(e) => updateGroup(gi, { totalQty: e.target.value })}
              className={groupCls(gi, 'totalQty')}
              style={{ width: 100 }}
              placeholder={t('equipmentPlan.colTotal')}
            />
            <button type="button" className="btn ghost" onClick={() => removeGroup(gi)}>{t('equipmentPlan.removeGroup')}</button>
          </div>
          {g.segments.length === 0 ? (
            <p className="hintline">{t('equipmentPlan.noSegment')}</p>
          ) : (
            <div className="scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('equipmentPlan.colFrom')}</th>
                    <th>{t('equipmentPlan.colTo')}</th>
                    <th>{t('equipmentPlan.colQty')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {g.segments.map((s, si) => (
                    <tr key={si}>
                      <td>{si + 1}</td>
                      <td>
                        <input type="date" value={s.from} onChange={(e) => updateSegment(gi, si, { from: e.target.value })} className={segCls(gi, si, 'from')} />
                      </td>
                      <td>
                        <input type="date" value={s.to} onChange={(e) => updateSegment(gi, si, { to: e.target.value })} className={segCls(gi, si, 'to')} />
                      </td>
                      <td>
                        <input type="number" min={1} max={EQUIP_QTY_MAX} value={s.qty} onChange={(e) => updateSegment(gi, si, { qty: e.target.value })} className={segCls(gi, si, 'qty')} style={{ width: 80 }} />
                      </td>
                      <td>
                        <button type="button" className="btn ghost" onClick={() => removeSegment(gi, si)}>{t('equipmentPlan.removeSegment')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button type="button" className="btn ghost" style={{ marginTop: 6 }} onClick={() => addSegment(gi)}>{t('equipmentPlan.addSegment')}</button>
        </div>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 14 }}>
        <button
          type="button" className="btn ghost" onClick={addGroup}
          disabled={groups.length >= EQUIP_GROUP_MAX || options.every((o) => groups.some((g) => Number(g.equipmentId) === o.id))}
        >
          {t('equipmentPlan.addGroup')}
        </button>
        <button type="button" className="btn" onClick={save} disabled={saving}>
          {t('equipmentPlan.save')}
        </button>
        <span className="hintline">{t('equipmentPlan.count', { groups: groups.length, segments: totalSegments })}</span>
        {totalSegments >= EQUIP_PLAN_MAX_ROWS && <span className="hintline">{t('equipmentPlan.limit', { n: EQUIP_PLAN_MAX_ROWS })}</span>}
      </div>
      {msg && (
        <div className={`sumbar ${msg.tone === 'bad' ? 'bad' : 'good'}`} style={{ marginTop: 8 }}>
          <span>{msg.text}</span>
          {msg.tone === 'bad' && check?.overloads.map((o, idx) => {
            const name = options.find((x) => x.id === o.equipmentId)?.name ?? `#${o.equipmentId}`;
            return (
              <span key={idx}>
                {t('equipmentPlan.err.overload', { name, from: formatDate(o.from, locale), to: formatDate(o.to, locale), used: o.used, total: o.total })}
              </span>
            );
          })}
          {msg.tone === 'bad' && check?.tooManySegments && <span>{t('equipmentPlan.limit', { n: EQUIP_PLAN_MAX_ROWS })}</span>}
        </div>
      )}
    </div>
  );
}

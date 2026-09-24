'use client';

import { Fragment, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { IsoDate } from '@/lib/clock';
import { isInWindow } from '@/lib/daily-entry';
import type { Contractor, Equipment, FactDailyEquipmentUsage, FactDailyManpowerShift, Shift } from '@/server/repo/types';
import { saveDailyResourcesAction, type DailySaveError } from '@/server/actions-entry';
import { ContractorJoinBlock } from './ContractorJoinBlock';
import { DailyImportBlock } from './DailyImportBlock';
import {
  buildEquipmentGrid,
  buildManpowerGrid,
  gridToPayload,
  manpowerTotals,
  type EquipmentGridRow,
  type ManpowerGridRow,
} from './resourceEntryState';
import { Badge } from '@/components/ui/Badge';

export interface ResourceEntryPanelProps {
  projectId: number;
  masterCode: string;
  date: IsoDate;
  today: IsoDate;
  entryWindow: { min: IsoDate | null; max: IsoDate };
  monthLocked: boolean;
  members: Contractor[];
  allContractors: Contractor[];
  shifts: Shift[];
  equipments: Equipment[];
  manpower: FactDailyManpowerShift[];
  equipment: FactDailyEquipmentUsage[];
}

let newRowSeq = 0;

/**
 * Bước "Nhân lực & Thiết bị" (B, ke-hoach.md P2A). Task 3: khối nhà thầu tham gia (G-18).
 * Task 4: lưới nhập nhân lực theo ca + thiết bị theo ngày. Task 5: import Excel + file mẫu.
 */
export function ResourceEntryPanel({
  projectId,
  date,
  today,
  entryWindow,
  monthLocked,
  members,
  allContractors,
  shifts,
  equipments,
  manpower,
  equipment,
}: ResourceEntryPanelProps) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mGrid, setMGrid] = useState<ManpowerGridRow[]>(() => buildManpowerGrid(members, shifts, manpower));
  const [eGrid, setEGrid] = useState<EquipmentGridRow[]>(() => buildEquipmentGrid(equipment));
  const [reason, setReason] = useState('');
  const [saveErr, setSaveErr] = useState<{ error: DailySaveError; month?: string } | null>(null);
  const [saveOk, setSaveOk] = useState<{ created: number; updated: number; unchanged: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const outOfWindow = !isInWindow(date, entryWindow);
  const disabled = monthLocked || outOfWindow;
  const isPast = date < today;
  const totals = manpowerTotals(mGrid, shifts);

  function updateQuery(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    router.replace(`?${params}`, { scroll: false });
  }

  function setManpowerCell(contractorId: number, shiftCode: string, field: 'planned' | 'actual', value: string) {
    setMGrid((g) =>
      g.map((row) =>
        row.contractorId === contractorId
          ? { ...row, cells: { ...row.cells, [shiftCode]: { ...row.cells[shiftCode], [field]: value } } }
          : row,
      ),
    );
    setSaveOk(null);
    setSaveErr(null);
  }

  function setEquipmentCell(key: string, patch: Partial<EquipmentGridRow>) {
    setEGrid((g) => g.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setSaveOk(null);
    setSaveErr(null);
  }

  function addEquipmentRow() {
    newRowSeq += 1;
    setEGrid((g) => [
      ...g,
      {
        key: `new-${newRowSeq}`,
        contractorId: members[0]?.id ?? 0,
        equipmentId: equipments[0]?.id ?? 0,
        planned: '0',
        actual: '0',
        isNew: true,
      },
    ]);
  }

  function removeEquipmentRow(key: string) {
    setEGrid((g) => g.filter((row) => row.key !== key));
  }

  async function save() {
    const payload = gridToPayload(mGrid, eGrid);
    if (!payload.ok) return; // thông báo đã hiện qua gridErr bên dưới
    setSaving(true);
    setSaveErr(null);
    setSaveOk(null);
    try {
      const res = await saveDailyResourcesAction(projectId, date, payload, reason || undefined);
      if (res.ok) {
        setSaveOk({ created: res.created, updated: res.updated, unchanged: res.unchanged });
        router.refresh();
      } else {
        setSaveErr({ error: res.error, month: res.month });
      }
    } finally {
      setSaving(false);
    }
  }

  const payloadCheck = gridToPayload(mGrid, eGrid);
  const gridErr = !payloadCheck.ok ? payloadCheck : null;

  function errMessage(): string {
    if (gridErr) return t(`dailyEntry.err.${gridErr.error}`);
    if (!saveErr) return '';
    if (saveErr.error === 'Forbidden') return t('dailyEntry.err.forbidden');
    if (saveErr.error === 'locked') return t('dailyEntry.err.locked', { month: saveErr.month ?? '' });
    if (saveErr.error === 'Invalid input' || saveErr.error === 'Not found') return t('dailyEntry.err.generic', { msg: saveErr.error });
    return t(`dailyEntry.err.${saveErr.error}`);
  }

  return (
    <div className="space-y-4">
      <ContractorJoinBlock projectId={projectId} members={members} allContractors={allContractors} disabled={monthLocked} />

      <div>
        <div className="sect"><b>{t('dailyEntry.date')}</b><i /></div>
        <input
          type="date"
          value={date}
          min={entryWindow.min ?? undefined}
          max={entryWindow.max}
          onChange={(e) => updateQuery({ date: e.target.value, step: 'resources' })}
          className="inp"
          style={{ width: 'auto' }}
        />
        {monthLocked && <Badge tone="warn" className="ml-2">{t('dailyEntry.locked', { month: date.slice(0, 7) })}</Badge>}
        {outOfWindow && <p className="hintline">{t('dailyEntry.outOfWindow')}</p>}
      </div>

      {members.length > 0 && (
        <>
          <div>
            <div className="sect"><b>{t('dailyEntry.manpower')}</b><i /></div>
            <div className="scroll" style={{ maxHeight: 420 }}>
              <table className="tbl sticky">
                <thead>
                  <tr>
                    <th>{t('dailyEntry.contractor')}</th>
                    {shifts.map((s) => (
                      <th key={s.code} colSpan={2}>{s.nameVi}</th>
                    ))}
                    <th colSpan={2}>{t('dailyEntry.dayTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {mGrid.map((row) => {
                    const rowTotal = totals.byContractor[row.contractorId] ?? { planned: 0, actual: 0 };
                    return (
                      <tr key={row.contractorId}>
                        <td>{row.contractorName}</td>
                        {shifts.map((s) => {
                          const cell = row.cells[s.code] ?? { planned: '0', actual: '0' };
                          return (
                            <Fragment key={s.code}>
                              <td>
                                <input
                                  type="number"
                                  step={1}
                                  min={0}
                                  disabled={disabled}
                                  value={cell.planned}
                                  onChange={(e) => setManpowerCell(row.contractorId, s.code, 'planned', e.target.value)}
                                  className="inp"
                                  style={{ width: 72 }}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step={1}
                                  min={0}
                                  disabled={disabled}
                                  value={cell.actual}
                                  onChange={(e) => setManpowerCell(row.contractorId, s.code, 'actual', e.target.value)}
                                  className="inp"
                                  style={{ width: 72 }}
                                />
                              </td>
                            </Fragment>
                          );
                        })}
                        <td>{rowTotal.planned}</td>
                        <td>{rowTotal.actual}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td><b>{t('dailyEntry.total')}</b></td>
                    {shifts.map((s) => {
                      const t2 = totals.byShift[s.code] ?? { planned: 0, actual: 0 };
                      return (
                        <Fragment key={s.code}>
                          <td><b>{t2.planned}</b></td>
                          <td><b>{t2.actual}</b></td>
                        </Fragment>
                      );
                    })}
                    <td><b>{totals.day.planned}</b></td>
                    <td><b>{totals.day.actual}</b></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div>
            <div className="sect"><b>{t('dailyEntry.equipment')}</b><i /></div>
            <div className="scroll" style={{ maxHeight: 320 }}>
              <table className="tbl sticky">
                <thead>
                  <tr>
                    <th>{t('dailyEntry.contractor')}</th>
                    <th>{t('dailyEntry.equipment')}</th>
                    <th>{t('dailyEntry.planned')}</th>
                    <th>{t('dailyEntry.actual')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {eGrid.map((row) => (
                    <tr key={row.key}>
                      <td>
                        <select
                          disabled={disabled}
                          value={row.contractorId}
                          onChange={(e) => setEquipmentCell(row.key, { contractorId: Number(e.target.value) })}
                          className="inp"
                        >
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          disabled={disabled}
                          value={row.equipmentId}
                          onChange={(e) => setEquipmentCell(row.key, { equipmentId: Number(e.target.value) })}
                          className="inp"
                        >
                          {equipments.map((eq) => (
                            <option key={eq.id} value={eq.id}>{eq.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number" step={1} min={0} disabled={disabled}
                          value={row.planned}
                          onChange={(e) => setEquipmentCell(row.key, { planned: e.target.value })}
                          className="inp" style={{ width: 72 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number" step={1} min={0} disabled={disabled}
                          value={row.actual}
                          onChange={(e) => setEquipmentCell(row.key, { actual: e.target.value })}
                          className="inp" style={{ width: 72 }}
                        />
                      </td>
                      <td>
                        {row.isNew && !disabled && (
                          <button type="button" className="btn ghost" onClick={() => removeEquipmentRow(row.key)}>×</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!disabled && (
              <button type="button" className="btn ghost mt-2" onClick={addEquipmentRow}>
                {t('dailyEntry.addEquipment')}
              </button>
            )}
          </div>

          {isPast && !disabled && (
            <div className="field">
              <span className="lb">{t('dailyEntry.reason')}</span>
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="inp" />
              <p className="hintline">{t('dailyEntry.reasonHint')}</p>
            </div>
          )}

          {(gridErr || saveErr) && <p className="sumbar bad">{errMessage()}</p>}
          {saveOk && !saveErr && !gridErr && (
            <span className="chip c-ok">
              {t('dailyEntry.saved', { created: saveOk.created, updated: saveOk.updated, unchanged: saveOk.unchanged })}
            </span>
          )}

          {!disabled && (
            <button type="button" className="btn" disabled={saving} onClick={save}>
              {t('dailyEntry.save', { date })}
            </button>
          )}

          <DailyImportBlock projectId={projectId} disabled={disabled} />
        </>
      )}
    </div>
  );
}

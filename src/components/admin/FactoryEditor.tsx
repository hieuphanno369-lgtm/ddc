'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Factory } from '@/server/repo/types';
import { saveFactoryAction, setFactoryActiveAction } from '@/server/actions-master';

interface RowDraft {
  name: string;
  region: string;
  capacityTonPerYear: string;
}

function toDraft(f: Factory): RowDraft {
  return { name: f.name, region: f.region, capacityTonPerYear: String(f.capacityTonPerYear) };
}

/** T8 (Task 6, P2A): CRUD khu vực sản xuất / công suất - khuôn `FieldEditor.tsx`. */
export function FactoryEditor({ factories }: { factories: Factory[] }) {
  const router = useRouter();
  const t = useTranslations();
  const [drafts, setDrafts] = useState<Record<number, RowDraft>>(() =>
    Object.fromEntries(factories.map((f) => [f.id, toDraft(f)])),
  );
  const [newRow, setNewRow] = useState<RowDraft>({ name: '', region: '', capacityTonPerYear: '' });
  const [err, setErr] = useState<string | null>(null);

  function draftOf(f: Factory): RowDraft {
    return drafts[f.id] ?? toDraft(f);
  }

  function setDraft(id: number, patch: Partial<RowDraft>) {
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? toDraft(factories.find((f) => f.id === id)!)), ...patch } }));
  }

  async function save(id: number | undefined, draft: RowDraft) {
    setErr(null);
    const capacity = Number(draft.capacityTonPerYear);
    if (!draft.name.trim() || !Number.isFinite(capacity) || capacity <= 0) {
      setErr(t('factoryAdmin.err.invalid'));
      return;
    }
    const res = await saveFactoryAction({ id, name: draft.name, region: draft.region, capacityTonPerYear: capacity });
    if (res.ok) {
      if (id == null) setNewRow({ name: '', region: '', capacityTonPerYear: '' });
      router.refresh();
    } else {
      setErr(t(`factoryAdmin.err.${res.error === 'duplicate_name' ? 'duplicate_name' : 'invalid'}`));
    }
  }

  async function toggleActive(id: number, isActive: boolean) {
    setErr(null);
    const res = await setFactoryActiveAction(id, isActive);
    if (res.ok) router.refresh();
    else setErr(t('factoryAdmin.err.invalid'));
  }

  return (
    <div className="space-y-2">
      {err && <p className="sumbar bad">{err}</p>}
      <div className="scroll" style={{ maxHeight: 320 }}>
        {/* Bề rộng tối thiểu: màn hẹp cuộn ngang thay vì ép ô nhập (cột Vùng từng còn ~30px ở 390). */}
        <table className="tbl sticky" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th>{t('factoryAdmin.name')}</th>
              <th>{t('factoryAdmin.region')}</th>
              <th>{t('factoryAdmin.capacity')}</th>
              <th>{t('factoryAdmin.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {factories.map((f) => {
              const draft = draftOf(f);
              return (
                <tr key={f.id}>
                  <td>
                    <input value={draft.name} onChange={(e) => setDraft(f.id, { name: e.target.value })} className="inp" />
                  </td>
                  <td>
                    <input value={draft.region} onChange={(e) => setDraft(f.id, { region: e.target.value })} className="inp" />
                  </td>
                  <td>
                    <input
                      type="number" step="1" value={draft.capacityTonPerYear}
                      onChange={(e) => setDraft(f.id, { capacityTonPerYear: e.target.value })}
                      className="inp"
                    />
                  </td>
                  <td>{f.isActive ? t('factoryAdmin.active') : t('factoryAdmin.inactive')}</td>
                  <td>
                    <div className="flex gap-2">
                      <button type="button" className="btn ghost" onClick={() => save(f.id, draft)}>
                        {t('factoryAdmin.save')}
                      </button>
                      <button type="button" className="btn ghost" onClick={() => toggleActive(f.id, !f.isActive)}>
                        {f.isActive ? t('factoryAdmin.deactivate') : t('factoryAdmin.activate')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr>
              <td>
                <input value={newRow.name} onChange={(e) => setNewRow((r) => ({ ...r, name: e.target.value }))} className="inp" />
              </td>
              <td>
                <input value={newRow.region} onChange={(e) => setNewRow((r) => ({ ...r, region: e.target.value }))} className="inp" />
              </td>
              <td>
                <input
                  type="number" step="1" value={newRow.capacityTonPerYear}
                  onChange={(e) => setNewRow((r) => ({ ...r, capacityTonPerYear: e.target.value }))}
                  className="inp"
                />
              </td>
              <td />
              <td>
                <button type="button" className="btn" onClick={() => save(undefined, newRow)}>
                  {t('factoryAdmin.add')}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

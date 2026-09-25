'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { mergeDimAction, renameDimAction } from '@/server/actions';
import { approveCustomerAction } from '@/server/actions-project';

export interface DimValueRow {
  id: number;
  name: string;
  isActive: boolean;
  mergedIntoId: number | null;
  needsReview: boolean;
  refCount: number;
}

/**
 * Sửa/normalize dimension (customer/team): đổi tên (sửa typo) hoặc merge
 * giá trị trùng ("Tập Đoàn Vingroup" → "Vingroup") - re-point FK, không xóa.
 */
export function FieldEditor({ field, values }: { field: 'customer' | 'team'; values: DimValueRow[] }) {
  const router = useRouter();
  const t = useTranslations();
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState('');

  async function rename(id: number, name: string) {
    window.dispatchEvent(new Event('ddc:sync'));
    const res = await renameDimAction(field, id, name);
    if (res.ok) router.refresh();
    else setMsg(res.error ?? 'Error');
  }

  async function merge(fromId: number, toId: number) {
    if (!toId) return;
    window.dispatchEvent(new Event('ddc:sync'));
    const res = await mergeDimAction(field, fromId, toId);
    if (res.ok) router.refresh();
    else setMsg(res.error ?? 'Error');
  }

  async function approve(id: number) {
    window.dispatchEvent(new Event('ddc:sync'));
    const res = await approveCustomerAction(id);
    if (res.ok) {
      router.refresh();
      return;
    }
    const key = `customerReview.err.${res.error}`;
    setMsg(t.has(key) ? t(key) : t('customerReview.err.generic', { msg: res.error }));
  }

  const active = values.filter((v) => v.isActive);
  const filtered = values
    .filter((v) => v.isActive && v.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (field === 'customer' ? Number(b.needsReview) - Number(a.needsReview) : 0));
  const hasPending = field === 'customer' && values.some((v) => v.needsReview);

  return (
    <div className="space-y-2">
      {msg && <p className="sumbar bad">{msg}</p>}
      {hasPending && <p className="hintline">{t('customerReview.hint')}</p>}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('common.search')}
        className="inp"
      />
      <div className="scroll" style={{ maxHeight: 256 }}>
      <table className="tbl sticky">
        <thead>
          <tr>
            <th>Tên</th>
            <th># dự án</th>
            <th>Đổi tên</th>
            <th>Merge →</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((v) => (
            <DimRow
              key={v.id}
              v={v}
              field={field}
              targets={active.filter((x) => x.id !== v.id)}
              onRename={rename}
              onMerge={merge}
              onApprove={approve}
            />
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function DimRow({
  v,
  field,
  targets,
  onRename,
  onMerge,
  onApprove,
}: {
  v: DimValueRow;
  field: 'customer' | 'team';
  targets: DimValueRow[];
  onRename: (id: number, name: string) => void;
  onMerge: (fromId: number, toId: number) => void;
  onApprove: (id: number) => void;
}) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(v.name);
  const [toId, setToId] = useState(0);
  const [busy, setBusy] = useState(false);

  return (
    <tr className={v.isActive ? '' : 'opacity-50'}>
      <td>
        {field === 'customer' && v.needsReview && (
          <span className="chip c-warn" style={{ marginRight: 6 }}>{t('customerReview.pending')}</span>
        )}
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="inp w-40"
            />
            <button
              onClick={async () => {
                setBusy(true);
                await onRename(v.id, text.trim());
                setBusy(false);
                setEditing(false);
              }}
              disabled={busy || !text.trim()}
              className="btn disabled:opacity-50"
              style={{ padding: '4px 10px', fontSize: 'var(--t-caption1)' }}
            >
              ✓
            </button>
            <button
              onClick={() => { setEditing(false); setText(v.name); }}
              className="btn ghost"
              style={{ padding: '4px 10px', fontSize: 'var(--t-caption1)' }}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            style={{ fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            title={v.mergedIntoId ? `Đã merge vào #${v.mergedIntoId}` : undefined}
          >
            {v.name}
          </button>
        )}
      </td>
      <td className="text-caption1 text-label3">{v.refCount}</td>
      <td className="text-caption1 text-label3">
        {field === 'customer' && v.needsReview && (
          <button
            onClick={async () => {
              setBusy(true);
              await onApprove(v.id);
              setBusy(false);
            }}
            disabled={busy}
            className="btn ghost disabled:opacity-40"
            style={{ padding: '4px 10px', fontSize: 'var(--t-caption1)' }}
          >
            {t('customerReview.approve')}
          </button>
        )}
        {!(field === 'customer' && v.needsReview) && !editing && 'nhấn tên để sửa'}
      </td>
      <td>
        {v.isActive ? (
          <div className="flex items-center gap-1">
            <select
              value={toId}
              onChange={(e) => setToId(Number(e.target.value))}
              className="inp w-32"
            >
              <option value={0}>-</option>
              {targets.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <button
              onClick={async () => {
                setBusy(true);
                await onMerge(v.id, toId);
                setBusy(false);
                setToId(0);
              }}
              disabled={busy || !toId}
              className="btn ghost disabled:opacity-40"
              style={{ padding: '4px 10px', fontSize: 'var(--t-caption1)' }}
            >
              Merge
            </button>
          </div>
        ) : (
          <span className="text-caption1 text-label3">merged → #{v.mergedIntoId}</span>
        )}
      </td>
    </tr>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { mergeDimAction, renameDimAction } from '@/server/actions';

export interface DimValueRow {
  id: number;
  name: string;
  isActive: boolean;
  mergedIntoId: number | null;
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

  const active = values.filter((v) => v.isActive);
  const filtered = values.filter((v) => v.isActive && v.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-2">
      {msg && <p className="text-xs text-red-600">{msg}</p>}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('common.search')}
        className="h-8 w-full rounded-lg border border-slate-200 px-2.5 text-sm focus:border-accent focus:outline-none"
      />
      <div className="max-h-64 overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-400">
            <th className="py-1.5 font-medium">Tên</th>
            <th className="py-1.5 font-medium"># dự án</th>
            <th className="py-1.5 font-medium">Đổi tên</th>
            <th className="py-1.5 font-medium">Merge →</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filtered.map((v) => (
            <DimRow
              key={v.id}
              v={v}
              targets={active.filter((x) => x.id !== v.id)}
              onRename={rename}
              onMerge={merge}
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
  targets,
  onRename,
  onMerge,
}: {
  v: DimValueRow;
  targets: DimValueRow[];
  onRename: (id: number, name: string) => void;
  onMerge: (fromId: number, toId: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(v.name);
  const [toId, setToId] = useState(0);
  const [busy, setBusy] = useState(false);

  return (
    <tr className={v.isActive ? '' : 'opacity-50'}>
      <td className="py-2 pr-2">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="h-8 w-40 rounded-lg border border-slate-200 px-2 text-sm"
            />
            <button
              onClick={async () => {
                setBusy(true);
                await onRename(v.id, text.trim());
                setBusy(false);
                setEditing(false);
              }}
              disabled={busy || !text.trim()}
              className="rounded-lg bg-accent px-2 py-1 text-xs text-white disabled:opacity-50"
            >
              ✓
            </button>
            <button onClick={() => { setEditing(false); setText(v.name); }} className="px-2 py-1 text-xs text-slate-400">
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="font-medium text-navy-900 hover:text-accent"
            title={v.mergedIntoId ? `Đã merge vào #${v.mergedIntoId}` : undefined}
          >
            {v.name}
          </button>
        )}
      </td>
      <td className="py-2 text-xs text-slate-500">{v.refCount}</td>
      <td className="py-2 text-xs text-slate-400">{editing ? '' : 'nhấn tên để sửa'}</td>
      <td className="py-2">
        {v.isActive ? (
          <div className="flex items-center gap-1">
            <select
              value={toId}
              onChange={(e) => setToId(Number(e.target.value))}
              className="h-8 w-32 rounded-lg border border-slate-200 px-2 text-xs"
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
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-navy-800 hover:bg-slate-50 disabled:opacity-40"
            >
              Merge
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">merged → #{v.mergedIntoId}</span>
        )}
      </td>
    </tr>
  );
}

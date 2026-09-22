'use client';

import { useEffect, useRef, useState } from 'react';

export interface ComboboxOption {
  value: string;
  label: string;
}

/**
 * Type-ahead combobox: gõ → gợi ý từ danh sách; `allowCreate` bật thì hiện
 * nút tạo mới khi không khớp chính xác (gọi `onCreate` rồi chọn giá trị mới).
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  allowCreate = false,
  onCreate,
  createLabel = '+ Tạo mới',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  allowCreate?: boolean;
  onCreate?: (name: string) => Promise<string>;
  createLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const currentLabel = options.find((o) => o.value === value)?.label ?? '';
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const exactMatch = options.some((o) => o.label.toLowerCase() === q);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  async function create() {
    if (!onCreate || !query.trim()) return;
    setBusy(true);
    try {
      const id = await onCreate(query.trim());
      onChange(String(id));
      setQuery('');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={open ? query : currentLabel}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery(currentLabel);
          setOpen(true);
        }}
        placeholder={placeholder}
        className={className}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(o.value);
                setQuery('');
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-navy-900 hover:bg-slate-50"
            >
              {o.label}
            </button>
          ))}
          {allowCreate && q && !exactMatch && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={create}
              disabled={busy}
              className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-accent hover:bg-slate-50 disabled:opacity-50"
            >
              {busy ? '…' : `${createLabel} “${query.trim()}”`}
            </button>
          )}
          {filtered.length === 0 && !allowCreate && (
            <div className="px-3 py-2 text-sm text-slate-400">-</div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { listboxKeyAction } from '@/lib/list-nav';

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
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const optId = (i: number) => `${listId}-o${i}`;

  const currentLabel = options.find((o) => o.value === value)?.label ?? '';
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const exactMatch = options.some((o) => o.label.toLowerCase() === q);
  const showCreate = allowCreate && !!q && !exactMatch;
  const count = filtered.length + (showCreate ? 1 : 0);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Danh sach loc lai khi query hoac trang thai dong/mo doi -> bo chon active cu.
  useEffect(() => {
    setActive(-1);
  }, [query, open]);

  useEffect(() => {
    if (active >= 0) document.getElementById(optId(active))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function pick(v: string) {
    onChange(v);
    setQuery('');
    setOpen(false);
  }

  async function create() {
    if (!onCreate || !query.trim()) return;
    setBusy(true);
    try {
      const id = await onCreate(query.trim());
      pick(String(id));
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
        onKeyDown={(e) => {
          const a = listboxKeyAction(e.key, { open, active, count });
          if (a.type === 'none') return;
          e.preventDefault();
          if (a.type === 'open') {
            setQuery(currentLabel);
            setOpen(true);
            setActive(a.active);
          } else if (a.type === 'move') {
            setActive(a.active);
          } else if (a.type === 'choose') {
            if (a.index < filtered.length) pick(filtered[a.index].value);
            else void create();
          } else {
            // Esc: focus van o input (trigger)
            setOpen(false);
            setQuery('');
            setActive(-1);
          }
        }}
        placeholder={placeholder}
        className={className}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
      />
      {open && (
        <div className="pop" id={listId} role="listbox">
          {filtered.map((o, i) => (
            <button
              key={o.value}
              type="button"
              id={optId(i)}
              role="option"
              aria-selected={i === active}
              tabIndex={-1}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o.value)}
              style={i === active ? { background: 'var(--fill)' } : undefined}
            >
              {o.label}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              id={optId(filtered.length)}
              role="option"
              aria-selected={filtered.length === active}
              tabIndex={-1}
              onMouseEnter={() => setActive(filtered.length)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={create}
              disabled={busy}
              className="disabled:opacity-50"
              style={{
                borderTop: '.5px solid var(--sep)',
                color: 'var(--accent)',
                fontWeight: 600,
                ...(filtered.length === active ? { background: 'var(--fill)' } : undefined),
              }}
            >
              {busy ? '…' : `${createLabel} “${query.trim()}”`}
            </button>
          )}
          {filtered.length === 0 && !allowCreate && (
            <div className="px-3 py-2 text-footnote text-label3">-</div>
          )}
        </div>
      )}
    </div>
  );
}

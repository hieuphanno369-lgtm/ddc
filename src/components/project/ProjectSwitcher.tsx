'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { IconSearch } from '@/components/icons';

/**
 * Combobox tìm kiếm dự án - gõ keyword (tên/mã) ra gợi ý, click chọn.
 * Thay thế <select> cũ vì danh mục có thể lên hàng trăm dự án.
 */
export function ProjectSwitcher({
  currentId,
  projects,
}: {
  currentId: number;
  projects: { id: number; name: string; code: string }[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = projects.find((p) => p.id === currentId);

  const q = query.trim().toLowerCase();
  const results = q
    ? projects
        .filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
        .slice(0, 10)
    : [];

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  function select(id: number) {
    setOpen(false);
    setQuery('');
    router.push(`/projects/${id}`);
  }

  return (
    <div className="relative w-full max-w-sm" ref={ref}>
      <div className="relative">
        <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-label3" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={current ? `${current.code} - ${current.name}` : t('common.searchProject')}
          className="inp pl-8"
        />
      </div>

      {open && q && (
        <div className="pop">
          {results.length === 0 ? (
            <p className="px-3 py-2.5 text-caption1 text-label3">{t('common.noResult')}</p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                onClick={() => select(p.id)}
                className="flex items-center gap-2"
              >
                <span className="mono shrink-0">{p.code}</span>
                <span className="flex-1 truncate">{p.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Contractor } from '@/server/repo/types';
import { addProjectContractorAction, createContractorAction, removeProjectContractorAction } from '@/server/actions-entry';
import { Combobox } from './Combobox';

export interface ContractorJoinBlockProps {
  projectId: number;
  members: Contractor[];
  allContractors: Contractor[];
  disabled: boolean;
}

function errKey(error: string): string {
  if (error === 'has_data') return 'has_data';
  if (error === 'Forbidden') return 'forbidden';
  return 'generic';
}

export function ContractorJoinBlock({ projectId, members, allContractors, disabled }: ContractorJoinBlockProps) {
  const t = useTranslations();
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  const memberIds = new Set(members.map((m) => m.id));
  const candidates = allContractors.filter((c) => !memberIds.has(c.id));

  async function remove(id: number, name: string) {
    if (!window.confirm(t('contractorJoin.confirmRemove', { name }))) return;
    const res = await removeProjectContractorAction(projectId, id);
    if (res.ok) {
      setErr(null);
      router.refresh();
    } else {
      setErr(res.error);
    }
  }

  async function add(contractorId: string) {
    const res = await addProjectContractorAction(projectId, Number(contractorId));
    if (res.ok) {
      setErr(null);
      router.refresh();
    } else {
      setErr(res.error);
    }
  }

  return (
    <div>
      <div className="sect"><b>{t('contractorJoin.title')}</b><i /></div>
      {members.length === 0 ? (
        <p className="empty">{t('contractorJoin.empty')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span key={m.id} className="chip">
              {m.name}
              {!disabled && (
                <button type="button" onClick={() => remove(m.id, m.name)} aria-label={t('contractorJoin.remove')}>
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!disabled && (
        <div className="mt-2 max-w-xs">
          <Combobox
            value=""
            onChange={add}
            options={candidates.map((c) => ({ value: String(c.id), label: c.name }))}
            allowCreate
            createLabel={t('contractorJoin.create')}
            onCreate={async (name) => {
              const res = await createContractorAction(projectId, name, '');
              if (!res.ok) {
                setErr(res.error);
                return '';
              }
              setErr(null);
              router.refresh();
              return String(res.id);
            }}
            placeholder={t('contractorJoin.add')}
            className="inp"
          />
        </div>
      )}
      {err && <p className="sumbar bad">{t(`contractorJoin.err.${errKey(err)}`, { msg: err })}</p>}
    </div>
  );
}

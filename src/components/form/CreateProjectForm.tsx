'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Currency, CurrencyCode, Customer, Market, Priority, ProjectType, TeamKd } from '@/server/repo/types';
import { marketKey, typeKey } from '@/lib/labels';
import { fmtNum, toTitleCase } from '@/lib/format';
import { createDimValueAction, createProjectAction } from '@/server/actions';
import { Combobox } from './Combobox';
import { IconPlus } from '@/components/icons';

const TYPES: ProjectType[] = ['EPC', 'San_van_dong', 'San_bay', 'Nha_xuong', 'Cau_cang', 'Cao_tang', 'Dong_tau', 'Cau_giao_thong', 'Khac'];
const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3'];
const MARKETS: Market[] = ['TN', 'XK', 'NoiBo'];

const inputCls =
  'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-navy-900 focus:border-accent focus:outline-none';

export function CreateProjectForm({
  customers,
  teams,
  currencies,
}: {
  customers: Customer[];
  teams: TeamKd[];
  currencies: Currency[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    projectName: '',
    customerId: '',
    teamKdId: '',
    marketCode: '',
    projectType: '',
    priority: '',
    contractValue: '',
    tonnage: '',
    currencyCode: 'VND',
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): boolean {
    const missing: string[] = [];
    if (!form.projectName.trim()) missing.push(t('form.projectName'));
    if (!form.customerId) missing.push(t('form.customer'));
    if (!form.teamKdId) missing.push(t('form.teamKd'));
    if (!form.marketCode) missing.push(t('common.market'));
    if (!form.projectType) missing.push(t('form.projectType'));
    if (!form.priority) missing.push(t('form.priority'));
    if (!form.contractValue || Number(form.contractValue) <= 0) missing.push(t('form.contractValue'));
    if (missing.length) {
      setErr(t('form.validation.missing') + ': ' + missing.join(', '));
      return false;
    }
    setErr(null);
    return true;
  }

  async function submit() {
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await createProjectAction({
        projectName: form.projectName.trim(),
        customerId: Number(form.customerId),
        teamKdId: Number(form.teamKdId),
        marketCode: form.marketCode as Market,
        projectType: form.projectType as ProjectType,
        priority: form.priority as Priority,
        contractValue: Number(form.contractValue),
        tonnage: form.tonnage ? Number(form.tonnage) : undefined,
        currencyCode: form.currencyCode as CurrencyCode,
      });
      if (res.ok && res.id) {
        setSaved(true);
        setForm({
          projectName: '',
          customerId: '',
          teamKdId: '',
          marketCode: '',
          projectType: '',
          priority: '',
          contractValue: '',
          tonnage: '',
          currencyCode: 'VND',
        });
        setErr(null);
        const params = new URLSearchParams(searchParams.toString());
        params.set('project', String(res.id));
        router.replace(`?${params.toString()}`);
        router.refresh();
      } else {
        setErr(res.error ?? 'Error');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
      >
        <IconPlus size={16} />
        {t('form.newProject')}
      </button>

      {open && (
        <div className="card mt-3 grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
              {t('form.projectName')} *
              <span title={t('form.hintLabel.projectName')} className="cursor-help rounded-full bg-slate-200 px-1.5 text-[10px] font-bold leading-4 text-slate-500">!</span>
            </label>
            <input value={form.projectName} onChange={(e) => set('projectName', e.target.value.toUpperCase())} className={inputCls} />
          </div>
          <Field label={t('form.customer') + ' *'} hint={t('form.hintLabel.customer')}>
            <Combobox
              value={form.customerId}
              onChange={(v) => set('customerId', v)}
              options={customers.map((c) => ({ value: String(c.id), label: c.name }))}
              allowCreate
              createLabel={t('common.add')}
              onCreate={async (name) => {
                const res = await createDimValueAction('customer', toTitleCase(name));
                return res.ok ? String(res.id) : '';
              }}
              className={inputCls}
            />
          </Field>
          <Field label={t('form.teamKd') + ' *'}>
            <Combobox
              value={form.teamKdId}
              onChange={(v) => set('teamKdId', v)}
              options={teams.map((x) => ({ value: String(x.id), label: x.name }))}
              allowCreate
              createLabel={t('common.add')}
              onCreate={async (name) => {
                const res = await createDimValueAction('team', name);
                return res.ok ? String(res.id) : '';
              }}
              className={inputCls}
            />
          </Field>
          <Field label={t('form.projectType') + ' *'} hint={t('form.hintLabel.projectType')}>
            <Combobox
              value={form.projectType}
              onChange={(v) => set('projectType', v)}
              options={TYPES.map((ty) => ({ value: ty, label: t(typeKey[ty]) }))}
              className={inputCls}
            />
          </Field>
          <Field label={t('form.priority') + ' *'} hint={t('form.hintLabel.priority')}>
            <Combobox
              value={form.priority}
              onChange={(v) => set('priority', v)}
              options={PRIORITIES.map((p) => ({ value: p, label: p }))}
              className={inputCls}
            />
          </Field>
          <Field label={t('common.market') + ' *'} hint={t('form.hintLabel.market')}>
            <Combobox
              value={form.marketCode}
              onChange={(v) => set('marketCode', v)}
              options={MARKETS.map((m) => ({ value: m, label: t(marketKey[m]) }))}
              className={inputCls}
            />
          </Field>
          <Field label={t('form.currency')}>
            <Combobox
              value={form.currencyCode}
              onChange={(v) => set('currencyCode', v)}
              options={currencies.map((c) => ({ value: c.code, label: c.code }))}
              className={inputCls}
            />
          </Field>
          <Field label={t('form.contractValue') + ' *'} hint={t('form.hintLabel.contractValue')}>
            <input type="number" step="0.1" value={fmtNum(form.contractValue)} onChange={(e) => set('contractValue', e.target.value)} className={inputCls} />
          </Field>
          <Field label={`${t('common.tonnage')} (${t('common.ton')})`}>
            <input type="number" step="0.1" value={fmtNum(form.tonnage)} onChange={(e) => set('tonnage', e.target.value)} className={inputCls} />
          </Field>

          {err && <p className="text-xs text-red-600 sm:col-span-2">{err}</p>}
          {saved && <p className="text-xs text-emerald-600 sm:col-span-2">{t('form.savedProject')}</p>}
          <div className="flex items-center gap-2 sm:col-span-2">
            <button
              onClick={submit}
              disabled={busy}
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {t('common.save')}
            </button>
            <button onClick={() => setOpen(false)} className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:bg-slate-50">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
        {label}
        {hint && (
          <span title={hint} className="cursor-help rounded-full bg-slate-200 px-1.5 text-[10px] font-bold leading-4 text-slate-500">!</span>
        )}
      </label>
      {children}
    </div>
  );
}

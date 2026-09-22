'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type {
  AlertLog,
  Currency,
  CurrencyCode,
  Customer,
  FactFinancial,
  FactProgressMonthly,
  Market,
  Priority,
  Project,
  ProjectAlias,
  ProjectPhoto,
  ProjectSapCode,
  ProjectType,
  StageCode,
  TeamKd,
  ValueChainProgress,
} from '@/server/repo/types';
import { marketKey, stageKey, typeKey } from '@/lib/labels';
import { computeEvm } from '@/lib/evm';
import { STAGE_ORDER, calcChainPctActual, findCurrentStage, normPct } from '@/lib/stages';
import { THRESHOLDS } from '@/lib/thresholds';
import { fmtNum, formatPct, formatRatio, toTitleCase } from '@/lib/format';
import { addPhotoAction, addSapCodeAction, closeAlertAction, createDimValueAction, deletePhotoAction, lockMonthAction, saveMonthlyData } from '@/server/actions';
import { Combobox } from './Combobox';
import { Badge, Dot } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/Badges';
import { IconProject } from '@/components/icons';

type Step = 'progress' | 'finance' | 'profile' | 'extras';

const TYPES: ProjectType[] = ['EPC', 'San_van_dong', 'San_bay', 'Nha_xuong', 'Cau_cang', 'Cao_tang', 'Dong_tau', 'Cau_giao_thong', 'Khac'];
const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3'];
const MARKETS: Market[] = ['TN', 'XK', 'NoiBo'];

interface Props {
  projectId: number;
  projects: { id: number; name: string; code: string }[];
  project: Project;
  fact: FactProgressMonthly | undefined;
  financial: FactFinancial | undefined;
  chain: ValueChainProgress[];
  alerts: AlertLog[];
  aliases: ProjectAlias[];
  sapCodes: ProjectSapCode[];
  photos: ProjectPhoto[];
  month: string;
  months: string[];
  locked: boolean;
  canLock: boolean;
  customers: Customer[];
  teams: TeamKd[];
  currencies: Currency[];
}

interface FormState {
  projectName: string;
  customerId: string;
  teamKdId: string;
  marketCode: string;
  projectType: string;
  priority: string;
  contractValue: string;
  tonnage: string;
  currencyCode: string;
  contractDate: string;
  plannedStartDate: string;
  plannedFinishDate: string;
  committedHandoverDate: string;
  actualStartDate: string;
  actualFinishDate: string;
  penaltyValue: string;
  penalized: boolean;
  pctPlan: string;
  stagePct: Record<StageCode, string>;
  stageApplicable: Record<StageCode, boolean>;
  ac: string;
  equipmentActual: string;
  revenueCumulative: string;
  costActualCumulative: string;
  arCollected: string;
  arOutstanding: string;
  arOverdue: string;
}

export function DataEntryForm({
  projectId,
  projects,
  project,
  fact,
  financial,
  chain,
  alerts,
  aliases,
  sapCodes,
  photos,
  month,
  months,
  locked,
  canLock,
  customers,
  teams,
  currencies,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>('progress');
  const [form, setForm] = useState<FormState>(() => loadDraft(projectId, month, project, fact, financial, chain));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  // Chỉ gửi `chain` khi user thực sự sửa tiến độ - tránh derive pctActual=0 ghi đè tháng import.
  const [chainDirty, setChainDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SAP add
  const [sapCode, setSapCode] = useState('');
  const [sapDoc, setSapDoc] = useState('Hợp đồng con');
  const [sapMsg, setSapMsg] = useState<string | null>(null);

  // Photos (upload lên server, lưu file vào data/uploads)
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  // Draft auto-save (debounced)
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(`ddc_draft_${projectId}_${month}`, JSON.stringify(form));
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form, projectId, month]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }) as FormState);
    setSaved(false);
  }

  function updateQuery(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    router.replace(`?${params}`, { scroll: false });
  }

  const stageInputs = STAGE_ORDER.map((s) => ({
    stageCode: s,
    pctComplete: normPct(form.stagePct?.[s] ?? '') ?? 0,
    applicable: form.stageApplicable?.[s] ?? true,
  }));
  const derivedPctActual = calcChainPctActual(stageInputs);
  const currentStage = findCurrentStage(stageInputs);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.projectName.trim()) e.projectName = t('form.required');
    const num = (s: string) => (s.trim() === '' ? null : Number(s));
    const pctPlan = num(form.pctPlan);
    if (pctPlan != null && (pctPlan < 0 || pctPlan > THRESHOLDS.pctInputMax)) e.pctPlan = t('form.validation.pctRange');
    for (const s of STAGE_ORDER) {
      const v = normPct(form.stagePct?.[s] ?? '');
      if (v != null && (v < 0 || v > THRESHOLDS.pctInputMax)) e['stagePct.' + s] = t('form.validation.stageRange');
    }
    if (derivedPctActual < 1 && project.actualStartDate && !form.committedHandoverDate) {
      e.committedHandoverDate = t('form.validation.committedRequired');
    }
    setErrors(e);
    // Chỉ chặn khi nhập SAI (vượt range %). Thiếu field → cho submit, bổ sung sau.
    return !e.pctPlan && !STAGE_ORDER.some((s) => e['stagePct.' + s]);
  }

  async function submit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await saveMonthlyData(projectId, month, {
        projectName: form.projectName || undefined,
        customerId: form.customerId ? Number(form.customerId) : undefined,
        teamKdId: form.teamKdId ? Number(form.teamKdId) : undefined,
        marketCode: (form.marketCode || undefined) as Market | undefined,
        projectType: (form.projectType || undefined) as ProjectType | undefined,
        priority: (form.priority || undefined) as Priority | undefined,
        contractValue: form.contractValue ? Number(form.contractValue) : undefined,
        tonnage: form.tonnage ? Number(form.tonnage) : undefined,
        currencyCode: (form.currencyCode || undefined) as CurrencyCode | undefined,
        contractDate: form.contractDate || null,
        plannedStartDate: form.plannedStartDate || null,
        plannedFinishDate: form.plannedFinishDate || null,
        committedHandoverDate: form.committedHandoverDate || null,
        actualStartDate: form.actualStartDate || null,
        actualFinishDate: form.actualFinishDate || null,
        penaltyValue: form.penaltyValue ? Number(form.penaltyValue) : null,
        penalized: form.penalized,
        pctPlan: form.pctPlan ? Number(form.pctPlan) : undefined,
        ...(chainDirty ? { chain: stageInputs } : {}),
        ac: form.ac ? Number(form.ac) : undefined,
        equipmentActual: form.equipmentActual ? Number(form.equipmentActual) : undefined,
        revenueCumulative: form.revenueCumulative ? Number(form.revenueCumulative) : undefined,
        costActualCumulative: form.costActualCumulative ? Number(form.costActualCumulative) : undefined,
        arCollected: form.arCollected ? Number(form.arCollected) : undefined,
        arOverdue: form.arOverdue ? Number(form.arOverdue) : undefined,
      });
      if (res.ok) {
        localStorage.removeItem(`ddc_draft_${projectId}_${month}`);
        router.refresh();
        setSaved(true);
      }
    } finally {
      setSaving(false);
    }
  }

  async function addSap() {
    if (!sapCode.trim()) return;
    const res = await addSapCodeAction(projectId, sapCode.trim(), sapDoc);
    setSapMsg(res.ok ? null : 'Trùng mã SAP');
    if (res.ok) {
      setSapCode('');
      router.refresh();
    }
  }

  async function uploadPhotos(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    setPhotoBusy(true);
    setPhotoErr(null);
    try {
      for (const file of list) {
        const fd = new FormData();
        fd.append('projectId', String(projectId));
        fd.append('yearMonth', month);
        fd.append('caption', '');
        fd.append('file', file);
        const res = await addPhotoAction(fd);
        if (!res.ok) {
          setPhotoErr(res.error ?? t('form.photoUploadError'));
          return;
        }
      }
      router.refresh();
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto(photoId: number) {
    if (!window.confirm(t('form.confirmDeletePhoto'))) return;
    await deletePhotoAction(photoId);
    router.refresh();
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'progress', label: t('form.stepProgress') },
    { key: 'finance', label: t('form.stepFinance') },
    { key: 'profile', label: t('form.stepProfile') },
    { key: 'extras', label: t('form.stepExtras') },
  ];

  const inputCls = (key: string) =>
    `w-full rounded-xl border px-3 py-2 text-sm text-navy-900 focus:outline-none ${
      errors[key] ? 'border-red-400' : 'border-slate-200 focus:border-accent'
    }`;
  const selectCls =
    'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-navy-900 focus:border-accent focus:outline-none';

  const bac = Number(form.contractValue) || project.contractValue || 0;
  const pp = Number(form.pctPlan);
  const pa = derivedPctActual;
  const acNum = Number(form.ac);
  const evm =
    bac > 0 && pp > 0 && !Number.isNaN(pp) && !Number.isNaN(pa) && !Number.isNaN(acNum)
      ? computeEvm(bac, pp, pa, acNum)
      : null;

  function go(dir: 1 | -1) {
    const i = steps.findIndex((s) => s.key === step);
    const n = steps[i + dir];
    if (n) setStep(n.key);
  }

  return (
    <div className="space-y-4">
      {/* Project + month selector */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <label className="text-sm font-medium text-navy-900">{t('form.selectProject')}</label>
        <select
          value={projectId}
          onChange={(e) => updateQuery({ project: e.target.value })}
          className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-navy-800 focus:border-accent focus:outline-none sm:max-w-xs"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} - {p.name}
            </option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => updateQuery({ month: e.target.value })}
          className="h-9 rounded-xl border border-slate-200 px-2.5 text-sm text-navy-800 focus:border-accent focus:outline-none"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <StatusBadge
          status={project.actualStartDate ? (derivedPctActual >= 1 ? 'Hoan_thanh' : 'Dang_trien_khai') : 'Chuan_bi'}
        />
      </div>

      {/* Steps */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-1">
        {steps.map((s, i) => {
          const active = step === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setStep(s.key)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? 'bg-accent text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/25 text-[10px]">{i + 1}</span>
              {s.label}
            </button>
          );
        })}
      </div>

      <div className={`card p-5 ${locked ? 'pointer-events-none opacity-60' : ''}`}>
        {step === 'profile' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('form.projectCode')}>
              <input value={project.currentAliasCode} disabled className={`${inputCls('code')} bg-slate-50 text-slate-400`} />
              <p className="mt-1 text-[11px] text-slate-400">{t('form.validation.codeReadonly')}</p>
            </Field>
            <Field label={t('form.projectName') + ' *'} hint={t('form.hintLabel.projectName')}>
              <input value={form.projectName} onChange={(e) => set('projectName', e.target.value.toUpperCase())} className={inputCls('name')} />
              {errors.projectName && <p className="mt-1 text-xs text-red-600">{errors.projectName}</p>}
            </Field>
            <Field label={t('form.customer')} hint={t('form.hintLabel.customer')}>
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
                className={selectCls}
              />
            </Field>
            <Field label={t('form.teamKd')}>
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
                className={selectCls}
              />
            </Field>
            <Field label={t('form.projectType')} hint={t('form.hintLabel.projectType')}>
              <Combobox
                value={form.projectType}
                onChange={(v) => set('projectType', v)}
                options={TYPES.map((ty) => ({ value: ty, label: t(typeKey[ty]) }))}
                className={selectCls}
              />
            </Field>
            <Field label={t('form.priority')} hint={t('form.hintLabel.priority')}>
              <Combobox
                value={form.priority}
                onChange={(v) => set('priority', v)}
                options={PRIORITIES.map((p) => ({ value: p, label: p }))}
                className={selectCls}
              />
            </Field>
            <Field label={t('common.market')} hint={t('form.hintLabel.market')}>
              <Combobox
                value={form.marketCode}
                onChange={(v) => set('marketCode', v)}
                options={MARKETS.map((m) => ({ value: m, label: t(marketKey[m]) }))}
                className={selectCls}
              />
            </Field>
            <Field label={t('form.currency')}>
              <Combobox
                value={form.currencyCode}
                onChange={(v) => set('currencyCode', v)}
                options={currencies.map((c) => ({ value: c.code, label: c.code }))}
                className={selectCls}
              />
            </Field>
            <Field label={t('form.contractValue')} hint={t('form.hintLabel.contractValue')}>
              <input type="number" step="0.1" value={fmtNum(form.contractValue)} onChange={(e) => set('contractValue', e.target.value)} className={inputCls('contractValue')} />
            </Field>
            <Field label={`${t('common.tonnage')} (${t('common.ton')})`}>
              <input type="number" step="0.1" value={fmtNum(form.tonnage)} onChange={(e) => set('tonnage', e.target.value)} className={inputCls('tonnage')} />
            </Field>
            <Field label={t('form.contractDate')}>
              <input type="date" value={form.contractDate} onChange={(e) => set('contractDate', e.target.value)} className={inputCls('contractDate')} />
            </Field>
            <Field label={t('form.plannedStart')}>
              <input type="date" value={form.plannedStartDate} onChange={(e) => set('plannedStartDate', e.target.value)} className={inputCls('plannedStartDate')} />
            </Field>
            <Field label={t('form.plannedFinish')}>
              <input type="date" value={form.plannedFinishDate} onChange={(e) => set('plannedFinishDate', e.target.value)} className={inputCls('plannedFinishDate')} />
            </Field>
            <Field label={t('form.committedHandover') + ' *'}>
              <input
                type="date"
                value={form.committedHandoverDate}
                onChange={(e) => set('committedHandoverDate', e.target.value)}
                className={inputCls('committedHandoverDate')}
              />
              {errors.committedHandoverDate && <p className="mt-1 text-xs text-red-600">{errors.committedHandoverDate}</p>}
            </Field>
            <Field label={t('form.actualStart')}>
              <input type="date" value={form.actualStartDate} onChange={(e) => set('actualStartDate', e.target.value)} className={inputCls('actualStartDate')} />
            </Field>
            <Field label={t('form.actualFinish')}>
              <input type="date" value={form.actualFinishDate} onChange={(e) => set('actualFinishDate', e.target.value)} className={inputCls('actualFinishDate')} />
            </Field>
            <Field label={t('form.penaltyValue')}>
              <input type="number" step="0.1" value={fmtNum(form.penaltyValue)} onChange={(e) => set('penaltyValue', e.target.value)} className={inputCls('penaltyValue')} />
            </Field>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-navy-800">
                <input
                  type="checkbox"
                  checked={form.penalized}
                  onChange={(e) => set('penalized', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
                />
                {t('penalty.penalized')}
              </label>
            </div>
          </div>
        )}

        {step === 'progress' && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('form.pctPlan')}>
                <input type="number" step="0.01" value={fmtNum(form.pctPlan)} onChange={(e) => set('pctPlan', e.target.value)} className={inputCls('pctPlan')} />
                <p className="mt-1 text-[11px] text-slate-400">{t('form.hint.pctPlan')}</p>
                {errors.pctPlan && <p className="mt-1 text-xs text-red-600">{errors.pctPlan}</p>}
              </Field>
              <Field label={t('metric.ac') + ' (tỷ)'}>
                <input type="number" step="0.1" value={fmtNum(form.ac)} onChange={(e) => set('ac', e.target.value)} className={inputCls('ac')} />
                <p className="mt-1 text-[11px] text-slate-400">{t('form.hint.ac')}</p>
              </Field>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase text-slate-400">{t('form.stageSection')}</p>
              <div className="space-y-2">
                {STAGE_ORDER.map((s) => (
                  <div key={s}>
                    <div className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-xs text-slate-600">{t(stageKey[s])}</span>
                      <input
                        type="number"
                        step="0.01"
                        value={fmtNum(form.stagePct?.[s] ?? '')}
                        onChange={(e) => {
                          set('stagePct', { ...form.stagePct, [s]: e.target.value });
                          setChainDirty(true);
                        }}
                        className={inputCls('stagePct.' + s)}
                      />
                      <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
                        <input
                          type="checkbox"
                          checked={form.stageApplicable?.[s] ?? true}
                          onChange={(e) => {
                            set('stageApplicable', { ...form.stageApplicable, [s]: e.target.checked });
                            setChainDirty(true);
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
                        />
                        {t('form.stageApplicable')}
                      </label>
                    </div>
                    {errors['stagePct.' + s] && <p className="mt-1 text-xs text-red-600">{errors['stagePct.' + s]}</p>}
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">{t('form.stagePctHint')}</p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-navy-800">
                <span>{t('form.stageTotal')}: <b>{formatPct(derivedPctActual)}</b></span>
                <span>{t('form.currentStage')}: <b>{currentStage ? t(stageKey[currentStage]) : '-'}</b></span>
              </div>
            </div>

            {evm && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase text-slate-400">{t('form.preview')}</p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-navy-800">
                  <span>SPI: <b className={evm.spi != null && evm.spi < THRESHOLDS.spiWarn ? 'text-amber-600' : ''}>{formatRatio(evm.spi)}</b></span>
                  <span>CPI: <b className={evm.cpi != null && evm.cpi < THRESHOLDS.cpiWarn ? 'text-amber-600' : ''}>{formatRatio(evm.cpi)}</b></span>
                  <span>EAC: <b>{formatRatio(evm.eac)}</b></span>
                  <span>VAC: <b>{formatRatio(evm.vac)}</b></span>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'finance' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('metric.revenue') + ' (' + t('metric.cumulative') + ', tỷ)'}>
              <input type="number" step="0.1" value={fmtNum(form.revenueCumulative)} onChange={(e) => set('revenueCumulative', e.target.value)} className={inputCls('rev')} />
            </Field>
            <Field label={t('metric.cost') + ' (' + t('metric.cumulative') + ', tỷ)'}>
              <input type="number" step="0.1" value={fmtNum(form.costActualCumulative)} onChange={(e) => set('costActualCumulative', e.target.value)} className={inputCls('cost')} />
            </Field>
            <Field label={t('metric.collected') + ' (tỷ)'}>
              <input type="number" step="0.1" value={fmtNum(form.arCollected)} onChange={(e) => set('arCollected', e.target.value)} className={inputCls('col')} />
            </Field>
            <Field label={t('metric.overdue') + ' (tỷ)'}>
              <input type="number" step="0.1" value={fmtNum(form.arOverdue)} onChange={(e) => set('arOverdue', e.target.value)} className={inputCls('over')} />
            </Field>
            <Field label={t('metric.outstanding')}>
              <div className="h-9 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-navy-800">
                {fmtNum(String((Number(form.contractValue) || 0) - (Number(form.arCollected) || 0) - (Number(form.arOverdue) || 0)))} tỷ
              </div>
            </Field>
          </div>
        )}

        {step === 'extras' && (
          <div className="space-y-5">
            <div>
              <h4 className="text-sm font-medium text-navy-900">{t('detail.aliasHistory')}</h4>
              <ul className="mt-2 divide-y divide-slate-100">
                {aliases.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-mono text-xs text-navy-800">{a.aliasCode}</span>
                    <span className="text-xs text-slate-400">{a.aliasType}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium text-navy-900">{t('sap.linked')}</h4>
              <ul className="mt-2 divide-y divide-slate-100">
                {sapCodes.length === 0 && <li className="py-2 text-sm text-slate-400">{t('common.noData')}</li>}
                {sapCodes.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-mono text-xs text-navy-800">{s.sapCode}</span>
                    <span className="text-xs text-slate-400">{s.sourceDocType}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-xs font-medium text-slate-600">{t('sap.addSap')}</label>
                  <input
                    value={sapCode}
                    onChange={(e) => setSapCode(e.target.value)}
                    placeholder="SAP-..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                </div>
                <input
                  value={sapDoc}
                  onChange={(e) => setSapDoc(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 px-3 text-sm focus:border-accent focus:outline-none"
                />
                <button
                  onClick={addSap}
                  className="h-9 rounded-xl bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90"
                >
                  {t('common.add')}
                </button>
              </div>
              {sapMsg && <p className="mt-1 text-xs text-red-600">{sapMsg}</p>}
            </div>
          </div>
        )}

        {step === 'extras' && (
          <div className="mt-5 space-y-3">
            <label className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-navy-800 hover:bg-slate-50 ${photoBusy ? 'pointer-events-none opacity-60' : ''}`}>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  uploadPhotos(e.target.files);
                  e.target.value = '';
                }}
              />
              {t('detail.photos')} - {t('common.add')}
            </label>
            {photoErr && <p className="text-xs text-red-600">{photoErr}</p>}
            {photos.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">{t('common.noData')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {photos.map((ph) => (
                  <div key={ph.id} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                    {ph.url ? (
                      <img src={`/api/photos/${ph.url}`} alt={ph.caption || t('detail.photos')} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-slate-400">
                        <IconProject size={24} />
                        <span className="mt-1 px-2 text-center text-xs">{ph.caption}</span>
                      </div>
                    )}
                    <button
                      onClick={() => removePhoto(ph.id)}
                      className="absolute right-1 top-1 rounded-xl bg-white/90 px-2 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-white"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {locked && <Badge tone="warn">{t('form.locked')}</Badge>}
          {!locked && canLock && (
            <button
              onClick={async () => {
                await lockMonthAction(month);
                router.refresh();
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-navy-800 hover:bg-slate-50"
            >
              {t('form.lockMonth')}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {saved && <span className="text-sm text-emerald-600">{t('form.savedProfile')}</span>}
          <div className="ml-auto flex items-center gap-2">
            {step !== 'progress' && (
              <button
                onClick={() => go(-1)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-navy-800 hover:bg-slate-50"
              >
                {t('common.back')}
              </button>
            )}
            {step !== 'extras' && (
              <button
                onClick={() => go(1)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-navy-800 hover:bg-slate-50"
              >
                {t('common.next')}
              </button>
            )}
            <button
              onClick={submit}
              disabled={saving || locked}
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </div>
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


function AlertTab({ alerts }: { alerts: AlertLog[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);

  async function close(id: number) {
    setBusy(id);
    try {
      await closeAlertAction(id, 'Đã xử lý');
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const open = alerts.filter((a) => !a.closedAt);
  return (
    <div className="space-y-2">
      {open.length === 0 && <p className="py-4 text-center text-sm text-slate-400">{t('overview.noAlerts')}</p>}
      {open.map((a) => (
        <div key={a.id} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3">
          <Dot tone={a.alertType === 'Red' ? 'danger' : 'warn'} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge tone={a.alertType === 'Red' ? 'danger' : 'warn'}>{t(`alert.${a.alertType === 'Red' ? 'red' : 'amber'}`)}</Badge>
              <span className="text-xs text-slate-400">{a.ruleTriggered}</span>
            </div>
            <p className="mt-1 text-sm text-navy-800">{a.message}</p>
          </div>
          <button
            onClick={() => close(a.id)}
            disabled={busy === a.id}
            className="shrink-0 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-navy-800 hover:bg-slate-50 disabled:opacity-50"
          >
            {t('alert.closeAlert')}
          </button>
        </div>
      ))}
    </div>
  );
}

function loadDraft(
  projectId: number,
  month: string,
  project: Project,
  fact: FactProgressMonthly | undefined,
  financial: FactFinancial | undefined,
  chain: ValueChainProgress[],
): FormState {
  const stagePct = {} as Record<StageCode, string>;
  const stageApplicable = {} as Record<StageCode, boolean>;
  for (const s of STAGE_ORDER) {
    const v = chain.find((c) => c.stageCode === s);
    stagePct[s] = v ? String(v.pctComplete) : '';
    stageApplicable[s] = v ? v.applicable : true;
  }
  const base: FormState = {
    projectName: project.projectName,
    customerId: String(project.customerId),
    teamKdId: String(project.teamKdId),
    marketCode: project.marketCode,
    projectType: project.projectType,
    priority: project.priority,
    contractValue: String(project.contractValue),
    tonnage: String(project.tonnage),
    currencyCode: project.currencyCode,
    contractDate: project.contractDate ?? '',
    plannedStartDate: project.plannedStartDate ?? '',
    plannedFinishDate: project.plannedFinishDate ?? '',
    committedHandoverDate: project.committedHandoverDate ?? '',
    actualStartDate: project.actualStartDate ?? '',
    actualFinishDate: project.actualFinishDate ?? '',
    penaltyValue: project.penaltyValue != null ? String(project.penaltyValue) : '',
    penalized: project.penalized,
    pctPlan: fact ? String(fact.pctPlan) : '',
    stagePct,
    stageApplicable,
    ac: fact ? String(fact.ac) : '',
    equipmentActual: fact ? String(fact.equipmentActual) : '',
    revenueCumulative: financial ? String(financial.revenueCumulative) : '',
    costActualCumulative: financial ? String(financial.costActualCumulative) : '',
    arCollected: financial ? String(financial.arCollected) : '',
    arOutstanding: financial ? String(financial.arOutstanding) : '',
    arOverdue: financial ? String(financial.arOverdue) : '',
  };
  const key = `ddc_draft_${projectId}_${month}`;
  const saved = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
  if (saved) {
    try {
      // Draft cũ có thể thiếu stagePct/stageApplicable → merge lên base để không crash.
      return { ...base, ...(JSON.parse(saved) as Partial<FormState>) };
    } catch {
      /* ignore */
    }
  }
  return base;
}

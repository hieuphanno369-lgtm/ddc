'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type {
  AlertLog,
  Currency,
  Customer,
  FactFinancial,
  FactProgressMonthly,
  Market,
  Priority,
  Project,
  ProjectAlias,
  ProjectKeyMilestone,
  ProjectPhoto,
  ProjectSapCode,
  ProjectType,
  TeamKd,
  ValueChainProgress,
} from '@/server/repo/types';
import type { IsoDate } from '@/lib/clock';
import { marketKey, stageKey, typeKey } from '@/lib/labels';
import { computeEvm } from '@/lib/evm';
import { STAGE_ORDER, calcChainPctActual, findCurrentStage, normPct } from '@/lib/stages';
import { THRESHOLDS } from '@/lib/thresholds';
import { fmtNum, formatDateTime, formatPct, formatRatio, toTitleCase } from '@/lib/format';
import { normalizeKeyMilestones, toKeyMilestoneDraft, validateKeyMilestones, type KeyMilestoneDraft, type KeyMsErrors } from '@/lib/key-milestones';
import { addSapCodeAction, closeAlertAction, createDimValueAction, deletePhotoAction, lockMonthAction, saveKeyMilestonesAction, saveMonthlyData } from '@/server/actions';
import {
  buildBaseForm,
  buildSavePatch,
  checkDraft,
  draftKey,
  formsEqual,
  legacyDraftKey,
  makeStamp,
  restoreDraft,
  saveErrorKind,
  type DraftCheck,
  type FormState,
} from './dataEntryState';
import { Combobox } from './Combobox';
import { KeyMilestoneEditor } from './KeyMilestoneEditor';
import { PhotoDropzone } from './PhotoDropzone';
import { Badge, Dot } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/Badges';
import { IconProject } from '@/components/icons';
import { HelpTip } from '@/components/ui/HelpTip';

export type DataEntryStep = 'progress' | 'finance' | 'profile' | 'extras';
type Step = DataEntryStep;

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
  keyMilestones: ProjectKeyMilestone[];
  today: IsoDate;
  initialStep?: DataEntryStep;
  canEditFinance: boolean;
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
  keyMilestones,
  today,
  initialStep,
  canEditFinance,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();

  const base = useMemo(() => buildBaseForm(project, fact, financial, chain), [project, fact, financial, chain]);
  const stamp = useMemo(() => makeStamp(project, fact, financial), [project, fact, financial]);

  const [step, setStep] = useState<Step>(initialStep ?? 'progress');
  const [form, setForm] = useState<FormState>(() => base);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | undefined>(undefined);
  const [noChangeMsg, setNoChangeMsg] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<Extract<DraftCheck, { kind: 'fresh' | 'stale' }> | null>(null);
  const [msRows, setMsRows] = useState<KeyMilestoneDraft[]>(() => keyMilestones.map(toKeyMilestoneDraft));
  const [msDirty, setMsDirty] = useState(false);
  const [msErrors, setMsErrors] = useState<KeyMsErrors>({});
  const [msSaveErr, setMsSaveErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SAP add
  const [sapCode, setSapCode] = useState('');
  const [sapDoc, setSapDoc] = useState('Hợp đồng con');
  const [sapMsg, setSapMsg] = useState<string | null>(null);

  // Chạy 1 lần khi mount: dọn bản nháp v1 cũ (không bao giờ áp), rồi soi bản nháp v2 hiện có.
  useEffect(() => {
    localStorage.removeItem(legacyDraftKey(projectId, month));
    const check = checkDraft(localStorage.getItem(draftKey(projectId, month)), stamp);
    if (check.kind === 'foreign') {
      localStorage.removeItem(draftKey(projectId, month));
    } else if (check.kind === 'fresh' || check.kind === 'stale') {
      setPendingDraft(check);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draft auto-save (debounced) - bỏ qua khi còn banner nháp chờ quyết định.
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (pendingDraft) return;
      if (formsEqual(form, base)) {
        localStorage.removeItem(draftKey(projectId, month));
      } else {
        localStorage.setItem(
          draftKey(projectId, month),
          JSON.stringify({ v: 2, savedAt: new Date().toISOString(), stamp, form }),
        );
      }
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form, base, stamp, pendingDraft, projectId, month]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }) as FormState);
    setSaved(false);
    setSaveErr(undefined);
    setNoChangeMsg(false);
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
    let msOk = true;
    if (msDirty) {
      const r = validateKeyMilestones(msRows);
      setMsErrors(r.errors);
      msOk = r.ok;
      if (!r.ok) setStep('profile');
    }
    // Chỉ chặn khi nhập SAI (vượt range %). Thiếu field → cho submit, bổ sung sau.
    return msOk && !e.pctPlan && !STAGE_ORDER.some((s) => e['stagePct.' + s]);
  }

  async function submit() {
    if (!validate()) return;
    const patch = buildSavePatch(base, form, { canEditFinance });
    const hasPatch = Object.keys(patch).length > 0;
    if (!hasPatch && !msDirty) {
      setSaveErr(undefined);
      setSaved(false);
      setNoChangeMsg(true);
      return;
    }
    setNoChangeMsg(false);
    setSaving(true);
    try {
      let res: { ok: boolean; error?: string } = { ok: true };
      if (hasPatch) {
        res = await saveMonthlyData(projectId, month, patch);
      }
      if (res.ok) {
        localStorage.removeItem(draftKey(projectId, month));
        setSaveErr(undefined);
        if (msDirty) {
          const ms = await saveKeyMilestonesAction(projectId, normalizeKeyMilestones(msRows));
          if (ms.ok) { setMsDirty(false); setMsSaveErr(null); } else setMsSaveErr(t('form.keyMs.saveError'));
        }
        router.refresh();
        setSaved(true);
      } else {
        setSaveErr(res.error);
      }
    } catch (e) {
      // Mục 5 (danh-gia.md, vong sua 1): server action nem loi (vd 2 nguoi cung luu lan dau 1
      // thang -> partial unique index ux_fact_progress_latest tu choi ban thu 2) truoc day roi
      // vao khoang khong - nguoi dung khong thay gi. Hien qua nhanh dataGuard.save.generic san co.
      setSaveErr(e instanceof Error ? e.message : 'Lỗi không xác định');
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

  const inputCls = (key: string) => `inp${errors[key] ? ' bad' : ''}`;
  const selectCls = 'inp';

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
      <div className="card overflow-visible flex flex-wrap items-center gap-3 p-4">
        <label className="text-footnote font-semibold">{t('form.selectProject')}</label>
        <select
          value={projectId}
          onChange={(e) => updateQuery({ project: e.target.value })}
          className="inp min-w-0 flex-1 sm:max-w-xs"
          style={{ width: 'auto' }}
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
          className="inp"
          style={{ width: 'auto' }}
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

      {pendingDraft && (
        <div className="sumbar">
          <p>{t('dataGuard.draft.found', { time: formatDateTime(pendingDraft.draft.savedAt) })}</p>
          {pendingDraft.kind === 'stale' && <p>{t('dataGuard.draft.stale')}</p>}
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={() => {
                setForm(restoreDraft(base, pendingDraft.draft));
                setPendingDraft(null);
              }}
            >
              {t('dataGuard.draft.restore')}
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                localStorage.removeItem(draftKey(projectId, month));
                setPendingDraft(null);
              }}
            >
              {t('dataGuard.draft.discard')}
            </button>
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="msdetail" style={{ borderBottom: 'none', background: 'transparent', padding: 0 }}>
        {steps.map((s, i) => {
          const active = step === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setStep(s.key)}
              className="k"
              style={active ? { background: 'var(--accent-tint)', color: 'var(--accent)', borderColor: 'transparent' } : undefined}
            >
              <b>{i + 1}</b>
              {s.label}
            </button>
          );
        })}
      </div>

      <div className={`card overflow-visible ${locked ? 'pointer-events-none opacity-60' : ''}`}>
        <div className="bd">
        {step === 'profile' && (
          <>
          <div className="f2">
            <Field label={t('form.projectCode')}>
              <input value={project.currentAliasCode} disabled className="inp ro" />
              <p className="hintline">{t('form.validation.codeReadonly')}</p>
            </Field>
            <Field label={t('form.projectName') + ' *'} hint={t('form.hintLabel.projectName')}>
              <input value={form.projectName} onChange={(e) => set('projectName', e.target.value.toUpperCase())} className={inputCls('name')} />
              {errors.projectName && <p className="hintline" style={{ color: 'var(--danger)' }}>{errors.projectName}</p>}
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
              {errors.committedHandoverDate && <p className="hintline" style={{ color: 'var(--danger)' }}>{errors.committedHandoverDate}</p>}
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
              <label className="flex items-center gap-2 text-footnote">
                <input
                  type="checkbox"
                  checked={form.penalized}
                  onChange={(e) => set('penalized', e.target.checked)}
                  className="h-4 w-4 rounded border-sep2 text-brand focus:ring-brand"
                />
                {t('penalty.penalized')}
              </label>
            </div>
          </div>
            <KeyMilestoneEditor id="key-milestones" value={msRows} today={today} errors={msErrors}
              onChange={(rows) => { setMsRows(rows); setMsDirty(true); setSaved(false); }} />
            {Object.keys(msErrors).length > 0 && <p className="sumbar bad" style={{ marginTop: 10 }}>{t('form.keyMs.invalid')}</p>}
            {msSaveErr && <p className="sumbar bad" style={{ marginTop: 10 }}>{msSaveErr}</p>}
          </>
        )}

        {step === 'progress' && (
          <div className="space-y-4">
            <div className="f2">
              <Field label={t('form.pctPlan')}>
                <input type="number" step="0.01" value={fmtNum(form.pctPlan)} onChange={(e) => set('pctPlan', e.target.value)} className={inputCls('pctPlan')} />
                <p className="hintline">{t('form.hint.pctPlan')}</p>
                {errors.pctPlan && <p className="hintline" style={{ color: 'var(--danger)' }}>{errors.pctPlan}</p>}
              </Field>
              <Field label={t('metric.ac') + ' (tỷ)'}>
                <input type="number" step="0.1" value={fmtNum(form.ac)} onChange={(e) => set('ac', e.target.value)} className={inputCls('ac')} />
                <p className="hintline">{t('form.hint.ac')}</p>
              </Field>
            </div>

            <div>
              <div className="sect"><b>{t('form.stageSection')}</b><i /></div>
              <div className="stagegrid">
                {STAGE_ORDER.map((s, i) => {
                  const pct = stageInputs[i].pctComplete;
                  return (
                    <div key={s}>
                      <div className="stage">
                        <span className="nm">{t(stageKey[s])}</span>
                        <span className="w">-</span>
                        <div className="bar"><i className="fill" style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%` }} /></div>
                        <span className="pc">{formatPct(pct)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          step="0.01"
                          value={fmtNum(form.stagePct?.[s] ?? '')}
                          onChange={(e) => set('stagePct', { ...form.stagePct, [s]: e.target.value })}
                          className={inputCls('stagePct.' + s)}
                        />
                        <label className="inline" style={{ fontSize: 'var(--t-caption1)', color: 'var(--label2)' }}>
                          <input
                            type="checkbox"
                            checked={form.stageApplicable?.[s] ?? true}
                            onChange={(e) => set('stageApplicable', { ...form.stageApplicable, [s]: e.target.checked })}
                            className="h-4 w-4 rounded border-sep2 text-brand focus:ring-brand"
                          />
                          {t('form.stageApplicable')}
                        </label>
                      </div>
                      {errors['stagePct.' + s] && <p className="hintline" style={{ color: 'var(--danger)' }}>{errors['stagePct.' + s]}</p>}
                    </div>
                  );
                })}
              </div>
              <p className="hintline">{t('form.stagePctHint')}</p>
              <div className="chainfoot">
                <span>{t('form.stageTotal')}: <b>{formatPct(derivedPctActual)}</b></span>
                <span>{t('form.currentStage')}: <b>{currentStage ? t(stageKey[currentStage]) : '-'}</b></span>
              </div>
            </div>

            {evm && (
              <div className="sumbar" style={{ display: 'block' }}>
                <p className="text-caption2 font-bold uppercase text-label3">{t('form.preview')}</p>
                <div className="chainfoot">
                  <span>SPI: <b className={evm.spi != null && evm.spi < THRESHOLDS.spiWarn ? 'text-warn' : ''}>{formatRatio(evm.spi)}</b></span>
                  <span>CPI: <b className={evm.cpi != null && evm.cpi < THRESHOLDS.cpiWarn ? 'text-warn' : ''}>{formatRatio(evm.cpi)}</b></span>
                  <span>EAC: <b>{formatRatio(evm.eac)}</b></span>
                  <span>VAC: <b>{formatRatio(evm.vac)}</b></span>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'finance' && (
          <div className="f2">
            <Field label={t('metric.revenue') + ' (' + t('metric.cumulative') + ', tỷ)'}>
              <input type="number" step="0.1" disabled={!canEditFinance} value={fmtNum(form.revenueCumulative)} onChange={(e) => set('revenueCumulative', e.target.value)} className={canEditFinance ? inputCls('rev') : 'inp ro'} />
            </Field>
            <Field label={t('metric.cost') + ' (' + t('metric.cumulative') + ', tỷ)'}>
              <input type="number" step="0.1" disabled={!canEditFinance} value={fmtNum(form.costActualCumulative)} onChange={(e) => set('costActualCumulative', e.target.value)} className={canEditFinance ? inputCls('cost') : 'inp ro'} />
            </Field>
            <Field label={t('metric.collected') + ' (tỷ)'}>
              <input type="number" step="0.1" disabled={!canEditFinance} value={fmtNum(form.arCollected)} onChange={(e) => set('arCollected', e.target.value)} className={canEditFinance ? inputCls('col') : 'inp ro'} />
            </Field>
            <Field label={t('metric.overdue') + ' (tỷ)'}>
              <input type="number" step="0.1" disabled={!canEditFinance} value={fmtNum(form.arOverdue)} onChange={(e) => set('arOverdue', e.target.value)} className={canEditFinance ? inputCls('over') : 'inp ro'} />
            </Field>
            <Field label={t('metric.outstanding')}>
              <div className="text-footnote font-semibold" style={{ background: 'var(--fill)', borderRadius: 'var(--r-sm)', padding: '9px 12px' }}>
                {fmtNum(String((Number(form.contractValue) || 0) - (Number(form.arCollected) || 0) - (Number(form.arOverdue) || 0)))} tỷ
              </div>
            </Field>
            {!canEditFinance && <p className="hintline" style={{ gridColumn: '1 / -1' }}>{t('dataGuard.save.financeReadonly')}</p>}
          </div>
        )}

        {step === 'extras' && (
          <div className="space-y-5">
            <div>
              <h4 className="text-footnote font-semibold">{t('detail.aliasHistory')}</h4>
              <ul className="mt-2 flex flex-col">
                {aliases.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2 text-footnote border-t-[0.5px] border-sep first:border-t-0">
                    <span className="mono">{a.aliasCode}</span>
                    <span className="text-caption1 text-label3">{a.aliasType}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-footnote font-semibold">{t('sap.linked')}</h4>
              <ul className="mt-2 flex flex-col">
                {sapCodes.length === 0 && <li className="empty">{t('common.noData')}</li>}
                {sapCodes.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2 text-footnote border-t-[0.5px] border-sep first:border-t-0">
                    <span className="mono">{s.sapCode}</span>
                    <span className="text-caption1 text-label3">{s.sourceDocType}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1 field">
                  <span className="lb">{t('sap.addSap')}</span>
                  <input
                    value={sapCode}
                    onChange={(e) => setSapCode(e.target.value)}
                    placeholder="SAP-..."
                    className="inp"
                  />
                </div>
                <input
                  value={sapDoc}
                  onChange={(e) => setSapDoc(e.target.value)}
                  className="inp"
                  style={{ width: 'auto' }}
                />
                <button
                  onClick={addSap}
                  className="btn"
                >
                  {t('common.add')}
                </button>
              </div>
              {sapMsg && <p className="hintline" style={{ color: 'var(--danger)' }}>{sapMsg}</p>}
            </div>
          </div>
        )}

        {step === 'extras' && (
          <div className="mt-5 space-y-3">
            <PhotoDropzone
              projectId={projectId}
              yearMonth={month}
              disabled={locked}
              onUploaded={() => router.refresh()}
            />
            {photos.length === 0 ? (
              <p className="empty">{t('common.noData')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {photos.map((ph) => (
                  <div key={ph.id} className="relative aspect-[4/3] overflow-hidden rounded-md" style={{ background: 'var(--fill)' }}>
                    {ph.url ? (
                      <img src={`/api/photos/${ph.url}`} alt={ph.caption || t('detail.photos')} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-label3">
                        <IconProject size={24} />
                        <span className="mt-1 px-2 text-center text-xs">{ph.caption}</span>
                      </div>
                    )}
                    <button
                      onClick={() => removePhoto(ph.id)}
                      className="absolute right-1 top-1 rounded-md px-2 py-1 text-caption1 font-semibold"
                      style={{ background: 'var(--glass-3)', color: 'var(--danger)', boxShadow: 'var(--e1)' }}
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
      </div>

      {/* Actions */}
      <div className="stickybar">
        {saveErr && (
          <p className="sumbar bad">
            {(() => {
              const kind = saveErrorKind(saveErr);
              if (kind === 'generic') return t('dataGuard.save.generic', { msg: saveErr });
              if (kind === 'locked') return t('dataGuard.save.locked', { month });
              return t(`dataGuard.save.${kind}`);
            })()}
          </p>
        )}
        <div className="flex items-center gap-2">
          {locked && <Badge tone="warn">{t('form.locked')}</Badge>}
          {!locked && canLock && (
            <button
              onClick={async () => {
                await lockMonthAction(month);
                router.refresh();
              }}
              className="btn ghost"
            >
              {t('form.lockMonth')}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {saved && <span className="chip c-ok">{t('form.savedProfile')}</span>}
          {!saved && noChangeMsg && <span className="chip">{t('dataGuard.save.noChange')}</span>}
          <div className="ml-auto flex items-center gap-2">
            {step !== 'progress' && (
              <button
                onClick={() => go(-1)}
                className="btn ghost"
              >
                {t('common.back')}
              </button>
            )}
            {step !== 'extras' && (
              <button
                onClick={() => go(1)}
                className="btn ghost"
              >
                {t('common.next')}
              </button>
            )}
            <button
              onClick={submit}
              disabled={saving || locked}
              className="btn"
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
    <div className="field">
      <span className="lb">
        {label}
        {hint && (
          <HelpTip text={hint} label={hint} />
        )}
      </span>
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
    <div className="flex flex-col gap-2.5">
      {open.length === 0 && <p className="empty">{t('overview.noAlerts')}</p>}
      {open.map((a) => (
        <div key={a.id} className="alert">
          <span className="dot" style={{ background: a.alertType === 'Red' ? 'var(--danger)' : 'var(--warn)' }} />
          <div className="min-w-0 flex-1">
            <h4>{a.message}</h4>
            <div className="mt">
              <Badge tone={a.alertType === 'Red' ? 'danger' : 'warn'}>{t(`alert.${a.alertType === 'Red' ? 'red' : 'amber'}`)}</Badge>
              <span>{a.ruleTriggered}</span>
            </div>
          </div>
          <button
            onClick={() => close(a.id)}
            disabled={busy === a.id}
            className="btn ghost disabled:opacity-50"
            style={{ padding: '6px 12px', fontSize: 'var(--t-caption1)' }}
          >
            {t('alert.closeAlert')}
          </button>
        </div>
      ))}
    </div>
  );
}


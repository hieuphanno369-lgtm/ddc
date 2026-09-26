'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type {
  Contractor, Currency, Customer, ExchangeRate, Factory, Project, ProjectKeyMilestone, ProjectSapCode,
  ProjectStageWeight, ProjectType, StageWeightInput, TeamKd,
} from '@/server/repo/types';
import type { AssignableUser, ProjectFormState } from '@/lib/project-form';
import {
  FORM_COUNT_FIELDS, PROJECT_NAME_MAX, buildCreateInput, buildUpdatePatch, countFilled, createErrorField,
  emptyProjectForm, fxPreview, projectFormFromProject, validateAliasChange, validateProjectForm,
} from '@/lib/project-form';
import { isValidProjectCode } from '@/lib/project-code';
import { marketKey, typeKey } from '@/lib/labels';
import { fmtNum, formatDateTime, formatTon, toTitleCase } from '@/lib/format';
import { STAGE_ORDER, DEFAULT_STAGE_WEIGHTS, validateStageWeights } from '@/lib/stages';
import { presetWeightsFor } from '@/lib/stage-weight-presets';
import {
  normalizeKeyMilestones, toKeyMilestoneDraft, validateKeyMilestones, type KeyMilestoneDraft, type KeyMsErrors,
} from '@/lib/key-milestones';
import { draftOwnerTag, purgeForeignDrafts } from '@/lib/drafts';
import { checkProjectDraft, PROJECT_DRAFT_VERSION, projectDraftKey, restoreProjectDraft, toProjectDraftForm, type ProjectDraft } from '@/lib/project-draft';
import { createDimValueAction, saveKeyMilestonesAction } from '@/server/actions';
import { changeProjectCodeAction, updateProjectAction, saveStageWeightsAction, type UpdateProjectPatch } from '@/server/actions-project';
import { createProjectAction } from '@/server/actions';
import { Combobox } from './Combobox';
import { KeyMilestoneEditor } from './KeyMilestoneEditor';
import { StageWeightEditor } from './StageWeightEditor';
import { ProjectLinksSection } from './ProjectLinksSection';
import { HelpTip } from '@/components/ui/HelpTip';
import { Switch } from '@/components/ui/Switch';
import type { IsoDate } from '@/lib/clock';
import type { ProjectMember } from '@/server/repo/types';

const TYPES: ProjectType[] = ['EPC', 'San_van_dong', 'San_bay', 'Nha_xuong', 'Cau_cang', 'Cao_tang', 'Dong_tau', 'Cau_giao_thong', 'Khac'];
const PRIORITIES = ['P0', 'P1', 'P2', 'P3'] as const;
const MARKETS = ['TN', 'XK', 'NoiBo'] as const;

export interface ProjectFormProps {
  mode: 'new' | 'edit';
  project: Project | null;
  projects: { id: number; name: string; code: string }[];
  customers: Customer[];
  teams: TeamKd[];
  currencies: Currency[];
  factories: Factory[];
  exchangeRates: ExchangeRate[];
  sapCodes: ProjectSapCode[];
  stageWeights: ProjectStageWeight[];
  keyMilestones: ProjectKeyMilestone[];
  members: ProjectMember[];
  assignableUsers: AssignableUser[] | null;
  contractorMembers: Contractor[];
  allContractors: Contractor[];
  ownerEmail: string;
  today: IsoDate;
}

function weightsFromProps(rows: ProjectStageWeight[]): StageWeightInput[] {
  return STAGE_ORDER.map((code) => {
    const row = rows.find((r) => r.stageCode === code);
    return row ? { stageCode: row.stageCode, weightPct: row.weightPct, applicable: row.applicable } : { stageCode: code, weightPct: 0, applicable: false };
  });
}

function Field({ label, hint, alignRight, children }: { label: string; hint?: string; required?: boolean; alignRight?: boolean; children: React.ReactNode }) {
  return (
    <div className="field">
      <span className="lb">{label}{hint && <HelpTip text={hint} label={hint} alignRight={alignRight} />}</span>
      {children}
    </div>
  );
}

export function ProjectForm(p: ProjectFormProps) {
  const {
    mode, project, projects, customers, teams, currencies, factories, exchangeRates, sapCodes, stageWeights,
    keyMilestones, members, assignableUsers, contractorMembers, allContractors, ownerEmail, today,
  } = p;
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const base = useMemo(() => (project ? projectFormFromProject(project) : emptyProjectForm()), [project]);
  const [form, setForm] = useState<ProjectFormState>(base);
  const [weights, setWeights] = useState<StageWeightInput[]>(() => (project ? weightsFromProps(stageWeights) : [...DEFAULT_STAGE_WEIGHTS]));
  const [weightsDirty, setWeightsDirty] = useState(false);
  const [msRows, setMsRows] = useState<KeyMilestoneDraft[]>(() => keyMilestones.map(toKeyMilestoneDraft));
  const [msDirty, setMsDirty] = useState(false);
  const [msErrors, setMsErrors] = useState<KeyMsErrors>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [serverErr, setServerErr] = useState<{ currentAliasCode?: 'code_taken' | 'code_reserved' }>({});
  const [aliasReason, setAliasReason] = useState('');
  const [pendingDraft, setPendingDraft] = useState<Extract<ReturnType<typeof checkProjectDraft>, { kind: 'fresh' | 'stale' }> | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ownerTag = useMemo(() => draftOwnerTag(ownerEmail), [ownerEmail]);
  const draftStorageKey = useMemo(() => projectDraftKey(ownerTag, project?.id ?? null), [ownerTag, project?.id]);

  function set<K extends keyof ProjectFormState>(key: K, value: ProjectFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setMsg(null);
    if (key === 'currentAliasCode') setServerErr({});
  }

  // G-6 (Q1, ĐÃ CHỐT): đổi Loại dự án lúc TẠO mới, chưa tự sửa trọng số tay -> điền lại bảng trọng số
  // theo loại. Chế độ SỬA không tự đổi (Q1-b).
  function setProjectType(value: string) {
    set('projectType', value);
    if (mode === 'new' && !weightsDirty) {
      setWeights(presetWeightsFor(value as ProjectType | ''));
    }
  }

  function saveDraftNow() {
    const payload: ProjectDraft = {
      v: PROJECT_DRAFT_VERSION,
      savedAt: new Date().toISOString(),
      projectCreatedAt: project?.createdAt ?? null,
      projectUpdatedAt: project?.updatedAt ?? null,
      form: toProjectDraftForm(form),
      keyMilestones: msRows,
      stageWeights: weights,
    };
    localStorage.setItem(draftStorageKey, JSON.stringify(payload));
    setMsg({ tone: 'ok', text: t('form.draftSaved') });
  }

  // Chạy 1 lần khi mount: dọn nháp của người khác dùng chung máy trước, rồi soi bản nháp của mình -
  // KHÔNG BAO GIỜ tự áp, chỉ hiện banner để người dùng chọn.
  useEffect(() => {
    try {
      purgeForeignDrafts(localStorage, ownerTag);
    } catch {
      // localStorage có thể bị chặn (chế độ riêng tư) - không chặn luồng mở form.
    }
    const check = checkProjectDraft(localStorage.getItem(draftStorageKey), project);
    if (check.kind === 'foreign') {
      localStorage.removeItem(draftStorageKey);
    } else if (check.kind === 'fresh' || check.kind === 'stale') {
      setPendingDraft(check);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tự lưu nháp sau 800ms khi có thay đổi - bỏ qua khi còn banner nháp chờ quyết định.
  // Lưu ý: đổi "Các mốc chính"/trọng số không làm đổi `project.updatedAt` (2 bảng cấu hình riêng),
  // nên checkProjectDraft có thể không bắt được "stale" cho 2 phần này - chấp nhận được vì nháp
  // chỉ áp khi người dùng tự bấm "Khôi phục".
  useEffect(() => {
    if (pendingDraft) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const unchanged = JSON.stringify(form) === JSON.stringify(base) && !weightsDirty && !msDirty;
      if (unchanged) {
        localStorage.removeItem(draftStorageKey);
      } else {
        const payload: ProjectDraft = {
          v: PROJECT_DRAFT_VERSION,
          savedAt: new Date().toISOString(),
          projectCreatedAt: project?.createdAt ?? null,
          projectUpdatedAt: project?.updatedAt ?? null,
          form: toProjectDraftForm(form),
          keyMilestones: msRows,
          stageWeights: weights,
        };
        localStorage.setItem(draftStorageKey, JSON.stringify(payload));
      }
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, weights, msRows, weightsDirty, msDirty, pendingDraft, draftStorageKey]);

  const fx = fxPreview(form, exchangeRates);
  const validation = validateProjectForm(form, mode, mode === 'edit' ? base : null, exchangeRates);
  const errors = validation.errors;
  const dates = validation.dates;
  const inputCls = (key: keyof ProjectFormState) => `inp${errors[key] ? ' bad' : ''}`;
  const codeChanged = mode === 'edit' && form.currentAliasCode !== base.currentAliasCode;
  const aliasIssue = codeChanged ? validateAliasChange(base, form, aliasReason) : null;
  const aliasErr = errors.currentAliasCode ?? serverErr.currentAliasCode;

  function partialErrorMsg(error: string | undefined): string {
    if (!error) return '';
    if (error === 'Invalid input') return t('projectForm.err.invalid');
    const key = `projectForm.err.${error}`;
    return t.has(key) ? t(key) : error;
  }

  const dirty =
    JSON.stringify(form) !== JSON.stringify(base) || weightsDirty || msDirty
    || (mode === 'edit' && Object.keys(msErrors).length > 0);

  function scrollToFirstError() {
    const firstKey = Object.keys(errors)[0];
    if (!firstKey) return;
    formRef.current?.querySelector<HTMLElement>(`[data-field="${firstKey}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function handleCancel() {
    if (dirty && !window.confirm(t('projectForm.confirmDiscard'))) return;
    setForm(base);
    setWeights(project ? weightsFromProps(stageWeights) : [...DEFAULT_STAGE_WEIGHTS]);
    setWeightsDirty(false);
    setMsRows(keyMilestones.map(toKeyMilestoneDraft));
    setMsDirty(false);
    setMsErrors({});
    setMsg(null);
  }

  async function handleSaveNew() {
    if (!validation.ok) {
      setMsg({ tone: 'bad', text: t('projectForm.err.invalid') });
      scrollToFirstError();
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await createProjectAction({
        ...buildCreateInput(form, fx),
        keyMilestones: msRows.length ? normalizeKeyMilestones(msRows) : undefined,
        stageWeights: weights,
      });
      if (res.ok) {
        localStorage.removeItem(draftStorageKey);
        setMsg({ tone: 'ok', text: t('projectForm.saved.created') });
        router.replace(`?project=${res.id}`);
        router.refresh();
      } else {
        const f = createErrorField(res.error ?? '');
        if (f) {
          setServerErr({ [f.field]: f.code });
          setMsg({ tone: 'bad', text: t(`projectForm.err.${f.code}`) });
          formRef.current?.querySelector<HTMLElement>('[data-field="currentAliasCode"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          const key = `projectForm.err.${res.error}`;
          setMsg({ tone: 'bad', text: t.has(key) ? t(key) : t('projectForm.err.generic', { msg: res.error }) });
        }
      }
    } catch {
      setMsg({ tone: 'bad', text: t('projectForm.err.unexpected') });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    if (!project) return;
    if (!validation.ok) {
      setMsg({ tone: 'bad', text: t('projectForm.err.invalid') });
      scrollToFirstError();
      return;
    }
    if (aliasIssue) {
      setMsg({ tone: 'bad', text: t('projectForm.err.invalid') });
      const field = aliasIssue === 'reason_short' ? 'aliasReason' : 'currentAliasCode';
      formRef.current?.querySelector<HTMLElement>(`[data-field="${field}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const patch: UpdateProjectPatch = buildUpdatePatch(base, form, fx);
      const done: string[] = [];

      if (Object.keys(patch).length > 0) {
        const res = await updateProjectAction(project.id, patch);
        if (!res.ok) {
          setMsg({ tone: 'bad', text: t('projectForm.err.partial', { done: done.join(', ') || '-', failed: t('projectForm.part.profile'), msg: partialErrorMsg(res.error) }) });
          return;
        }
        done.push(t('projectForm.part.profile'));
      }

      if (codeChanged) {
        const res = await changeProjectCodeAction(project.id, form.currentAliasCode, aliasReason);
        if (!res.ok && res.error !== 'unchanged') {
          setMsg({ tone: 'bad', text: t('projectForm.err.partial', { done: done.join(', ') || '-', failed: t('projectForm.part.code'), msg: partialErrorMsg(res.error) }) });
          return;
        }
        done.push(t('projectForm.part.code'));
      }

      if (weightsDirty) {
        const res = await saveStageWeightsAction(project.id, weights);
        if (!res.ok) {
          setMsg({ tone: 'bad', text: t('projectForm.err.partial', { done: done.join(', ') || '-', failed: t('projectForm.part.weights'), msg: partialErrorMsg(res.error) }) });
          return;
        }
        done.push(t('projectForm.part.weights'));
      }

      if (msDirty) {
        const res = await saveKeyMilestonesAction(project.id, normalizeKeyMilestones(msRows));
        if (!res.ok) {
          setMsg({ tone: 'bad', text: t('projectForm.err.partial', { done: done.join(', ') || '-', failed: t('projectForm.part.milestones'), msg: 'error' in res ? partialErrorMsg(res.error) : '' }) });
          return;
        }
        done.push(t('projectForm.part.milestones'));
      }

      if (done.length === 0) {
        setMsg({ tone: 'ok', text: t('dataGuard.save.noChange') });
        return;
      }
      localStorage.removeItem(draftStorageKey);
      setMsg({ tone: 'ok', text: t('projectForm.saved.updated') });
      setWeightsDirty(false);
      setMsDirty(false);
      router.refresh();
    } catch {
      setMsg({ tone: 'bad', text: t('projectForm.err.unexpected') });
    } finally {
      setSaving(false);
    }
  }

  const filled = countFilled(form);
  const total = FORM_COUNT_FIELDS.length;

  return (
    <div ref={formRef}>
      <div className="card rise overflow-visible">
        <div className="hd">
          <h3>{mode === 'new' ? t('projectForm.title.new') : t('projectForm.title.edit', { name: project?.projectName ?? '' })}</h3>
          <div className="seg">
            <button type="button" className={mode === 'new' ? 'on' : ''} onClick={() => router.push('?mode=new')}>
              {t('projectForm.mode.new')}
            </button>
            <button
              type="button"
              className={mode === 'edit' ? 'on' : ''}
              disabled={projects.length === 0}
              onClick={() => router.push(`?project=${project?.id ?? projects[0]?.id}`)}
            >
              {t('projectForm.mode.edit')}
            </button>
          </div>
        </div>
        {mode === 'edit' && projects.length > 1 && (
          <div className="bd">
            <select value={project?.id} onChange={(e) => router.push(`?project=${e.target.value}`)} className="inp">
              {projects.map((pr) => (
                <option key={pr.id} value={pr.id}>{pr.code} - {pr.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="msdetail">
          <b>{mode === 'new' ? t('projectForm.steps.lead.new') : t('projectForm.steps.lead.edit')}</b>
          {(['s1', 's2', 's3', 's4', 's5', 's6'] as const).map((s) => (
            <span key={s} className="k">{t(`projectForm.steps.${s}`)}</span>
          ))}
          <span className="hint">{t('projectForm.steps.hint')}</span>
        </div>
      </div>

      {pendingDraft && (
        <div className="sumbar">
          <p>{t('dataGuard.draft.found', { time: formatDateTime(pendingDraft.draft.savedAt) })}</p>
          {pendingDraft.kind === 'stale' && <p>{t('dataGuard.draft.stale')}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setForm(restoreProjectDraft(base, pendingDraft.draft));
                if (pendingDraft.draft.stageWeights.length === 7) {
                  setWeights(pendingDraft.draft.stageWeights);
                  setWeightsDirty(true);
                }
                if (pendingDraft.draft.keyMilestones.length > 0) {
                  setMsRows(pendingDraft.draft.keyMilestones);
                  setMsDirty(true);
                }
                setPendingDraft(null);
              }}
            >
              {t('dataGuard.draft.restore')}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                localStorage.removeItem(draftStorageKey);
                setPendingDraft(null);
              }}
            >
              {t('dataGuard.draft.discard')}
            </button>
          </div>
        </div>
      )}

      <div className="card rise overflow-visible">
        <div className="bd" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Mục 1: Định danh */}
          <div className="fsec">
            <div className="h"><span className="n">1</span><h4>{t('projectForm.sec.identity.title')}</h4><p>{t('projectForm.sec.identity.sub')}</p></div>
            <div className="f4 feven">
              <Field label={t('projectForm.field.masterCode')}>
                <input className="inp ro" readOnly value={mode === 'new' ? t('projectForm.field.masterAuto') : project?.masterCode ?? ''} />
                <span className="hintline">{t('projectForm.field.masterHint')}</span>
              </Field>
              <div className="field" data-field="currentAliasCode">
                <span className="lb">{t('projectForm.field.aliasCode')}<HelpTip text={t('projectForm.tipText.aliasCode')} label={t('projectForm.tipText.aliasCode')} /></span>
                <input
                  value={form.currentAliasCode}
                  onChange={(e) => set('currentAliasCode', e.target.value)}
                  className={`inp${aliasErr || aliasIssue === 'required' ? ' bad' : ''}`}
                />
                <span className="hintline">{t('projectForm.field.aliasHint')}</span>
                {aliasErr && <p className="hintline" style={{ color: 'var(--danger)' }}>{t(`projectForm.err.${aliasErr}`)}</p>}
                {!aliasErr && aliasIssue === 'required' && <p className="hintline" style={{ color: 'var(--danger)' }}>{t('projectForm.err.required')}</p>}
              </div>
              {codeChanged && (
                <div className="field" data-field="aliasReason" style={{ gridColumn: 'span 2' }}>
                  <span className="lb">{t('projectForm.field.aliasReason')}</span>
                  <input
                    value={aliasReason}
                    onChange={(e) => setAliasReason(e.target.value)}
                    maxLength={300}
                    className={`inp${aliasIssue === 'reason_short' ? ' bad' : ''}`}
                  />
                  <span className="hintline">{t('projectForm.field.aliasReasonHint')}</span>
                  {aliasIssue === 'reason_short' && <p className="hintline" style={{ color: 'var(--danger)' }}>{t('projectForm.err.reason_short')}</p>}
                </div>
              )}
              <div className="field" style={{ gridColumn: 'span 2' }} data-field="projectName">
                <span className="lb">{t('form.projectName')}</span>
                <input
                  value={form.projectName}
                  maxLength={PROJECT_NAME_MAX}
                  onChange={(e) => set('projectName', e.target.value.toUpperCase())}
                  className={inputCls('projectName')}
                />
                <span className="hintline">{t('projectForm.field.nameHint', { max: PROJECT_NAME_MAX })}</span>
                {errors.projectName && <p className="hintline" style={{ color: 'var(--danger)' }}>{t(`projectForm.err.${errors.projectName}`)}</p>}
              </div>
            </div>
            <div style={{ height: 14 }} />
            <div className="f4 feven">
              <div className="field" data-field="customerId">
                <span className="lb">{t('form.customer')}<HelpTip text={t('projectForm.tipText.customer')} label={t('projectForm.tipText.customer')} /></span>
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
                  className="inp"
                />
              </div>
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
                  className="inp"
                />
              </Field>
              <Field label={t('common.market')}>
                <Combobox value={form.marketCode} onChange={(v) => set('marketCode', v)} options={MARKETS.map((m) => ({ value: m, label: t(marketKey[m]) }))} className="inp" />
              </Field>
              <div className="field" data-field="projectType">
                <span className="lb">{t('form.projectType')}<HelpTip text={t('projectForm.tipText.projectType')} label={t('projectForm.tipText.projectType')} alignRight /></span>
                <Combobox value={form.projectType} onChange={setProjectType} options={TYPES.map((ty) => ({ value: ty, label: t(typeKey[ty]) }))} className="inp" />
              </div>
            </div>
          </div>

          {/* Mục 2: Giá trị */}
          <div className="fsec">
            <div className="h"><span className="n">2</span><h4>{t('projectForm.sec.value.title')}</h4><p>{t('projectForm.sec.value.sub')}</p></div>
            <div className="f4 feven">
              <div className="field" data-field="contractValue">
                <span className="lb">{t('form.contractValue')}<HelpTip text={t('projectForm.tipText.contractValue')} label={t('projectForm.tipText.contractValue')} /></span>
                <input
                  type="number" step="0.001"
                  readOnly={fx.kind === 'converted'}
                  value={fx.kind === 'converted' ? fx.value : fmtNum(form.contractValue)}
                  onChange={(e) => set('contractValue', e.target.value)}
                  className={fx.kind === 'converted' ? 'inp ro' : inputCls('contractValue')}
                />
                <span className="hintline">{t('projectForm.field.contractValueHint')}</span>
                {errors.contractValue && <p className="hintline" style={{ color: 'var(--danger)' }}>{t(`projectForm.err.${errors.contractValue}`)}</p>}
              </div>
              <div className="field" data-field="contractValueOriginal">
                <span className="lb">{t('projectForm.field.originalValue')}</span>
                <div className="inline-row">
                  <select value={form.currencyCode} onChange={(e) => set('currencyCode', e.target.value)} className="inp">
                    {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                  <input
                    disabled={form.currencyCode === 'VND'}
                    value={form.contractValueOriginal}
                    onChange={(e) => set('contractValueOriginal', e.target.value)}
                    className="inp"
                  />
                </div>
                {fx.kind === 'vnd' && <span className="hintline">{t('projectForm.field.originalHint')}</span>}
                {fx.kind === 'converted' && <span className="hintline">{t('projectForm.fx.converted', { cur: form.currencyCode, ym: fx.ym, rate: formatTon(fx.rate, locale) })}</span>}
                {fx.kind === 'no_date' && <span className="hintline" style={{ color: 'var(--danger)' }}>{t('projectForm.fx.noDate')}</span>}
                {fx.kind === 'no_rate' && <span className="hintline" style={{ color: 'var(--danger)' }}>{t('projectForm.fx.noRate', { cur: form.currencyCode, ym: fx.ym })}</span>}
              </div>
              <div className="field" data-field="tonnage">
                <span className="lb">{t('common.tonnage')}<HelpTip text={t('projectForm.tipText.tonnage')} label={t('projectForm.tipText.tonnage')} /></span>
                <input type="number" step="0.1" value={fmtNum(form.tonnage)} onChange={(e) => set('tonnage', e.target.value)} className={inputCls('tonnage')} />
                {errors.tonnage && <p className="hintline" style={{ color: 'var(--danger)' }}>{t(`projectForm.err.${errors.tonnage}`)}</p>}
              </div>
              <div className="field">
                <span className="lb">{t('form.priority')}<HelpTip text={t('projectForm.tipText.priority')} label={t('projectForm.tipText.priority')} alignRight /></span>
                <Combobox value={form.priority} onChange={(v) => set('priority', v)} options={PRIORITIES.map((pr) => ({ value: pr, label: t(`projectForm.priority.${pr}`) }))} className="inp" />
              </div>
            </div>
            <div style={{ height: 14 }} />
            <div className="f4">
              <Field label={t('volumeEntry.factory')}>
                <select value={form.factoryId} onChange={(e) => set('factoryId', e.target.value)} className="inp">
                  <option value="">{t('volumeEntry.none')}</option>
                  {factories.map((f) => (
                    <option key={f.id} value={f.id} disabled={!f.isActive}>{f.name}{f.isActive ? '' : ` ${t('volumeEntry.inactiveSuffix')}`}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {/* Mục 3: Mốc thời gian */}
          <div className="fsec">
            <div className="h"><span className="n">3</span><h4>{t('projectForm.sec.dates.title')}</h4><p>{t('projectForm.sec.dates.sub')}</p></div>
            <div className="f4 feven">
              <Field label={t('form.contractDate')}>
                <input type="date" value={form.contractDate} onChange={(e) => set('contractDate', e.target.value)} className="inp" />
              </Field>
              <div className="field" data-field="plannedStartDate">
                <span className="lb">{t('form.plannedStart')}</span>
                <input type="date" value={form.plannedStartDate} onChange={(e) => set('plannedStartDate', e.target.value)} className={inputCls('plannedStartDate')} />
              </div>
              <div className="field" data-field="plannedFinishDate">
                <span className="lb">{t('form.plannedFinish')}<HelpTip text={t('projectForm.tip.plannedFinish')} label={t('projectForm.tip.plannedFinish')} /></span>
                <input type="date" value={form.plannedFinishDate} onChange={(e) => set('plannedFinishDate', e.target.value)} className={inputCls('plannedFinishDate')} />
              </div>
              <div className="field" data-field="committedHandoverDate">
                <span className="lb">{t('form.committedHandover')}<HelpTip text={t('projectForm.tip.committedHandover')} label={t('projectForm.tip.committedHandover')} alignRight /></span>
                <input type="date" value={form.committedHandoverDate} onChange={(e) => set('committedHandoverDate', e.target.value)} className={inputCls('committedHandoverDate')} />
              </div>
            </div>
            <div style={{ height: 14 }} />
            <div className="f4 feven">
              <div className="field" data-field="actualStartDate">
                <span className="lb">{t('form.actualStart')}<HelpTip text={t('projectForm.tip.actualStart')} label={t('projectForm.tip.actualStart')} /></span>
                <input type="date" value={form.actualStartDate} onChange={(e) => set('actualStartDate', e.target.value)} className={inputCls('actualStartDate')} />
              </div>
              <div className="field" data-field="actualFinishDate">
                <span className="lb">{t('form.actualFinish')}<HelpTip text={t('projectForm.tip.actualFinish')} label={t('projectForm.tip.actualFinish')} /></span>
                <input type="date" value={form.actualFinishDate} onChange={(e) => set('actualFinishDate', e.target.value)} className={inputCls('actualFinishDate')} />
              </div>
              <Field label={t('projectForm.field.penalized')}>
                <div className="inline-row" style={{ height: 38 }}>
                  <Switch checked={form.penalized} onChange={(v) => set('penalized', v)} label={t('projectForm.field.penalized')} />
                  <span style={{ color: form.penalized ? 'var(--danger)' : 'var(--label2)' }}>
                    {form.penalized ? t('projectForm.field.penalizedOn') : t('projectForm.field.penalizedOff')}
                  </span>
                </div>
              </Field>
              <div className="field">
                <span className="lb">{t('form.penaltyValue')}<HelpTip text={t('projectForm.tip.penaltyValue')} label={t('projectForm.tip.penaltyValue')} alignRight /></span>
                <input type="number" step="0.1" value={fmtNum(form.penaltyValue)} onChange={(e) => set('penaltyValue', e.target.value)} className="inp" />
              </div>
            </div>
            <div style={{ height: 12 }} />
            <div className={`sumbar ${dates.hard.length > 0 ? 'bad' : dates.totalPlanDays != null ? 'good' : ''}`}>
              {dates.hard.length > 0 && <span>⚠ {dates.hard.map((c) => t(`projectForm.dateCheck.${c}`)).join(' · ')}</span>}
              {dates.hard.length === 0 && dates.totalPlanDays != null && (
                <span>
                  ✓ {t('projectForm.dateCheck.ok', { n: dates.totalPlanDays })}
                  {dates.startDelayDays != null && dates.startDelayDays > 0 ? ` · ${t('projectForm.dateCheck.startDelay', { n: dates.startDelayDays })}` : ''}
                </span>
              )}
              {dates.hard.length === 0 && dates.totalPlanDays == null && <span>{t('projectForm.dateCheck.empty')}</span>}
              <span>{t('projectForm.dateCheck.note')}</span>
            </div>
          </div>

          {/* Mục 4: Các mốc chính */}
          <div className="fsec">
            <div className="h"><span className="n">4</span><h4>{t('form.keyMs.title')}</h4></div>
            <KeyMilestoneEditor
              id="key-milestones"
              value={msRows}
              today={today}
              errors={msErrors}
              onChange={(rows) => {
                setMsRows(rows);
                setMsDirty(true);
                setMsErrors(validateKeyMilestones(rows).errors);
                setMsg(null);
              }}
            />
          </div>

          {/* Mục 5: Trọng số */}
          <div className="fsec">
            <div className="h"><span className="n">5</span><h4>{t('projectForm.sec.weights.title')}</h4><p>{t('projectForm.sec.weights.sub')}</p></div>
            <StageWeightEditor
              value={weights}
              onChange={(rows) => { setWeights(rows); setWeightsDirty(true); setMsg(null); }}
              onApplyPreset={() => { setWeights(presetWeightsFor(form.projectType as ProjectType | '')); setWeightsDirty(true); }}
            />
          </div>

          {/* Mục 6: Liên kết */}
          <div className="fsec">
            <div className="h"><span className="n">6</span><h4>{t('projectForm.sec.links.title')}</h4><p>{t('projectForm.sec.links.sub')}</p></div>
            {mode === 'new' || !project ? (
              <p className="hintline">{t('projectForm.links.afterCreate')}</p>
            ) : (
              <ProjectLinksSection
                projectId={project.id}
                sapCodes={sapCodes}
                members={members}
                assignableUsers={assignableUsers}
                contractorMembers={contractorMembers}
                allContractors={allContractors}
              />
            )}
          </div>
        </div>

        {msg && <div className="bd"><p className={`sumbar ${msg.tone === 'ok' ? 'good' : 'bad'}`}>{msg.text}</p></div>}

        <div className="stickybar">
          <button type="button" className="btn" disabled={saving} onClick={mode === 'new' ? handleSaveNew : handleSaveEdit}>
            {mode === 'new' ? t('projectForm.btn.create') : t('projectForm.btn.save')}
          </button>
          <button type="button" className="btn ghost" onClick={saveDraftNow}>{t('projectForm.btn.draft')}</button>
          <button type="button" className="btn ghost" onClick={handleCancel}>{t('projectForm.btn.cancel')}</button>
          <div className="inline-row" style={{ marginLeft: 'auto', fontSize: 'var(--t-caption1)', color: 'var(--label3)' }}>
            <span className="req">*</span> {t('projectForm.required')} · {t('projectForm.count', { n: filled, total })}
          </div>
        </div>
      </div>

    </div>
  );
}

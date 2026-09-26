'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { AssignableUser } from '@/lib/project-form';
import type { Contractor, ProjectMember, ProjectSapCode } from '@/server/repo/types';
import { removeSapCodeAction } from '@/server/actions-project';
import { addSapCodeAction } from '@/server/actions';
import { setProjectMemberAction, removeProjectMemberAction } from '@/server/actions-project';
import { ContractorJoinBlock } from './ContractorJoinBlock';
import { HelpTip } from '@/components/ui/HelpTip';

/** Task 8 (P3A): mục 6 "Liên kết & phân công" - SAP, PIC/Backup, nhà thầu (chỉ hiện ở chế độ Sửa). */
export function ProjectLinksSection(p: {
  projectId: number;
  sapCodes: ProjectSapCode[];
  members: ProjectMember[];
  assignableUsers: AssignableUser[] | null;
  contractorMembers: Contractor[];
  allContractors: Contractor[];
}) {
  const { projectId, sapCodes, members, assignableUsers, contractorMembers, allContractors } = p;
  const t = useTranslations();
  const router = useRouter();

  const [sapAdding, setSapAdding] = useState(false);
  const [sapCode, setSapCode] = useState('');
  const [sapDoc, setSapDoc] = useState('Hợp đồng con');
  const [sapMsg, setSapMsg] = useState<string | null>(null);

  const [memberAdding, setMemberAdding] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<'PIC' | 'Backup'>('Backup');
  const [memberMsg, setMemberMsg] = useState<string | null>(null);

  async function removeSap(id: number, code: string) {
    if (!window.confirm(t('projectForm.links.sapConfirmRemove', { code }))) return;
    const res = await removeSapCodeAction(projectId, id);
    if (res.ok) router.refresh();
  }

  async function addSap() {
    if (!sapCode.trim()) return;
    const res = await addSapCodeAction(projectId, sapCode.trim(), sapDoc);
    if (res.ok) {
      setSapCode('');
      setSapAdding(false);
      setSapMsg(null);
      router.refresh();
    } else {
      setSapMsg(t('projectForm.links.sapDuplicate'));
    }
  }

  async function removeMember(email: string, name: string) {
    if (!window.confirm(t('projectForm.links.memberConfirmRemove', { name }))) return;
    const res = await removeProjectMemberAction(projectId, email);
    if (res.ok) router.refresh();
  }

  async function addMember() {
    if (!memberEmail) return;
    const res = await setProjectMemberAction(projectId, memberEmail, memberRole);
    if (res.ok) {
      setMemberAdding(false);
      setMemberMsg(null);
      router.refresh();
    } else {
      setMemberMsg(t(`projectForm.err.${res.error}`));
    }
  }

  const hasPic = members.some((m) => m.roleInProject === 'PIC');
  const unassigned = assignableUsers?.filter((u) => !members.some((m) => m.userEmail === u.email)) ?? [];

  return (
    <div className="f2">
      <div className="field">
        <span className="lb">
          {t('projectForm.links.sap')}
          <HelpTip text={t('projectForm.tipText.sap')} label={t('projectForm.tipText.sap')} />
        </span>
        <div className="tagbox">
          {sapCodes.map((s) => (
            <span key={s.id} className="tg">
              {s.sapCode}{' '}
              <b role="button" tabIndex={0} aria-label={t('projectForm.links.sapConfirmRemove', { code: s.sapCode })} onClick={() => removeSap(s.id, s.sapCode)}>
                ×
              </b>
            </span>
          ))}
          {sapAdding ? (
            <>
              <input value={sapCode} onChange={(e) => setSapCode(e.target.value)} placeholder="SAP-..." className="inp" style={{ width: 140 }} />
              <select value={sapDoc} onChange={(e) => setSapDoc(e.target.value)} className="inp" style={{ width: 'auto' }}>
                <option value="Hợp đồng con">{t('projectForm.links.sapDocType')}</option>
              </select>
              <button type="button" className="btn" onClick={addSap}>{t('common.add')}</button>
            </>
          ) : (
            <button type="button" className="add" onClick={() => setSapAdding(true)}>{t('projectForm.links.sapAdd')}</button>
          )}
        </div>
        {sapMsg && <p className="sumbar bad">{sapMsg}</p>}
      </div>

      <div className="field">
        <span className="lb">
          {t('projectForm.links.members')}
          <HelpTip text={t('projectForm.tipText.members')} label={t('projectForm.tipText.members')} alignRight />
        </span>
        <div className="tagbox">
          {!hasPic && <span className="chip c-warn">{t('projectForm.links.noPic')}</span>}
          {members.map((m) => (
            <span key={m.userEmail} className="tg">
              {m.name || m.userEmail} · {m.roleInProject}
              {assignableUsers && (
                <>
                  {' '}
                  <b role="button" tabIndex={0} aria-label={t('projectForm.links.memberConfirmRemove', { name: m.name || m.userEmail })} onClick={() => removeMember(m.userEmail, m.name || m.userEmail)}>
                    ×
                  </b>
                </>
              )}
            </span>
          ))}
          {assignableUsers ? (
            memberAdding ? (
              <>
                <select value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} className="inp" style={{ width: 'auto' }}>
                  <option value="">-</option>
                  {unassigned.map((u) => (
                    <option key={u.email} value={u.email}>{u.name || u.email}</option>
                  ))}
                </select>
                <select value={memberRole} onChange={(e) => setMemberRole(e.target.value as 'PIC' | 'Backup')} className="inp" style={{ width: 'auto' }}>
                  <option value="PIC">PIC</option>
                  <option value="Backup">Backup</option>
                </select>
                <button type="button" className="btn" onClick={addMember}>{t('common.add')}</button>
              </>
            ) : (
              <button type="button" className="add" onClick={() => setMemberAdding(true)}>{t('projectForm.links.memberAdd')}</button>
            )
          ) : (
            <p className="hintline">{t('projectForm.links.membersAdminOnly')}</p>
          )}
        </div>
        {memberMsg && <p className="sumbar bad">{memberMsg}</p>}
      </div>

      <div className="field" style={{ gridColumn: 'span 2' }}>
        <span className="lb">
          {t('dailyEntry.contractor')}
          <HelpTip text={t('projectForm.tipText.contractors')} label={t('projectForm.tipText.contractors')} />
        </span>
        <ContractorJoinBlock projectId={projectId} members={contractorMembers} allContractors={allContractors} disabled={false} />
      </div>
    </div>
  );
}

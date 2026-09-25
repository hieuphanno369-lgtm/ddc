'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { AlertSeverity, NotifyChannel, NotifyKind, NotifyRecipient } from '@/server/repo/types';
import {
  deleteNotifyChannelAction,
  deleteNotifyRecipientAction,
  saveNotifyChannelAction,
  saveNotifyRecipientAction,
  setNotifyChannelEnabledAction,
  testNotifyChannelAction,
} from '@/server/actions-notify';
import { Badge } from '@/components/ui/Badge';

/** Mã lỗi đã có key `notifyAdmin.err.<code>` - còn lại rơi vào `err.generic`. */
const KNOWN_ERR_CODES = new Set([
  'secret_key_missing', 'secret_required', 'secret_missing', 'secret_decrypt_failed',
  'invalid_url', 'bad_protocol', 'has_credentials', 'host_not_allowed', 'blocked_ip', 'too_long',
  'duplicate', 'wrong_kind', 'dns_failed', 'timeout', 'conn_failed', 'no_recipients',
  'smtp_auth', 'smtp_conn', 'smtp_rejected', 'email_unavailable', 'bad_config', 'rate_limited',
]);

interface ChannelDraft {
  kind: NotifyKind;
  name: string;
  isEnabled: boolean;
  minSeverity: AlertSeverity;
  secret: string;
  webhookFormat: 'generic' | 'slack' | 'teams';
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  fromAddress: string;
  clearSecret: boolean;
}

const EMPTY_DRAFT: ChannelDraft = {
  kind: 'webhook',
  name: '',
  isEnabled: true,
  minSeverity: 'Red',
  secret: '',
  webhookFormat: 'generic',
  smtpHost: '',
  smtpPort: '587',
  smtpSecure: false,
  smtpUser: '',
  fromAddress: '',
  clearSecret: false,
};

function draftFromChannel(c: NotifyChannel): ChannelDraft {
  return {
    kind: c.kind,
    name: c.name,
    isEnabled: c.isEnabled,
    minSeverity: c.minSeverity,
    secret: '',
    webhookFormat: c.settings.webhookFormat ?? 'generic',
    smtpHost: c.settings.smtpHost ?? '',
    smtpPort: String(c.settings.smtpPort ?? 587),
    smtpSecure: c.settings.smtpSecure ?? false,
    smtpUser: c.settings.smtpUser ?? '',
    fromAddress: c.settings.fromAddress ?? '',
    clearSecret: false,
  };
}

export function NotifyChannelEditor({
  channels,
  recipients,
  secretKeyReady,
}: {
  channels: NotifyChannel[];
  recipients: NotifyRecipient[];
  secretKeyReady: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<ChannelDraft>(EMPTY_DRAFT);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testMsg, setTestMsg] = useState<Record<number, string>>({});
  const [newRecipient, setNewRecipient] = useState<Record<number, { email: string; minSeverity: AlertSeverity }>>({});

  function errMsg(code: string): string {
    if (code === 'Forbidden') return t('notifyAdmin.err.forbidden');
    if (code === 'Invalid input') return t('notifyAdmin.err.invalid');
    if (code === 'Not found') return t('notifyAdmin.err.not_found');
    if (code.startsWith('http_')) return t('notifyAdmin.err.http', { status: code.slice('http_'.length) });
    if (KNOWN_ERR_CODES.has(code)) return t(`notifyAdmin.err.${code}`);
    return t('notifyAdmin.err.generic', { msg: code });
  }

  function openNew() {
    setDraft(EMPTY_DRAFT);
    setFormErr(null);
    setEditingId('new');
  }

  function openEdit(c: NotifyChannel) {
    setDraft(draftFromChannel(c));
    setFormErr(null);
    setEditingId(c.id);
  }

  function closeForm() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormErr(null);
  }

  async function save() {
    setFormErr(null);
    const base = {
      id: editingId === 'new' ? undefined : editingId!,
      kind: draft.kind,
      name: draft.name,
      isEnabled: draft.isEnabled,
      minSeverity: draft.minSeverity,
      secret: draft.secret,
    };
    const input =
      draft.kind === 'webhook'
        ? { ...base, webhookFormat: draft.webhookFormat }
        : {
            ...base,
            clearSecret: draft.clearSecret,
            smtpHost: draft.smtpHost,
            smtpPort: Number(draft.smtpPort),
            smtpSecure: draft.smtpSecure,
            smtpUser: draft.smtpUser,
            fromAddress: draft.fromAddress,
          };
    const res = await saveNotifyChannelAction(input);
    if (res.ok) {
      closeForm();
      router.refresh();
    } else {
      setFormErr(errMsg(res.error));
    }
  }

  async function toggleEnabled(c: NotifyChannel) {
    const res = await setNotifyChannelEnabledAction(c.id, !c.isEnabled);
    if (res.ok) router.refresh();
  }

  async function remove(c: NotifyChannel) {
    if (!window.confirm(t('notifyAdmin.confirmDelete', { name: c.name }))) return;
    const res = await deleteNotifyChannelAction(c.id);
    if (res.ok) router.refresh();
  }

  async function runTest(c: NotifyChannel) {
    setTestingId(c.id);
    setTestMsg((m) => ({ ...m, [c.id]: '' }));
    const res = await testNotifyChannelAction(c.id);
    setTestingId(null);
    setTestMsg((m) => ({ ...m, [c.id]: res.ok ? t('notifyAdmin.testOk') : errMsg(res.error) }));
  }

  async function addRecipient(channelId: number) {
    const draftR = newRecipient[channelId] ?? { email: '', minSeverity: 'Red' as AlertSeverity };
    if (!draftR.email.trim()) return;
    const res = await saveNotifyRecipientAction({ channelId, email: draftR.email, minSeverity: draftR.minSeverity, isEnabled: true });
    if (res.ok) {
      setNewRecipient((m) => ({ ...m, [channelId]: { email: '', minSeverity: 'Red' } }));
      router.refresh();
    }
  }

  async function toggleRecipient(r: NotifyRecipient) {
    const res = await saveNotifyRecipientAction({ id: r.id, channelId: r.channelId, email: r.email, minSeverity: r.minSeverity, isEnabled: !r.isEnabled });
    if (res.ok) router.refresh();
  }

  async function removeRecipient(r: NotifyRecipient) {
    if (!window.confirm(t('notifyAdmin.confirmDeleteRecipient', { email: r.email }))) return;
    const res = await deleteNotifyRecipientAction(r.id);
    if (res.ok) router.refresh();
  }

  const recipientsOf = (channelId: number) => recipients.filter((r) => r.channelId === channelId);

  return (
    <div className="space-y-3">
      {!secretKeyReady && <p className="sumbar bad">{t('notifyAdmin.keyMissing')}</p>}
      <p className="hintline">{t('notifyAdmin.hint')}</p>

      <div className="scroll" style={{ maxHeight: 320 }}>
        <table className="tbl sticky">
          <thead>
            <tr>
              <th>{t('notifyAdmin.name')}</th>
              <th>{t('notifyAdmin.kind')}</th>
              <th>{t('notifyAdmin.minSeverity')}</th>
              <th>{t('notifyAdmin.secret')}</th>
              <th>{t('notifyAdmin.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => (
              <Fragment key={c.id}>
                <tr>
                  <td>{c.name}</td>
                  <td>{c.kind === 'webhook' ? t('notifyAdmin.kindWebhook') : t('notifyAdmin.kindEmail')}</td>
                  <td>{c.minSeverity === 'Red' ? t('notifyAdmin.sevRed') : t('notifyAdmin.sevAmber')}</td>
                  <td className="mono">
                    {c.hasSecret ? c.secretHint : '-'}
                    {c.kind === 'webhook' && c.settings.webhookHost ? ` (${c.settings.webhookHost})` : ''}
                  </td>
                  <td>
                    <button type="button" onClick={() => toggleEnabled(c)}>
                      <Badge tone={c.isEnabled ? 'ok' : 'neutral'}>{c.isEnabled ? t('notifyAdmin.enabled') : t('notifyAdmin.disabled')}</Badge>
                    </button>
                  </td>
                  <td className="num">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" className="btn ghost" style={{ padding: '4px 10px', fontSize: 'var(--t-caption1)' }} onClick={() => openEdit(c)}>
                        {t('notifyAdmin.edit')}
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ padding: '4px 10px', fontSize: 'var(--t-caption1)' }}
                        disabled={testingId === c.id}
                        onClick={() => runTest(c)}
                      >
                        {t('notifyAdmin.test')}
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ padding: '4px 10px', fontSize: 'var(--t-caption1)', color: 'var(--danger)' }}
                        onClick={() => remove(c)}
                      >
                        {t('notifyAdmin.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
                {testMsg[c.id] && (
                  <tr>
                    <td colSpan={6}>
                      <p className={testMsg[c.id] === t('notifyAdmin.testOk') ? 'sumbar' : 'sumbar bad'}>{testMsg[c.id]}</p>
                    </td>
                  </tr>
                )}
                {c.kind === 'email' && (
                  <tr>
                    <td colSpan={6}>
                      <div className="pl-4">
                        <div className="sect"><b>{t('notifyAdmin.recipients')}</b><i /></div>
                        {recipientsOf(c.id).length === 0 ? (
                          <p className="empty">{t('notifyAdmin.noRecipients')}</p>
                        ) : (
                          <table className="tbl">
                            <thead>
                              <tr>
                                <th>{t('notifyAdmin.recipientEmail')}</th>
                                <th>{t('notifyAdmin.minSeverity')}</th>
                                <th>{t('notifyAdmin.status')}</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {recipientsOf(c.id).map((r) => (
                                <tr key={r.id}>
                                  <td className="mono">{r.email}</td>
                                  <td>{r.minSeverity === 'Red' ? t('notifyAdmin.sevRed') : t('notifyAdmin.sevAmber')}</td>
                                  <td>
                                    <button type="button" onClick={() => toggleRecipient(r)}>
                                      <Badge tone={r.isEnabled ? 'ok' : 'neutral'}>{r.isEnabled ? t('notifyAdmin.enabled') : t('notifyAdmin.disabled')}</Badge>
                                    </button>
                                  </td>
                                  <td className="num">
                                    <button
                                      type="button"
                                      className="btn ghost"
                                      style={{ padding: '4px 10px', fontSize: 'var(--t-caption1)', color: 'var(--danger)' }}
                                      onClick={() => removeRecipient(r)}
                                    >
                                      {t('common.delete')}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        <div className="flex flex-wrap items-end gap-2 mt-2">
                          <input
                            value={newRecipient[c.id]?.email ?? ''}
                            onChange={(e) => setNewRecipient((m) => ({ ...m, [c.id]: { email: e.target.value, minSeverity: m[c.id]?.minSeverity ?? 'Red' } }))}
                            placeholder={t('notifyAdmin.recipientEmail')}
                            className="inp"
                          />
                          <select
                            value={newRecipient[c.id]?.minSeverity ?? 'Red'}
                            onChange={(e) => setNewRecipient((m) => ({ ...m, [c.id]: { email: m[c.id]?.email ?? '', minSeverity: e.target.value as AlertSeverity } }))}
                            className="inp"
                            style={{ width: 'auto' }}
                          >
                            <option value="Red">{t('notifyAdmin.sevRed')}</option>
                            <option value="Amber">{t('notifyAdmin.sevAmber')}</option>
                          </select>
                          <button type="button" className="btn ghost" onClick={() => addRecipient(c.id)}>
                            {t('notifyAdmin.addRecipient')}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {channels.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  {t('notifyAdmin.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingId == null ? (
        <button type="button" className="btn" onClick={openNew}>
          {t('notifyAdmin.add')}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="field">
              <span className="lb">{t('notifyAdmin.kind')}</span>
              <select
                value={draft.kind}
                disabled={editingId !== 'new'}
                onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as NotifyKind }))}
                className="inp"
              >
                <option value="webhook">{t('notifyAdmin.kindWebhook')}</option>
                <option value="email">{t('notifyAdmin.kindEmail')}</option>
              </select>
            </div>
            <div className="field">
              <span className="lb">{t('notifyAdmin.name')}</span>
              <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="inp" />
            </div>
            <div className="field">
              <span className="lb">{t('notifyAdmin.minSeverity')}</span>
              <select
                value={draft.minSeverity}
                onChange={(e) => setDraft((d) => ({ ...d, minSeverity: e.target.value as AlertSeverity }))}
                className="inp"
              >
                <option value="Red">{t('notifyAdmin.sevRed')}</option>
                <option value="Amber">{t('notifyAdmin.sevAmber')}</option>
              </select>
            </div>
            <label className="flex items-center gap-1.5 text-footnote">
              <input type="checkbox" checked={draft.isEnabled} onChange={(e) => setDraft((d) => ({ ...d, isEnabled: e.target.checked }))} />
              {t('notifyAdmin.enable')}
            </label>
          </div>

          {draft.kind === 'webhook' ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="field min-w-0 flex-1">
                <span className="lb">{t('notifyAdmin.webhookUrl')}</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={draft.secret}
                  onChange={(e) => setDraft((d) => ({ ...d, secret: e.target.value }))}
                  placeholder={
                    editingId !== 'new' && channels.find((c) => c.id === editingId)?.hasSecret
                      ? t('notifyAdmin.secretKeep', { hint: channels.find((c) => c.id === editingId)!.secretHint })
                      : undefined
                  }
                  className="inp w-full"
                />
              </div>
              <div className="field">
                <span className="lb">{t('notifyAdmin.webhookFormat')}</span>
                <select
                  value={draft.webhookFormat}
                  onChange={(e) => setDraft((d) => ({ ...d, webhookFormat: e.target.value as ChannelDraft['webhookFormat'] }))}
                  className="inp"
                >
                  <option value="generic">{t('notifyAdmin.fmtGeneric')}</option>
                  <option value="slack">{t('notifyAdmin.fmtSlack')}</option>
                  <option value="teams">{t('notifyAdmin.fmtTeams')}</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div className="field">
                <span className="lb">{t('notifyAdmin.smtpHost')}</span>
                <input value={draft.smtpHost} onChange={(e) => setDraft((d) => ({ ...d, smtpHost: e.target.value }))} className="inp" />
              </div>
              <div className="field">
                <span className="lb">{t('notifyAdmin.smtpPort')}</span>
                <input type="number" value={draft.smtpPort} onChange={(e) => setDraft((d) => ({ ...d, smtpPort: e.target.value }))} className="inp" style={{ width: 90 }} />
              </div>
              <label className="flex items-center gap-1.5 text-footnote">
                <input type="checkbox" checked={draft.smtpSecure} onChange={(e) => setDraft((d) => ({ ...d, smtpSecure: e.target.checked }))} />
                {t('notifyAdmin.smtpSecure')}
              </label>
              <div className="field">
                <span className="lb">{t('notifyAdmin.smtpUser')}</span>
                <input value={draft.smtpUser} onChange={(e) => setDraft((d) => ({ ...d, smtpUser: e.target.value }))} className="inp" />
              </div>
              <div className="field">
                <span className="lb">{t('notifyAdmin.smtpPass')}</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={draft.secret}
                  onChange={(e) => setDraft((d) => ({ ...d, secret: e.target.value }))}
                  placeholder={
                    editingId !== 'new' && channels.find((c) => c.id === editingId)?.hasSecret
                      ? t('notifyAdmin.secretKeep', { hint: channels.find((c) => c.id === editingId)!.secretHint })
                      : undefined
                  }
                  className="inp"
                />
              </div>
              <div className="field">
                <span className="lb">{t('notifyAdmin.fromAddress')}</span>
                <input value={draft.fromAddress} onChange={(e) => setDraft((d) => ({ ...d, fromAddress: e.target.value }))} className="inp" />
              </div>
              {editingId !== 'new' && channels.find((c) => c.id === editingId)?.hasSecret && (
                <label className="flex items-center gap-1.5 text-footnote">
                  <input type="checkbox" checked={draft.clearSecret} onChange={(e) => setDraft((d) => ({ ...d, clearSecret: e.target.checked }))} />
                  {t('notifyAdmin.secretClear')}
                </label>
              )}
            </div>
          )}

          {formErr && <p className="sumbar bad">{formErr}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={save}>
              {t('notifyAdmin.save')}
            </button>
            <button type="button" className="btn ghost" onClick={closeForm}>
              {t('notifyAdmin.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

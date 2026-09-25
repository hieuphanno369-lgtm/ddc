'use server';

import net from 'node:net';
import { revalidateTag } from 'next/cache';
import { logActivity } from '@/lib/activity';
import { hasSecretKey, sealSecret, secretHintForUrl } from '@/lib/secret-box';
import { checkWebhookUrl, isBlockedSmtpIp, webhookPolicyFromEnv, type WebhookUrlError } from '@/lib/notify-url';
import { testNotice } from '@/lib/notify-message';
import { requireRoleUser } from './action-guards';
import { profileTag } from './cache';
import { repo } from './repo';
import { sendToChannel } from './notify/dispatch';
import type { NotifyErrorCode } from './notify/types';
import type { NotifyChannel, NotifyChannelInput, NotifyChannelSettings } from './repo/types';
import { idSchema, notifyChannelSchema, notifyRecipientSchema } from './validation-notify';

type ChannelErr = 'Forbidden' | 'Invalid input' | 'Not found' | 'secret_key_missing' | 'secret_required' | 'blocked_ip' | WebhookUrlError;

/** true nếu kênh (sau khi lưu) KHÔNG còn bí mật cần thiết để gửi khi đang bật. */
function missingRequiredSecret(kind: NotifyChannel['kind'], settings: NotifyChannelSettings, hasSecret: boolean): boolean {
  if (kind === 'webhook') return !hasSecret;
  return !!settings.smtpUser && !hasSecret;
}

export async function saveNotifyChannelAction(
  input: unknown,
): Promise<{ ok: true; id: number } | { ok: false; error: ChannelErr }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };

  const parsed = notifyChannelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };
  const data = parsed.data;

  let existing: NotifyChannel | undefined;
  if (data.id != null) {
    existing = (await repo.listNotifyChannels()).find((c) => c.id === data.id);
    if (!existing) return { ok: false, error: 'Not found' };
    if (existing.kind !== data.kind) return { ok: false, error: 'Invalid input' };
  }

  let secret: { enc: string; hint: string } | null | undefined;
  const rawSecret = data.secret ?? '';
  if (rawSecret !== '') {
    if (data.kind === 'webhook') {
      const checked = checkWebhookUrl(rawSecret, webhookPolicyFromEnv());
      if (!checked.ok) return { ok: false, error: checked.error };
    }
    if (!hasSecretKey()) return { ok: false, error: 'secret_key_missing' };
    secret = { enc: sealSecret(rawSecret), hint: data.kind === 'webhook' ? secretHintForUrl(rawSecret) : '••••••' };
  } else if (data.kind === 'email' && data.clearSecret) {
    secret = null;
  } else {
    secret = undefined;
  }

  let settings: NotifyChannelSettings;
  if (data.kind === 'webhook') {
    const newHost = rawSecret !== '' ? new URL(rawSecret).hostname : undefined;
    settings = { webhookFormat: data.webhookFormat, webhookHost: newHost ?? existing?.settings.webhookHost };
  } else {
    const smtpHostIsIp = net.isIP(data.smtpHost) !== 0;
    if ((smtpHostIsIp && isBlockedSmtpIp(data.smtpHost)) || data.smtpHost.toLowerCase() === 'localhost') {
      return { ok: false, error: 'blocked_ip' };
    }
    settings = {
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpSecure: data.smtpSecure,
      smtpUser: data.smtpUser || undefined,
      fromAddress: data.fromAddress,
    };
  }

  const willHaveSecret = secret === undefined ? (existing?.hasSecret ?? false) : secret != null;
  if (data.isEnabled && missingRequiredSecret(data.kind, settings, willHaveSecret)) {
    return { ok: false, error: 'secret_required' };
  }

  const channelInput: NotifyChannelInput = {
    id: data.id,
    kind: data.kind,
    name: data.name,
    isEnabled: data.isEnabled,
    minSeverity: data.minSeverity,
    settings,
    secret,
  };
  const result = await repo.saveNotifyChannel(channelInput, user.email);
  if (result === 'not_found') return { ok: false, error: 'Not found' };

  await logActivity(user, 'notify_channel_save', String(result.id));
  revalidateTag(profileTag);
  return { ok: true, id: result.id };
}

export async function setNotifyChannelEnabledAction(
  id: number,
  isEnabled: boolean,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' | 'secret_required' }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success || typeof isEnabled !== 'boolean') return { ok: false, error: 'Invalid input' };

  const existing = (await repo.listNotifyChannels()).find((c) => c.id === parsedId.data);
  if (!existing) return { ok: false, error: 'Not found' };
  if (isEnabled && missingRequiredSecret(existing.kind, existing.settings, existing.hasSecret)) {
    return { ok: false, error: 'secret_required' };
  }

  const result = await repo.saveNotifyChannel(
    { id: existing.id, kind: existing.kind, name: existing.name, isEnabled, minSeverity: existing.minSeverity, settings: existing.settings },
    user.email,
  );
  if (result === 'not_found') return { ok: false, error: 'Not found' };
  revalidateTag(profileTag);
  return { ok: true };
}

export async function deleteNotifyChannelAction(id: number): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: 'Invalid input' };

  const ok = await repo.deleteNotifyChannel(parsedId.data, user.email);
  if (!ok) return { ok: false, error: 'Not found' };
  revalidateTag(profileTag);
  return { ok: true };
}

export async function saveNotifyRecipientAction(
  input: unknown,
): Promise<{ ok: true; id: number } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' | 'duplicate' | 'wrong_kind' }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = notifyRecipientSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const result = await repo.saveNotifyRecipient(parsed.data, user.email);
  if (result === 'not_found') return { ok: false, error: 'Not found' };
  if (result === 'duplicate' || result === 'wrong_kind') return { ok: false, error: result };
  revalidateTag(profileTag);
  return { ok: true, id: result.id };
}

export async function deleteNotifyRecipientAction(id: number): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: 'Invalid input' };

  const ok = await repo.deleteNotifyRecipient(parsedId.data, user.email);
  if (!ok) return { ok: false, error: 'Not found' };
  revalidateTag(profileTag);
  return { ok: true };
}

export async function testNotifyChannelAction(
  id: number,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' | 'rate_limited' | NotifyErrorCode }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: 'Invalid input' };

  const { rateLimit } = await import('@/lib/rate-limit');
  const rl = rateLimit(`notify-test:${user.email}`, 5, 60_000);
  if (!rl.ok) return { ok: false, error: 'rate_limited' };

  const [channel] = await repo.getChannelsForSend({ onlyEnabled: false, ids: [parsedId.data] });
  if (!channel) return { ok: false, error: 'Not found' };

  const result = await sendToChannel(channel, testNotice(process.env.NEXTAUTH_URL), undefined, false);
  await logActivity(user, 'notify_test', `${parsedId.data}:${result.ok ? 'ok' : result.error}`);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

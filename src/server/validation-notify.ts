import net from 'node:net';
import { z } from 'zod';

/**
 * Schema zod cho Task 8 (P3B) - đặt ở file MỚI, KHÔNG sửa `validation.ts` (K11, giảm xung đột
 * với A đang sửa file đó ở P3A).
 */
const NAME_MAX = 80;
const SECRET_MAX = 2048;

const HOSTNAME_RE = /^[A-Za-z0-9.-]+$/;

const smtpHostSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .refine((v) => HOSTNAME_RE.test(v) || net.isIP(v) !== 0, 'invalid_host');

const baseChannelFields = {
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(NAME_MAX),
  isEnabled: z.boolean(),
  minSeverity: z.enum(['Red', 'Amber']),
  /** '' hoặc thiếu = không đổi bí mật đã lưu; chuỗi khác = bí mật mới. */
  secret: z.string().trim().max(SECRET_MAX).optional(),
};

const webhookChannelSchema = z.object({
  ...baseChannelFields,
  kind: z.literal('webhook'),
  webhookFormat: z.enum(['generic', 'slack', 'teams']).default('generic'),
});

const emailChannelSchema = z.object({
  ...baseChannelFields,
  kind: z.literal('email'),
  /** Chỉ áp dụng cho email - xoá mật khẩu SMTP đã lưu (không auth nữa). */
  clearSecret: z.boolean().optional(),
  smtpHost: smtpHostSchema,
  smtpPort: z.number().int().min(1).max(65535),
  smtpSecure: z.boolean(),
  smtpUser: z.string().trim().max(254),
  fromAddress: z.email().max(254),
});

export const notifyChannelSchema = z.discriminatedUnion('kind', [webhookChannelSchema, emailChannelSchema]);

export const notifyRecipientSchema = z.object({
  id: z.number().int().positive().optional(),
  channelId: z.number().int().positive(),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  minSeverity: z.enum(['Red', 'Amber']),
  isEnabled: z.boolean(),
});

export const idSchema = z.number().int().positive();

import { randomBytes } from 'node:crypto';
import { passwordStrength } from '@/lib/password';
import { createAccountSchema } from './validation';
import type { UserAccount } from './repo/types';

/**
 * P5-B Task 7b - lenh tao admin dau tien tren DB production moi tinh (chua co tai khoan nao, nen
 * khong dung duoc `createAccountAction` vi no bat `requireRole(['admin'])`). Thuan - KHONG import
 * prisma/repo (de test khong can DB), khuon theo `unlock-account-cli.ts`.
 */

export const TEMP_PASSWORD_BYTES = 18; // base64url -> 24 ky tu
export const DEFAULT_ADMIN_NAME = 'Admin';

const MAX_TEMP_PASSWORD_ATTEMPTS = 20;

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Sinh mat khau tam base64url, lap toi khi du manh (passwordStrength === 3), toi da 20 lan. */
export function generateTempPassword(random: (n: number) => Buffer = randomBytes): string {
  for (let i = 0; i < MAX_TEMP_PASSWORD_ATTEMPTS; i++) {
    const candidate = toBase64Url(random(TEMP_PASSWORD_BYTES));
    if (passwordStrength(candidate) === 3) return candidate;
  }
  throw new Error('temp_password_weak');
}

export type CreateAdminStore = {
  findAccount(email: string): Promise<UserAccount | undefined>;
  createAccount(account: UserAccount): Promise<void>;
};

export type CreateAdminDeps = {
  hash: (plain: string) => Promise<string>; // script truyen hashPassword (src/lib/password.ts)
  genPassword: () => string; // script truyen generateTempPassword
  now: () => Date;
  log: (email: string) => Promise<void>; // ghi activityLog, KHONG nhan mat khau
};

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: unknown }).code === 'P2002';
}

function alreadyExistsResult(email: string): { code: 1; message: string } {
  return {
    code: 1,
    message: `Tai khoan da ton tai: ${email}. Khong ghi de. Neu bi khoa dung: npm run unlock-account -- ${email}`,
  };
}

export async function createAdminCli(
  store: CreateAdminStore,
  rawEmail: string,
  rawName: string | undefined,
  deps: CreateAdminDeps,
): Promise<{ code: 0 | 1 | 2; message: string; tempPassword?: string }> {
  const password = deps.genPassword();
  const parsed = createAccountSchema.safeParse({
    email: rawEmail,
    name: rawName?.trim() || DEFAULT_ADMIN_NAME,
    role: 'admin',
    password,
  });
  if (!parsed.success) {
    const nameIssue = parsed.error.issues.some((i) => i.path[0] === 'name');
    if (nameIssue) return { code: 2, message: `Ten khong hop le: "${rawName ?? ''}"` };
    return { code: 2, message: `Email khong hop le: "${rawEmail}"` };
  }
  const { email, name } = parsed.data;

  const existing = await store.findAccount(email);
  if (existing) return alreadyExistsResult(email);

  try {
    await store.createAccount({
      email,
      name,
      passwordHash: await deps.hash(password),
      role: 'admin',
      canViewFinance: true,
      isActive: true,
      createdAt: deps.now().toISOString(),
      lastLoginAt: null,
      lockedAt: null,
    });
  } catch (e) {
    if (isUniqueViolation(e)) return alreadyExistsResult(email);
    throw e;
  }

  await deps.log(email);
  return { code: 0, message: `Da tao admin: ${email}`, tempPassword: password };
}

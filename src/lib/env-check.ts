/**
 * Kiem cac bien moi truong bat buoc luc khoi dong (P5-B Task 2). Chi chay o runtime nodejs
 * (`instrumentation.ts` chi import file nay khi `NEXT_RUNTIME === 'nodejs'`) - dung `Buffer`
 * nen KHONG duoc gop vao `src/lib/env.ts` (middleware edge import file do).
 */

import { logger } from './logger';

export type EnvProblem = { name: string; reason: 'missing' | 'invalid' };

export const REQUIRED_PROD_ENV = [
  'DATABASE_URL', 'DIRECT_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'NOTIFY_SECRET_KEY', 'CRON_SECRET',
] as const;

function trimmed(env: Record<string, string | undefined>, name: string): string {
  return (env[name] ?? '').trim();
}

function checkDatabaseUrl(name: string, env: Record<string, string | undefined>, problems: EnvProblem[]): void {
  const v = trimmed(env, name);
  if (!v) {
    problems.push({ name, reason: 'missing' });
    return;
  }
  if (!/^postgres(ql)?:\/\//.test(v)) problems.push({ name, reason: 'invalid' });
}

function checkMinLength(name: string, env: Record<string, string | undefined>, problems: EnvProblem[], minLen: number): void {
  const v = trimmed(env, name);
  if (!v) {
    problems.push({ name, reason: 'missing' });
    return;
  }
  if (v.length < minLen) problems.push({ name, reason: 'invalid' });
}

function checkNextAuthUrl(env: Record<string, string | undefined>, problems: EnvProblem[]): void {
  const raw = trimmed(env, 'NEXTAUTH_URL');
  if (!raw) {
    problems.push({ name: 'NEXTAUTH_URL', reason: 'missing' });
    return;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    problems.push({ name: 'NEXTAUTH_URL', reason: 'invalid' });
    return;
  }
  const isLocalHttp = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (url.protocol !== 'https:' && !isLocalHttp) {
    problems.push({ name: 'NEXTAUTH_URL', reason: 'invalid' });
    return;
  }
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    problems.push({ name: 'NEXTAUTH_URL', reason: 'invalid' });
  }
}

function checkNotifySecretKey(env: Record<string, string | undefined>, problems: EnvProblem[]): void {
  const raw = trimmed(env, 'NOTIFY_SECRET_KEY');
  if (!raw) {
    problems.push({ name: 'NOTIFY_SECRET_KEY', reason: 'missing' });
    return;
  }
  let len = -1;
  try {
    len = Buffer.from(raw, 'base64').length;
  } catch {
    len = -1;
  }
  if (len !== 32) problems.push({ name: 'NOTIFY_SECRET_KEY', reason: 'invalid' });
}

function checkGoogleOAuth(env: Record<string, string | undefined>, problems: EnvProblem[]): void {
  const id = trimmed(env, 'GOOGLE_CLIENT_ID');
  const secret = trimmed(env, 'GOOGLE_CLIENT_SECRET');
  if (id && !secret) problems.push({ name: 'GOOGLE_CLIENT_SECRET', reason: 'missing' });
  if (secret && !id) problems.push({ name: 'GOOGLE_CLIENT_ID', reason: 'missing' });
}

function checkTrustedProxyHops(env: Record<string, string | undefined>, problems: EnvProblem[]): void {
  const v = trimmed(env, 'TRUSTED_PROXY_HOPS');
  if (v && !/^[1-9]\d*$/.test(v)) problems.push({ name: 'TRUSTED_PROXY_HOPS', reason: 'invalid' });
}

/** Kiem toan bo bien moi truong server bat buoc/tuy chon - tra danh sach van de, khong doc gia tri ra ngoai. */
export function checkServerEnv(env: Record<string, string | undefined>): EnvProblem[] {
  const problems: EnvProblem[] = [];
  checkDatabaseUrl('DATABASE_URL', env, problems);
  checkDatabaseUrl('DIRECT_URL', env, problems);
  checkMinLength('NEXTAUTH_SECRET', env, problems, 32);
  checkNextAuthUrl(env, problems);
  checkNotifySecretKey(env, problems);
  checkMinLength('CRON_SECRET', env, problems, 32);
  checkGoogleOAuth(env, problems);
  checkTrustedProxyHops(env, problems);
  return problems;
}

/**
 * Production thieu/sai bien bat buoc -> log 1 dong JSON (chi ten + ly do, KHONG BAO GIO in gia tri)
 * roi dung app. Dev/test chi canh bao. Bo qua luc `next build` (khong co bien production that).
 */
export function enforceServerEnv(
  env: Record<string, string | undefined> = process.env,
  exit: (code: number) => void = (c) => process.exit(c),
): void {
  if (env.NEXT_PHASE === 'phase-production-build') return;
  const problems = checkServerEnv(env);
  if (problems.length === 0) return;
  const fields = {
    problems: problems.map((p) => `${p.name}:${p.reason}`),
    hint: 'Xem .env.example va docs/DEPLOY.md muc Bien moi truong',
  };
  if (env.NODE_ENV === 'production') {
    logger.error('env.invalid', fields);
    exit(1);
    return;
  }
  logger.warn('env.invalid_dev', fields);
}

'use server';

import { revalidateTag } from 'next/cache';
import { logActivity } from '@/lib/activity';
import { historyMonths } from '@/lib/clock';
import type { FxCurrency } from '@/lib/fx';
import { requireRoleUser } from './action-guards';
import { listTag, overviewTag, profileTag } from './cache';
import { runJob } from './jobs';
import { repo } from './repo';
import type { StageCode } from './repo/types';
import {
  deleteExchangeRateSchema, factorySchema, saveExchangeRateSchema, stageCodeSchema, stageSchema, type StageInputAdmin,
} from './validation';

/** T8 (Task 6, P2A): CRUD khu vực sản xuất / công suất - chỉ admin. */
export async function saveFactoryAction(
  input: { id?: number; name: string; region: string; capacityTonPerYear: number },
): Promise<{ ok: true; id: number } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'duplicate_name' | 'Not found' }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = factorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const result = await repo.saveFactory(parsed.data, user.email);
  if (result === 'duplicate_name') return { ok: false, error: 'duplicate_name' };
  if (result === 'not_found') return { ok: false, error: 'Not found' };

  await logActivity(user, 'save_factory', result.name);
  revalidateTag(profileTag);
  for (const m of historyMonths()) revalidateTag(overviewTag(m));
  return { ok: true, id: result.id };
}

export async function setFactoryActiveAction(
  id: number,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Invalid input' };

  const ok = await repo.setFactoryActive(id, isActive, user.email);
  if (!ok) return { ok: false, error: 'Not found' };

  await logActivity(user, isActive ? 'activate_factory' : 'deactivate_factory', String(id));
  revalidateTag(profileTag);
  for (const m of historyMonths()) revalidateTag(overviewTag(m));
  return { ok: true };
}

/** Sau khi đổi danh sách giai đoạn: thẻ Chuỗi giá trị, form nhập liệu, Tổng quan đọc lại. */
function revalidateStageViews() {
  revalidateTag(profileTag);
  for (const m of historyMonths()) {
    revalidateTag(overviewTag(m));
    revalidateTag(listTag(m));
  }
}

/** P7-C2 Task 8: thêm/sửa giai đoạn chuỗi giá trị - chỉ admin. */
export async function saveStageAction(
  input: StageInputAdmin,
): Promise<{ ok: true; code: StageCode } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'duplicate_name' | 'Not found' | 'too_many' }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = stageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const result = await repo.saveStage(parsed.data, user.email);
  if (result === 'duplicate_name' || result === 'too_many') return { ok: false, error: result };
  if (result === 'not_found') return { ok: false, error: 'Not found' };

  await logActivity(user, 'save_stage', result.nameVi);
  revalidateStageViews();
  return { ok: true, code: result.code };
}

/** P7-C2 Task 8 (Q1a): ngừng dùng / dùng lại giai đoạn - chỉ admin. */
export async function setStageActiveAction(
  code: StageCode,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' | 'in_use' | 'last_active'; count?: number }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  if (!stageCodeSchema.safeParse(code).success || typeof isActive !== 'boolean') return { ok: false, error: 'Invalid input' };

  const result = await repo.setStageActive(code, isActive, user.email);
  if (result === 'not_found') return { ok: false, error: 'Not found' };
  if (result === 'last_active') return { ok: false, error: 'last_active' };
  if (result !== 'ok') return { ok: false, error: 'in_use', count: result.count };

  await logActivity(user, isActive ? 'activate_stage' : 'deactivate_stage', code);
  revalidateStageViews();
  return { ok: true };
}

/** T6 (Task 7, P2A): sửa tay tỷ giá tháng - chỉ admin. Ghi source 'manual'. */
export async function saveExchangeRateAction(
  currencyCode: FxCurrency,
  yearMonth: string,
  rateToVnd: number,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = saveExchangeRateSchema.safeParse({ currencyCode, yearMonth, rateToVnd });
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  await repo.upsertExchangeRate({ ...parsed.data, source: 'manual' }, user.email);
  await logActivity(user, 'save_exchange_rate', `${parsed.data.currencyCode}/${parsed.data.yearMonth}`);
  revalidateTag(profileTag);
  return { ok: true };
}

export async function deleteExchangeRateAction(
  currencyCode: FxCurrency,
  yearMonth: string,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = deleteExchangeRateSchema.safeParse({ currencyCode, yearMonth });
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const ok = await repo.deleteExchangeRate(parsed.data.currencyCode, parsed.data.yearMonth, user.email);
  if (!ok) return { ok: false, error: 'Not found' };
  await logActivity(user, 'delete_exchange_rate', `${parsed.data.currencyCode}/${parsed.data.yearMonth}`);
  revalidateTag(profileTag);
  return { ok: true };
}

/** Nút admin "Lấy ngay" - bỏ qua isRatesDue (luôn gọi VCB ngay khi bấm). */
export async function fetchRatesNowAction(): Promise<
  { ok: true; status: 'ok' | 'error'; detail: string } | { ok: false; error: 'Forbidden' }
> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const result = await runJob('rates_monthly', 'admin', user.email);
  revalidateTag(profileTag);
  return { ok: true, ...result };
}

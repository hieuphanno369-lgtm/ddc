'use server';

import { revalidateTag } from 'next/cache';
import { logActivity } from '@/lib/activity';
import { historyMonths } from '@/lib/clock';
import { requireRoleUser } from './action-guards';
import { overviewTag, profileTag } from './cache';
import { repo } from './repo';
import { factorySchema } from './validation';

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

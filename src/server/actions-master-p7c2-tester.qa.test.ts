import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';

/**
 * Tester doc lap P7-C2 Task 8: bo sung 1 bien tang STAGE_MAX_COUNT (K14 - "Toi da 30 giai doan") o
 * TANG ACTION (saveStageAction) - `actions-master.test.ts` cua coder da kiem "too_many" o tang repo
 * (mock + prisma) nhung CHUA kiem duong di qua action wrapper that (requireRoleUser -> repo.saveStage
 * -> map loi 'too_many').
 */
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { saveStageAction } from '@/server/actions-master';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
  (getCurrentUser as Mock).mockResolvedValue(ADMIN);
});

describe('saveStageAction - bien STAGE_MAX_COUNT = 30 qua tang action that (K14, kiem thu doc lap)', () => {
  it("them lien tiep den khi du 30 giai doan (8 seed + 22 moi) -> giai doan thu 23 tra 'too_many', khong duoc tao, van dung 30 dong", async () => {
    const seedCount = repo.getStages().length;
    expect(seedCount).toBe(8);

    for (let i = 0; i < 30 - seedCount; i++) {
      const res = await saveStageAction({
        nameVi: `Giai doan them ${i}`, nameEn: `Extra stage ${i}`, side: 'left', sortOrder: 50 + i, calcMode: 'manual',
      });
      expect(res).toEqual({ ok: true, code: `custom_${i + 1}` });
    }
    expect(repo.getStages()).toHaveLength(30);

    const overflow = await saveStageAction({ nameVi: 'Vuot han muc', nameEn: 'Over limit', side: 'left', sortOrder: 99, calcMode: 'manual' });

    expect(overflow).toEqual({ ok: false, error: 'too_many' });
    expect(repo.getStages()).toHaveLength(30);
    expect(repo.getStages().some((s) => s.nameVi === 'Vuot han muc')).toBe(false);
  });
});

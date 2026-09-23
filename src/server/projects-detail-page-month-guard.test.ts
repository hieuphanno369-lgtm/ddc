import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';

/**
 * Vòng CAN SUA #1 - A-3 (thay-doi.md): render THẬT trang
 * `app/[locale]/(app)/projects/[id]/page.tsx` với `searchParams.month` rác, khẳng định
 * đúng dòng fix (`isValidYearMonth(searchParams.month) ? searchParams.month : currentMonth()`)
 * chứ không phải test lại công thức tự viết ở nơi khác. Khác với
 * `project-queries.test.ts` (test 2 hàm đọc dữ liệu độc lập với đúng công thức guard),
 * file này gọi thẳng component trang - nếu ai đó xoá dòng validate trong page.tsx, test
 * này phải rớt vì RangeError văng ra khi render.
 */

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'vi'),
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/i18n/navigation', () => ({
  Link: (props: { href: string; children?: React.ReactNode; className?: string }) =>
    React.createElement('a', { href: props.href, className: props.className }, props.children),
}));
// Badges/WhatIf/ProjectSwitcher là client component (useTranslations/useLocale/useRouter) -
// không gọi được ở renderToStaticMarkup, in thẳng prop cần kiểm ra HTML giống pattern có sẵn
// ở operation-pages-render.test.ts.
vi.mock('@/components/ui/Badges', () => ({
  MarketLabel: () => null,
  PriorityBadge: () => null,
  StatusBadge: (p: { status: string }) => React.createElement('span', null, `status:${p.status}`),
  TypeLabel: () => null,
}));
vi.mock('@/components/project/WhatIf', () => ({ WhatIf: () => null }));
vi.mock('@/components/project/ProjectSwitcher', () => ({ ProjectSwitcher: () => null }));

import { getCurrentUser } from '@/lib/session';
import ProjectDetailPage from '../../app/[locale]/(app)/projects/[id]/page';

(globalThis as unknown as { React: typeof React }).React = React;

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };

const render = async (searchParams: Record<string, string | string[] | undefined>) =>
  renderToStaticMarkup(
    (await ProjectDetailPage({
      params: { id: '1', locale: 'vi' },
      searchParams,
    })) as React.ReactElement,
  );

beforeEach(() => {
  (getCurrentUser as Mock).mockResolvedValue(ADMIN);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('/projects/1 - render với searchParams.month rác (A-3, vòng CAN SUA #1)', () => {
  it('phải thất bại nếu fix bị gỡ: ?month=abc render được, KHÔNG throw RangeError (trước fix trang trả 500)', async () => {
    await expect(render({ month: 'abc' })).resolves.toContain(repo.getProject(1)!.projectName);
  });

  it('?month=2026-99 (đúng format nhưng tháng rác) cũng không throw, vẫn render project name', async () => {
    await expect(render({ month: '2026-99' })).resolves.toContain(repo.getProject(1)!.projectName);
  });

  it('N-3 (danh-gia.md, vòng 2): ?month=9999-12 (ĐÚNG format YYYY-MM, khớp regex, nhưng năm tràn số) cũng không throw - trước khi vá isValidYearMonth() chỉ check format nên chuỗi này lọt qua guard rồi vỡ ở endOfMonth()', async () => {
    await expect(render({ month: '9999-12' })).resolves.toContain(repo.getProject(1)!.projectName);
  });

  it('không truyền month (undefined) vẫn render bình thường như trước giờ', async () => {
    await expect(render({})).resolves.toContain(repo.getProject(1)!.projectName);
  });

  it('?month=2026-07 (hợp lệ) vẫn render đúng, không bị guard chặn nhầm giá trị hợp lệ', async () => {
    await expect(render({ month: '2026-07' })).resolves.toContain(repo.getProject(1)!.projectName);
  });
});

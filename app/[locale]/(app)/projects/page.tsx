import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/require-user';
import { repo } from '@/server/repo';

/**
 * "Chi tiết dự án" vào thẳng dashboard detail của dự án đầu tiên.
 * Không còn trang list - chuyển dự án bằng ô search trên detail.
 */
export default async function ProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireUser(locale);
  const first = (await repo.listProjects())[0];
  redirect(first ? `/${locale}/projects/${first.id}` : `/${locale}/overview`);
}

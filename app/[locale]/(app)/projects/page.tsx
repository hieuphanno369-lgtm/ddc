import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/require-user';
import { repo } from '@/server/repo';

/**
 * "Chi tiết dự án" vào thẳng dashboard detail của dự án đầu tiên.
 * Không còn trang list - chuyển dự án bằng ô search trên detail.
 */
export default async function ProjectsPage({ params }: { params: { locale: string } }) {
  await requireUser(params.locale);
  const first = (await repo.listProjects())[0];
  redirect(first ? `/${params.locale}/projects/${first.id}` : `/${params.locale}/overview`);
}

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireUser } from '@/lib/require-user';
import { repo } from '@/server/repo';
import { Card, CardBody } from '@/components/ui/Card';
import { IconProject } from '@/components/icons';

/**
 * "Chi tiết dự án" vào thẳng dashboard detail của dự án đầu tiên.
 * Không còn trang list - chuyển dự án bằng ô search trên detail.
 * Chưa có dự án nào (DB mới, chưa nhập): ở lại trang và báo rõ, không đẩy về Tổng quan (chủ dự án chốt 2026-10-01).
 * Nút tạo chỉ cho admin/data-entry, khớp quyền trang Tạo / Sửa dự án.
 */
export default async function ProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireUser(locale);
  const first = (await repo.listProjects())[0];
  if (first) redirect(`/${locale}/projects/${first.id}`);

  const t = await getTranslations();
  const canCreate = user.role === 'admin' || user.role === 'data-entry';
  return (
    <div className="mx-auto w-full max-w-5xl">
      <Card>
        <CardBody>
          {/* đệm đặt ở khối trong: padding của .bd (globals.css) đè py-* đặt thẳng lên CardBody */}
          <div className="flex flex-col items-center py-8 text-center">
            <div
              className="grid h-16 w-16 place-items-center"
              style={{ borderRadius: 'var(--r-icon)', background: 'var(--accent-tint)', color: 'var(--accent)' }}
            >
              <IconProject size={30} />
            </div>
            <h3 className="mt-4 text-title3 font-semibold">{t('projectsEmpty.title')}</h3>
            <p className="mt-1 text-subhead text-label2">
              {canCreate ? t('projectsEmpty.body') : t('projectsEmpty.bodyNoCreate')}
            </p>
            {canCreate && (
              <Link href="/ho-so-du-an?mode=new" className="btn mt-4 inline-flex">{t('projectsEmpty.create')}</Link>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { canWriteProject } from '@/server/authz';
import { repo } from '@/server/repo';
import { buildDailyTemplate } from '@/server/daily-import';

export const dynamic = 'force-dynamic';

/** File mẫu Excel nhân lực/thiết bị theo ngày - 1 file = 1 dự án đang chọn (Q3=a). */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('project');
  const projectId = raw ? Number(raw) : NaN;
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!(await canWriteProject(user, projectId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const project = await repo.getProject(projectId);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [members, shifts, equipments] = await Promise.all([
    repo.getContractors(projectId),
    repo.getShifts(),
    repo.getEquipments(),
  ]);
  const buf = await buildDailyTemplate({ members, shifts, equipments });

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="mau-nhan-luc-thiet-bi-${project.masterCode}.xlsx"`,
    },
  });
}

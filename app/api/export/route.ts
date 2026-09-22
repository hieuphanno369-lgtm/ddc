import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { exportProjects, type DashboardFilters, type GroupBy } from '@/server/queries';
import { rateLimit } from '@/lib/rate-limit';
import type { Market, Priority, ProjectType, Status } from '@/server/repo/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // TODO: thiếu auth check - ai cũng export được. Gọi getCurrentUser, chặn khi chưa login.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local';
  const rl = rateLimit(`export:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  const sp = req.nextUrl.searchParams;

  const filters: DashboardFilters = {
    status: (sp.get('status') as Status) || 'all',
    teamKdId: sp.get('team') ? Number(sp.get('team')) : 'all',
    priority: (sp.get('priority') as Priority) || 'all',
    market: (sp.get('market') as Market) || 'all',
    projectType: (sp.get('type') as ProjectType) || 'all',
    groupBy: sp.get('groupBy') ? (sp.get('groupBy') as GroupBy) : undefined,
    groupKey: sp.get('groupKey') || undefined,
  };

  const rows = await exportProjects({
    month: sp.get('month') || undefined,
    filters,
    search: sp.get('search') || undefined,
    sort: (sp.get('sort') as 'priority') || 'priority',
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('DanhSachDuAn');
  ws.columns = [
    { header: 'Mã DA', key: 'code', width: 18 },
    { header: 'Tên dự án', key: 'name', width: 34 },
    { header: 'Khách hàng', key: 'customer', width: 22 },
    { header: 'Team KD', key: 'team', width: 18 },
    { header: 'Loại hình', key: 'type', width: 16 },
    { header: 'Thị trường', key: 'market', width: 12 },
    { header: 'Trạng thái', key: 'status', width: 20 },
    { header: 'Priority', key: 'priority', width: 10 },
    { header: '% KH', key: 'pctPlan', width: 10 },
    { header: '% TT', key: 'pctActual', width: 10 },
    { header: 'SPI', key: 'spi', width: 10 },
    { header: 'CPI', key: 'cpi', width: 10 },
    { header: 'EAC', key: 'eac', width: 12 },
    { header: 'Giá trị HĐ (tỷ)', key: 'value', width: 16 },
  ];

  for (const r of rows) {
    // TODO: Excel formula injection - escape value bắt đầu = + - @ \t \r (tên dự án/KH nhập tự do).
    ws.addRow({
      code: r.currentAliasCode,
      name: r.projectName,
      customer: r.customerName,
      team: r.teamName,
      type: r.projectType,
      market: r.marketCode,
      status: r.status,
      priority: r.priority,
      pctPlan: r.pctPlan,
      pctActual: r.pctActual,
      spi: r.spi ?? '',
      cpi: r.cpi ?? '',
      eac: r.eac ?? '',
      value: r.contractValue,
    });
  }

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1F3D' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  const buf = await wb.xlsx.writeBuffer();
  const body = new Uint8Array(buf);

  return new Response(body, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="danh-sach-du-an.xlsx"',
    },
  });
}

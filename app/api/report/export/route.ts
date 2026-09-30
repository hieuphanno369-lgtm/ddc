import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getCurrentUser } from '@/lib/session';
import { rateLimit } from '@/lib/rate-limit';
import { clientIpFrom } from '@/lib/client-ip';
import { getReportData } from '@/server/report';
import { todayIso } from '@/lib/clock';
import { defaultOverviewPeriod, parsePeriod } from '@/lib/period';
import { formatDmy } from '@/lib/date-input';
import { safeCell } from '@/lib/excel-safe';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !['admin', 'bod'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const canViewFinance = user.canViewFinance;

  // S-2 (danh-gia-bao-mat.md): kỳ tới 120 tháng dựng workbook trong bộ nhớ, nên giới hạn theo IP như /api/export.
  const rl = rateLimit(`report-export:${clientIpFrom(req.headers)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  // T-2: cùng tham số kỳ với trang /report (from/to hoặc month); rác rơi về kỳ mặc định, không ném lỗi.
  const sp = new URL(req.url).searchParams;
  const period = parsePeriod(
    { from: sp.get('from') ?? undefined, to: sp.get('to') ?? undefined, month: sp.get('month') ?? undefined },
    defaultOverviewPeriod(todayIso()),
  );
  const { kpis, p0Red, rows } = await getReportData(period);

  const wb = new ExcelJS.Workbook();

  const kpiWs = wb.addWorksheet('KPI');
  kpiWs.columns = [
    { header: 'Chỉ số', key: 'label', width: 24 },
    { header: 'Giá trị', key: 'value', width: 26 },
  ];
  kpiWs.addRows([
    { label: 'Dự án trong kỳ', value: kpis.projectsInPeriod },
    { label: 'Đang triển khai', value: kpis.inProgress },
    { label: 'Trễ tiến độ', value: kpis.behindSchedule },
    { label: 'Nguy cơ phạt', value: kpis.penaltyRisk },
    { label: 'Đã phạt', value: kpis.penalized },
    ...(canViewFinance ? [{ label: 'HĐ chưa khởi công (tỷ)', value: kpis.notStartedValue }] : []),
    { label: 'Kỳ báo cáo', value: `${formatDmy(period.from)} - ${formatDmy(period.to)}` },
  ]);

  const p0Ws = wb.addWorksheet('P0-Red');
  p0Ws.columns = [
    { header: 'Mã DA', key: 'code', width: 18 },
    { header: 'Tên dự án', key: 'name', width: 34 },
    { header: 'Priority', key: 'priority', width: 10 },
    { header: 'Rủi ro', key: 'penalty', width: 20 },
  ];
  p0Red.forEach((w) => p0Ws.addRow({ code: safeCell(w.currentAliasCode), name: safeCell(w.projectName), priority: safeCell(w.priority), penalty: safeCell(w.penalty) }));

  const ws = wb.addWorksheet('DanhSachDuAn');
  ws.columns = [
    { header: 'Mã DA', key: 'code', width: 18 },
    { header: 'Tên dự án', key: 'name', width: 34 },
    { header: 'SPI', key: 'spi', width: 10 },
    { header: 'CPI', key: 'cpi', width: 10 },
    { header: '% TT', key: 'pctActual', width: 10 },
    ...(canViewFinance ? [{ header: 'HĐ chưa khởi công (tỷ)', key: 'backlog', width: 14 }] : []),
  ];
  rows.forEach((r) => ws.addRow({
    code: safeCell(r.code),
    name: safeCell(r.name),
    spi: r.spi ?? '',
    cpi: r.cpi ?? '',
    pctActual: r.pctActual,
    ...(canViewFinance ? { backlog: r.backlog } : {}),
  }));

  for (const sheet of [kpiWs, p0Ws, ws]) {
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1F3D' } };
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="bao-cao-ban-dieu-hanh.xlsx"',
    },
  });
}

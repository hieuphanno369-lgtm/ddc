import { addDaysIso, currentMonth, todayIso, type IsoDate } from '@/lib/clock';
import { ALERT_DEADLINE_DAYS, evaluateProjectAlerts } from '@/lib/alert-rules';
import type { NewEngineAlert } from './repo/types';
import { repo } from './repo';

/** Tổng theo ngày, lấy ngày lớn nhất (gần hôm nay nhất) có `planned > 0`. */
function latestDayTotal(
  rows: Array<{ workDate: IsoDate; planned: number; actual: number }>,
): { workDate: IsoDate; planned: number; actual: number } | null {
  const byDay = new Map<string, { planned: number; actual: number }>();
  for (const r of rows) {
    const cur = byDay.get(r.workDate) ?? { planned: 0, actual: 0 };
    cur.planned += r.planned;
    cur.actual += r.actual;
    byDay.set(r.workDate, cur);
  }
  const days = [...byDay.entries()]
    .filter(([, v]) => v.planned > 0)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1));
  if (days.length === 0) return null;
  const [workDate, totals] = days[0];
  return { workDate, ...totals };
}

/**
 * T11 (Task 8, P2A): chạy engine cảnh báo cho 1 nhóm dự án (hoặc tất cả) - đánh giá luật (Q9)
 * rồi ghi các alert MỚI (`repo.insertEngineAlerts` tự chống trùng - K6).
 */
export async function runAlertEngine(opts: { projectIds?: number[] } = {}): Promise<{ checked: number; created: number }> {
  const ym = currentMonth();
  const today = todayIso();
  const from = addDaysIso(today, -6);

  const allProjects = await repo.listProjects();
  const projects = opts.projectIds ? allProjects.filter((p) => opts.projectIds!.includes(p.id)) : allProjects;
  const assignments = await repo.getAssignments();
  const openedAt = new Date().toISOString();

  const newAlerts: NewEngineAlert[] = [];
  let checked = 0;

  for (const project of projects) {
    checked++;

    const factRow = await repo.getLatestFact(project.id, ym);
    const fact = factRow && factRow.yearMonth === ym ? { spi: factRow.spi, cpi: factRow.cpi, pctActual: factRow.pctActual } : null;

    const financialRow = (await repo.getFinancial(project.id)).find((f) => f.yearMonth === ym);
    const financial = financialRow ? { arOverdue: financialRow.arOverdue } : null;

    const manpowerRows = await repo.getDailyManpower(project.id, from, today);
    const manpower = latestDayTotal(
      manpowerRows.map((r) => ({ workDate: r.workDate, planned: r.plannedHeadcount, actual: r.actualHeadcount })),
    );

    const equipmentRows = await repo.getDailyEquipment(project.id, from, today);
    const equipment = latestDayTotal(
      equipmentRows.map((r) => ({ workDate: r.workDate, planned: r.qtyPlanned, actual: r.qtyActual })),
    );

    const candidates = evaluateProjectAlerts({
      project: {
        id: project.id,
        contractValue: project.contractValue,
        committedHandoverDate: project.committedHandoverDate,
        penalized: project.penalized,
        actualStartDate: project.actualStartDate,
        actualFinishDate: project.actualFinishDate,
      },
      yearMonth: ym,
      today,
      fact,
      financial,
      manpower,
      equipment,
    });
    if (candidates.length === 0) continue;

    const owner = assignments.find((a) => a.projectId === project.id && a.roleInProject === 'PIC')?.userEmail ?? 'BOD';
    for (const c of candidates) {
      newAlerts.push({ ...c, owner, deadline: addDaysIso(today, ALERT_DEADLINE_DAYS[c.alertType]), openedAt });
    }
  }

  const created = newAlerts.length > 0 ? await repo.insertEngineAlerts(newAlerts) : 0;
  return { checked, created };
}

/** Gọi sau mỗi lần lưu số liệu - KHÔNG BAO GIỜ throw (không được làm hỏng thao tác lưu chính). */
export async function runAlertEngineSafe(projectId: number): Promise<void> {
  try {
    await runAlertEngine({ projectIds: [projectId] });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[alert-engine] runAlertEngineSafe loi (khong lam vo trang):', e);
  }
}

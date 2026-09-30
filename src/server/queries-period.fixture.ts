/**
 * Fixture P4 (Task B1) cho `queries-period.test.ts`: 3 dự án nhỏ, số liệu tự tính bằng tay được.
 * KHÔNG phải `.test.ts` nên Vitest không tự chạy. Đồng hồ ghim `DDC_FAKE_TODAY = 2026-09-16` (vitest.config.ts).
 *
 * - A: đang chạy, thiếu số tháng 08 (để kiểm "mang số tháng trước sang").
 * - B: nhỏ, kết thúc thực tế 2026-06-20.
 * - C: chuẩn bị, đã ký HĐ 2026-08-01, kế hoạch khởi công 2026-11-01, không có số nào.
 */
import { buildRepoData } from '@/data/seed/history';
import { createReadMock } from '@/server/repo/read-mock';
import type { FactFinancial, FactProgressMonthly, FactVolume, Project } from '@/server/repo/types';

const base = buildRepoData();
const CUSTOMER_ID = base.customers[0].id;
const TEAM = base.teams[0];
const FACTORY = { ...base.factories[0], capacityTonPerYear: 1200 };

function project(over: Partial<Project> & Pick<Project, 'id' | 'projectName' | 'contractValue'>): Project {
  return {
    masterCode: `P4-${over.id}`, currentAliasCode: `P4-${over.id}`, customerId: CUSTOMER_ID, teamKdId: TEAM.id,
    marketCode: 'TN', projectType: 'EPC', priority: 'P1', tonnage: 100, currencyCode: 'VND',
    contractDate: null, plannedStartDate: null, plannedFinishDate: null, committedHandoverDate: null,
    actualStartDate: null, actualFinishDate: null, penaltyValue: null, penalized: false, isActive: true,
    factoryId: FACTORY.id, contractValueOriginal: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', createdBy: 'test', updatedBy: 'test',
    ...over,
  };
}

export const PROJECT_A = project({
  id: 101, projectName: 'A', contractValue: 100, priority: 'P1',
  plannedStartDate: '2026-01-01', plannedFinishDate: '2026-12-31', actualStartDate: '2026-01-10',
  committedHandoverDate: '2026-10-10',
});
export const PROJECT_B = project({
  id: 102, projectName: 'B', contractValue: 10, priority: 'P2',
  plannedStartDate: '2026-01-01', plannedFinishDate: '2026-06-30', actualStartDate: '2026-01-05',
  actualFinishDate: '2026-06-20', committedHandoverDate: '2026-07-15',
});
export const PROJECT_C = project({
  id: 103, projectName: 'C', contractValue: 50, priority: 'P3',
  plannedStartDate: '2026-11-01', plannedFinishDate: '2027-06-30', contractDate: '2026-08-01',
});

const projects = [PROJECT_A, PROJECT_B, PROJECT_C];

function fact(projectId: number, yearMonth: string, pctActual: number, pv: number, ev: number, ac: number,
  spi: number | null, cpi: number | null): FactProgressMonthly {
  return {
    projectId, yearMonth, pctPlan: 0, pctActual, actualStartDate: null, actualFinishDate: null, bac: 0,
    pv, ev, ac, spi, cpi, bottleneckStage: null, equipmentPlanned: 0, equipmentActual: 0, isLatest: true,
    manpowerPlanned: 0, manpowerActual: 0, snapshotLockedAt: null, lockedBy: null, version: 1,
    changedBy: '', changedAt: '', changeNote: '',
  };
}

function financial(projectId: number, yearMonth: string, revenuePeriod: number): FactFinancial {
  return {
    projectId, yearMonth, revenuePeriod, revenueCumulative: 0, costActualPeriod: 0, costActualCumulative: 0,
    grossProfit: 0, grossMarginPct: 0, backlog: 0, arCollected: 0, arOutstanding: 0, arOverdue: 0,
    version: 1, isLatest: true, changedBy: '', changedAt: '', changeNote: '',
  };
}

const facts: FactProgressMonthly[] = [
  fact(101, '2026-03', 0.22, 20, 22, 20, 1.1, 1.1),
  fact(101, '2026-06', 0.4, 40, 40, 40, 1, 1),
  fact(101, '2026-07', 0.45, 50, 45, 50, 0.9, 0.9),
  fact(101, '2026-09', 0.7, 70, 60, 65, 0.86, 0.92),
  fact(102, '2026-03', 0.5, 5, 5, 5, 1, 1),
  fact(102, '2026-06', 1, 10, 5, 12, 0.5, 0.4167),
];
const fin: FactFinancial[] = [financial(101, '2026-06', 5), financial(101, '2026-07', 7), financial(102, '2026-06', 3)];
const volumes: FactVolume[] = [
  { projectId: 101, yearMonth: '2026-06', factoryId: FACTORY.id, tonnageProcessed: 100 },
  { projectId: 101, yearMonth: '2026-07', factoryId: FACTORY.id, tonnageProcessed: 50 },
  { projectId: 102, yearMonth: '2026-06', factoryId: FACTORY.id, tonnageProcessed: 10 },
];

const data = { ...base, projects, facts, financial: fin, volumes };
const readMock = createReadMock(() => data);

const dims = {
  customers: [base.customers[0]],
  teams: [TEAM],
  factories: [FACTORY],
  currencies: base.currencies,
  exchangeRates: base.exchangeRates,
};

/** Stub thay `repo` thật: chỉ có các hàm mà tầng queries cần, đọc từ dữ liệu fixture. */
export const repo = {
  ...readMock,
  async listProjects() { return projects.filter((p) => p.isActive); },
  async getDims() { return dims; },
  async getProject(id: number) { return projects.find((p) => p.id === id && p.isActive); },
  async getFacts(projectId: number) {
    return facts.filter((f) => f.projectId === projectId && f.isLatest).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  },
};

export const TEAM_NAME = TEAM.name;

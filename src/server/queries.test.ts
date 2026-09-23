import { describe, expect, it, vi } from 'vitest';

// getPortfolioKpis/getProjectSummaries đọc qua barrel '@/server/repo', mặc định trỏ prisma-repo
// (Postgres thật). Mock về mock-repo cho test nhanh, xác định, giống mọi test khác trong repo.
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { historyMonths, prevMonth } from '@/lib/clock';
import { getPortfolioKpis, getProjectSummaries, getProjectSummary, type ProjectSummary } from '@/server/queries';

/**
 * Task 0 - Tester nên soi: getPortfolioKpis() đổi từ "HISTORY_MONTHS.indexOf() + fallback tự
 * tham chiếu ở tháng đầu tiên" sang "prevMonth() luôn trả tháng lịch trước đó, kể cả ngoài
 * cửa sổ lịch sử". Test này KHÔNG mock repo - dùng thẳng mock-repo mặc định qua barrel
 * @/server/repo (đã seed sẵn 17 dự án) để khẳng định delta = KPI(tháng) - KPI(prevMonth(tháng))
 * tại MỌI mốc, kể cả tháng đầu tiên của historyMonths() - nơi hành vi cũ và mới có thể lệch nhau.
 */

// Tính lại đúng công thức của kpisForMonth() (nội bộ, không export) từ ProjectSummary[] công khai -
// dùng làm "oracle" độc lập, không phụ thuộc cách getPortfolioKpis() cài đặt bên trong.
function aggregate(summaries: ProjectSummary[]) {
  return {
    totalProjects: summaries.length,
    inProgress: summaries.filter((s) => s.status === 'Dang_trien_khai').length,
    behindSchedule: summaries.filter((s) => s.status === 'Dang_trien_khai' && !s.onTrack).length,
    penaltyRisk: summaries.filter((s) => s.penalty === 'risk').length,
    penalized: summaries.filter((s) => s.penalty === 'penalized').length,
    backlog: summaries.filter((s) => s.status === 'Chuan_bi').reduce((sum, s) => sum + s.contractValue, 0),
  };
}

describe('getPortfolioKpis - đường chạy thuận lợi (tháng giữa cửa sổ lịch sử)', () => {
  it('delta = KPI(tháng hiện tại) - KPI(tháng trước), khớp oracle tính từ getProjectSummaries', async () => {
    const month = '2026-09';
    const prev = prevMonth(month);

    const [kpis, curSummaries, prevSummaries] = await Promise.all([
      getPortfolioKpis(month),
      getProjectSummaries(month),
      getProjectSummaries(prev),
    ]);

    const curAgg = aggregate(curSummaries);
    const prevAgg = aggregate(prevSummaries);

    expect({
      totalProjects: kpis.totalProjects,
      inProgress: kpis.inProgress,
      behindSchedule: kpis.behindSchedule,
      penaltyRisk: kpis.penaltyRisk,
      penalized: kpis.penalized,
      backlog: kpis.backlog,
    }).toEqual(curAgg);

    expect(kpis.delta).toEqual({
      totalProjects: curAgg.totalProjects - prevAgg.totalProjects,
      inProgress: curAgg.inProgress - prevAgg.inProgress,
      behindSchedule: curAgg.behindSchedule - prevAgg.behindSchedule,
      penaltyRisk: curAgg.penaltyRisk - prevAgg.penaltyRisk,
      penalized: curAgg.penalized - prevAgg.penalized,
      backlog: Math.round((curAgg.backlog - prevAgg.backlog) * 10) / 10,
    });
    // Chốt số liệu thật của bộ seed hiện tại (17 dự án) - phát hiện sớm nếu seed đổi mà không cập nhật test.
    expect(kpis.delta.inProgress).toBe(-1);
    expect(kpis.delta.behindSchedule).toBe(-1);
    expect(kpis.delta.penaltyRisk).toBe(-1);
  });
});

describe('getPortfolioKpis - trường hợp biên: tháng ĐẦU TIÊN của historyMonths() (Tester nên soi Task 0)', () => {
  it('prevMonth() của tháng đầu tiên rơi RA NGOÀI cửa sổ lịch sử - vẫn phải là prevMonth() thật, không tự tham chiếu chính nó', async () => {
    const firstMonth = historyMonths()[0]; // '2025-10' với DDC_FAKE_TODAY=2026-09-16
    const outsideWindowPrev = prevMonth(firstMonth); // '2025-09' - KHÔNG có fact nào trong seed

    const [kpis, curSummaries, prevSummaries] = await Promise.all([
      getPortfolioKpis(firstMonth),
      getProjectSummaries(firstMonth),
      getProjectSummaries(outsideWindowPrev),
    ]);

    // Bằng chứng "không tự tham chiếu": prevMonth ngoài cửa sổ vẫn trả object hợp lệ, khác cấu trúc
    // rỗng, và getPortfolioKpis phải đối chiếu đúng với oracle tính từ CHÍNH tháng ngoài cửa sổ đó -
    // nếu code quay lại lối cũ (fallback về chính "cur" khi index=0), phép so sánh dưới đây vẫn phải đúng
    // vì ta tính "prev" độc lập bằng getProjectSummaries(outsideWindowPrev), không suy diễn từ getPortfolioKpis.
    expect(prevSummaries).toHaveLength(curSummaries.length);
    const curAgg = aggregate(curSummaries);
    const prevAgg = aggregate(prevSummaries);
    expect(kpis.delta).toEqual({
      totalProjects: curAgg.totalProjects - prevAgg.totalProjects,
      inProgress: curAgg.inProgress - prevAgg.inProgress,
      behindSchedule: curAgg.behindSchedule - prevAgg.behindSchedule,
      penaltyRisk: curAgg.penaltyRisk - prevAgg.penaltyRisk,
      penalized: curAgg.penalized - prevAgg.penalized,
      backlog: Math.round((curAgg.backlog - prevAgg.backlog) * 10) / 10,
    });
  });

  it('tháng ngoài cửa sổ lịch sử vẫn trả %HT = 0 (không fact) thay vì throw/NaN cho từng dự án', async () => {
    const outsideWindowPrev = prevMonth(historyMonths()[0]);
    const summaries = await getProjectSummaries(outsideWindowPrev);

    expect(summaries.length).toBeGreaterThan(0);
    for (const s of summaries) {
      expect(s.pctActual).toBe(0);
      expect(Number.isNaN(s.pctActual)).toBe(false);
    }
  });
});

describe('getProjectSummary - trường hợp phải thất bại (không tìm thấy dự án)', () => {
  it('id không tồn tại trong seed -> trả undefined, KHÔNG throw', async () => {
    const NONEXISTENT_ID = 999_999;
    await expect(getProjectSummary(NONEXISTENT_ID, '2026-09')).resolves.toBeUndefined();
  });
});

/**
 * Vòng CAN SUA #1 - A-2 (thay-doi.md): getPortfolioKpis('all') từng gọi prevMonth('all')
 * ra chuỗi rác ('0NaN-NaN'), khiến kpisForMonth phía "prev" luôn tính trên fact rỗng của
 * TOÀN BỘ dự án -> delta là hiệu số giữa số liệu thật và số liệu rỗng đó, KHÔNG phải số 0
 * thật sự. Sau fix: nhánh 'all' bỏ hẳn việc gọi prevMonth/kpisForMonth cho "prev", trả thẳng
 * delta = 0 cho cả 6 trường.
 */
describe('getPortfolioKpis - month "all" (A-2, vòng CAN SUA #1)', () => {
  it('đường chạy thuận lợi: delta toàn bộ 6 trường = 0, không phải số bịa', async () => {
    const kpis = await getPortfolioKpis('all');

    expect(kpis.delta).toEqual({
      totalProjects: 0,
      inProgress: 0,
      behindSchedule: 0,
      penaltyRisk: 0,
      penalized: 0,
      backlog: 0,
    });
  });

  it('biên: phần KPI chính (không phải delta) vẫn phản ánh đúng toàn portfolio, không bị fix zero-hoá lây', async () => {
    const kpis = await getPortfolioKpis('all');
    const allSummaries = await getProjectSummaries('all');

    expect(kpis.totalProjects).toBe(allSummaries.length);
    expect(kpis.totalProjects).toBeGreaterThan(0);
    expect(kpis.inProgress).toBe(allSummaries.filter((s) => s.status === 'Dang_trien_khai').length);
  });

  it('phải thất bại (oracle công thức CŨ): nếu còn dùng prevMonth(\'all\') làm "prev" thật sự, delta lẽ ra khác 0 với bộ seed hiện tại - chứng minh test không vô hại', async () => {
    // Công thức CŨ (trước vòng sửa): prevYm = prevMonth('all') = '0NaN-NaN' (chuỗi rác nhưng
    // không throw vì mọi phép toán tháng chỉ thao tác trên string). getLatestFact với chuỗi rác
    // này không khớp fact nào -> mọi dự án coi như "chưa có fact" cho tháng "prev".
    const buggyPrevYm = prevMonth('all');
    expect(buggyPrevYm).toBe('0NaN-NaN');

    const curSummaries = await getProjectSummaries('all');
    const buggyPrevSummaries = await getProjectSummaries(buggyPrevYm);
    const curInProgress = curSummaries.filter((s) => s.status === 'Dang_trien_khai').length;
    const buggyPrevInProgress = buggyPrevSummaries.filter((s) => s.status === 'Dang_trien_khai').length;
    const buggyDeltaInProgress = curInProgress - buggyPrevInProgress;

    // Với bộ seed 17 dự án hiện tại, công thức cũ ra delta KHÁC 0 (bug thật, không phải giả định suông).
    expect(buggyDeltaInProgress).not.toBe(0);

    const kpis = await getPortfolioKpis('all');
    expect(kpis.delta.inProgress).toBe(0);
    expect(kpis.delta.inProgress).not.toBe(buggyDeltaInProgress);
  });
});

/**
 * Vòng CAN SUA #1 - N-4/N-5 (danh-gia.md, vòng 2): 2 lỗ hổng nhỏ mà reviewer/security-reviewer
 * bắt được SAU khi A-2 đã đóng - cùng gốc "không có dữ liệu thật để so sánh" nhưng 2 đường vào
 * khác nhau. Vá gộp chung 1 chỗ trong getPortfolioKpis().
 */
describe('getPortfolioKpis - N-4: yearMonth sai format', () => {
  it('"abc" (không đúng YYYY-MM) -> delta toàn 0, không throw, không bịa số', async () => {
    const kpis = await getPortfolioKpis('abc');
    expect(kpis.delta).toEqual({
      totalProjects: 0,
      inProgress: 0,
      behindSchedule: 0,
      penaltyRisk: 0,
      penalized: 0,
      backlog: 0,
    });
  });

  it('"2026-99" (đúng regex nhưng sai miền giá trị) -> vẫn delta toàn 0, không throw', async () => {
    await expect(getPortfolioKpis('2026-99')).resolves.toMatchObject({
      delta: { totalProjects: 0, inProgress: 0, behindSchedule: 0, penaltyRisk: 0, penalized: 0, backlog: 0 },
    });
  });
});

describe('getPortfolioKpis - N-5: tháng liền trước CHƯA CÓ fact nào (chưa ai nhập số)', () => {
  it('"2026-10" (ngay sau tháng cuối SEED_HISTORY_MONTHS) so với "2026-09" -> delta = 0, không bịa từ pctActual mặc định 0', async () => {
    const nextMonth = '2026-10'; // liền sau '2026-09' - tháng cuối cùng có fact trong seed
    const [kpis, curSummaries] = await Promise.all([
      getPortfolioKpis(nextMonth),
      getProjectSummaries(nextMonth),
    ]);

    // Bằng chứng lỗi có thật (oracle công thức CŨ): nếu cứ tính prev = kpisForMonth('2026-09')
    // thật sự rồi lấy cur - prev như trước khi vá, delta sẽ KHÁC 0 vì '2026-10' toàn bộ dự án
    // rơi về pctActual=0 (chưa có fact) trong khi '2026-09' có số liệu thật.
    const septSummaries = await getProjectSummaries('2026-09');
    const curInProgress = curSummaries.filter((s) => s.status === 'Dang_trien_khai').length;
    const septInProgress = septSummaries.filter((s) => s.status === 'Dang_trien_khai').length;
    expect(curInProgress - septInProgress).not.toBe(0); // chứng minh test không vô hại

    expect(kpis.delta).toEqual({
      totalProjects: 0,
      inProgress: 0,
      behindSchedule: 0,
      penaltyRisk: 0,
      penalized: 0,
      backlog: 0,
    });
  });
});

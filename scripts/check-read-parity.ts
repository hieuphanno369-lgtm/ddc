/**
 * Doi chieu readRepoPrisma (Postgres that) voi createReadMock(buildRepoData()) (seed mac dinh).
 * Chay tay tren DB da `npx prisma db seed` (cung DDC_FAKE_TODAY luc seed). KHONG nam trong vitest.
 * Usage: npx tsx scripts/check-read-parity.ts
 */
import { buildRepoData } from '@/data/seed/history';
import { currentMonth, historyMonths } from '@/lib/clock';
import { prisma } from '@/server/db';
import { createReadMock } from '@/server/repo/read-mock';
import { readRepoPrisma } from '@/server/repo/read-prisma';
import { formPrismaRepo } from '@/server/repo/prisma-repo-form';
import { makeFormMockRepo } from '@/server/repo/mock-repo-form';

/**
 * Chuan hoa timestamp ISO day du (mock giu nguyen chuoi seed '...T00:00:00Z', Postgres tra ve
 * Date -> toISOString() '...T00:00:00.000Z') de 2 ben khong bi coi la lech chi vi thieu ".000".
 * Ngay 'YYYY-MM-DD' (khong co gio) khong khop regex nay nen khong bi dong.
 */
function normalizeTimestamps(json: string): string {
  return json.replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d{3})?Z/g, (_m, base) => `${base}.000Z`);
}

/**
 * Lam tron so thuc ve 6 chu so thap phan (de qua) - SUM/AVG cua Postgres va reduce() cua JS cong
 * theo THU TU KHAC NHAU tren cung tap gia tri float64 nen sai so ~1e-10 la binh thuong, khong phai
 * loi doc sai du lieu.
 */
function roundDeep(v: unknown): unknown {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : v;
  if (Array.isArray(v)) return v.map(roundDeep);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, roundDeep(val)]));
  }
  return v;
}

function canon(x: unknown): string {
  return normalizeTimestamps(JSON.stringify(roundDeep(x)));
}

/** So sanh khong phu thuoc thu tu: moi phan tu -> JSON chuan hoa, sort chuoi, noi lai. */
function sortedJson(arr: unknown[]): string {
  return [...arr].map(canon).sort().join('\n');
}

let failed = false;

function check(label: string, a: unknown, b: unknown) {
  const aStr = Array.isArray(a) ? sortedJson(a) : canon(a);
  const bStr = Array.isArray(b) ? sortedJson(b) : canon(b);
  if (aStr !== bStr) {
    failed = true;
    console.error(`\n[LECH] ${label}`);
    console.error('  prisma:', aStr.slice(0, 2000));
    console.error('  mock  :', bStr.slice(0, 2000));
  } else {
    console.log(`[OK] ${label}`);
  }
}

async function main() {
  const mock = createReadMock(() => buildRepoData());
  const seedData = buildRepoData();
  const formMock = makeFormMockRepo({ getData: () => seedData, persist: () => {} });

  check('readShifts', await readRepoPrisma.readShifts(), await mock.readShifts());

  const projectIds = [1, 17];

  for (const id of projectIds) {
    check(`readManpowerByShiftMonth(${id})`, await readRepoPrisma.readManpowerByShiftMonth(id), await mock.readManpowerByShiftMonth(id));
    check(`readManpowerWeekly(${id})`, await readRepoPrisma.readManpowerWeekly(id), await mock.readManpowerWeekly(id));
    check(`readManpowerRange(${id})`, await readRepoPrisma.readManpowerRange(id), await mock.readManpowerRange(id));
    // P3C-A: 4 ham doc hop dong P3C.
    check(`readEquipmentPlanSegments(${id})`, await formPrismaRepo.readEquipmentPlanSegments(id), await formMock.readEquipmentPlanSegments(id));
    check(`readEquipmentQuotas(${id})`, await formPrismaRepo.readEquipmentQuotas(id), await formMock.readEquipmentQuotas(id));
    check(`readManpowerPlanMonths(${id})`, await formPrismaRepo.readManpowerPlanMonths(id), await formMock.readManpowerPlanMonths(id));
    check(`readShiftRatios(${id})`, await formPrismaRepo.readShiftRatios(id), await formMock.readShiftRatios(id));
    check(`readManpowerActualByMonth(${id})`, await readRepoPrisma.readManpowerActualByMonth(id), await mock.readManpowerActualByMonth(id));
  }

  // Buoc 5: T1-code (a) - readFactSnapshots/readFinancialSnapshots/readVolumeSnapshots/readMonthlyEvm.
  const allProjectIds = (await prisma.project.findMany({ select: { id: true } })).map((p) => p.id);
  for (const m of [currentMonth(), 'all']) {
    check(`readFactSnapshots(${m})`, await readRepoPrisma.readFactSnapshots(m), await mock.readFactSnapshots(m));
    check(`readFinancialSnapshots(${m})`, await readRepoPrisma.readFinancialSnapshots(m), await mock.readFinancialSnapshots(m));
    check(`readVolumeSnapshots(${m})`, await readRepoPrisma.readVolumeSnapshots(m), await mock.readVolumeSnapshots(m));
  }
  check(
    'readMonthlyEvm',
    await readRepoPrisma.readMonthlyEvm(historyMonths(), allProjectIds),
    await mock.readMonthlyEvm(historyMonths(), allProjectIds),
  );

  await prisma.$disconnect();

  if (failed) {
    console.error('\ncheck-read-parity: CO LECH GIUA readRepoPrisma va read-mock.');
    process.exit(1);
  }
  console.log('\ncheck-read-parity: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

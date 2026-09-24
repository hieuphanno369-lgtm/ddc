/**
 * Doi chieu readRepoPrisma (Postgres that) voi createReadMock(buildRepoData()) (seed mac dinh).
 * Chay tay tren DB da `npx prisma db seed` (cung DDC_FAKE_TODAY luc seed). KHONG nam trong vitest.
 * Usage: npx tsx scripts/check-read-parity.ts
 */
import { buildRepoData } from '@/data/seed/history';
import { prisma } from '@/server/db';
import { createReadMock } from '@/server/repo/read-mock';
import { readRepoPrisma } from '@/server/repo/read-prisma';

/**
 * Chuan hoa timestamp ISO day du (mock giu nguyen chuoi seed '...T00:00:00Z', Postgres tra ve
 * Date -> toISOString() '...T00:00:00.000Z') de 2 ben khong bi coi la lech chi vi thieu ".000".
 * Ngay 'YYYY-MM-DD' (khong co gio) khong khop regex nay nen khong bi dong.
 */
function normalizeTimestamps(json: string): string {
  return json.replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d{3})?Z/g, (_m, base) => `${base}.000Z`);
}

/** So sanh khong phu thuoc thu tu: moi phan tu -> JSON (da chuan hoa timestamp), sort chuoi, noi lai. */
function sortedJson(arr: unknown[]): string {
  return [...arr].map((x) => normalizeTimestamps(JSON.stringify(x))).sort().join('\n');
}

let failed = false;

function check(label: string, a: unknown, b: unknown) {
  const aStr = Array.isArray(a) ? sortedJson(a) : normalizeTimestamps(JSON.stringify(a));
  const bStr = Array.isArray(b) ? sortedJson(b) : normalizeTimestamps(JSON.stringify(b));
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

  check('readShifts', await readRepoPrisma.readShifts(), await mock.readShifts());

  const projectIds = [1, 17];
  const planRows = await readRepoPrisma.readEquipmentPlans(1);
  const from = planRows.length ? planRows.reduce((m, p) => (p.plannedStart < m ? p.plannedStart : m), planRows[0].plannedStart) : '2026-01-01';
  const to = planRows.length ? planRows.reduce((m, p) => (p.plannedFinish > m ? p.plannedFinish : m), planRows[0].plannedFinish) : '2026-12-31';

  for (const id of projectIds) {
    check(`readManpowerByShiftMonth(${id})`, await readRepoPrisma.readManpowerByShiftMonth(id), await mock.readManpowerByShiftMonth(id));
    check(`readManpowerWeekly(${id})`, await readRepoPrisma.readManpowerWeekly(id), await mock.readManpowerWeekly(id));
    check(`readManpowerRange(${id})`, await readRepoPrisma.readManpowerRange(id), await mock.readManpowerRange(id));
    check(`readEquipmentPlans(${id})`, await readRepoPrisma.readEquipmentPlans(id), await mock.readEquipmentPlans(id));
    check(
      `readEquipmentUsageDays(${id})`,
      await readRepoPrisma.readEquipmentUsageDays(id, from, to),
      await mock.readEquipmentUsageDays(id, from, to),
    );
  }

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

/**
 * Seed 10 trieu dong gia tren `ddc_control_tower_b` de do hieu nang T1 (Buoc 7 P2B).
 * CHI chay duoc tren DB dung ten (assertPerfDb) - khong bao gio dung tren `ddc_control_tower` (A).
 * Sinh du lieu BANG SQL (INSERT ... SELECT ... generate_series) trong DB, khong day qua Node.
 * Usage: npx tsx scripts/perf/seed-perf.ts [--projects=500] [--days=730] [--audit=1000000]
 *        [--activity=100000] [--end=YYYY-MM-DD] [--clean-only]
 */
import { Prisma } from '@prisma/client';
import { addDaysIso, todayIso } from '@/lib/clock';
import { assertPerfDb, estimateRows, parsePerfArgs, PERF_ACTIVITY_EMAIL, PERF_PREFIX, PERF_USER } from '@/lib/perf-guard';
import { prisma } from '@/server/db';

const BATCH_PROJECTS = 50;
const CONTRACTOR_LIMIT = 6;
const EQUIPMENT_LIMIT = 2;
const MONTHS = 36;

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

async function main() {
  const opts = parsePerfArgs(process.argv.slice(2), todayIso());

  const [{ current_database: currentDb }] = await prisma.$queryRaw<{ current_database: string }[]>(
    Prisma.sql`SELECT current_database()`,
  );
  assertPerfDb(currentDb);
  console.log(`[perf-seed] DB = ${currentDb} (OK)`);

  console.log('[perf-seed] Don du lieu PERF cu (neu co)...');
  await prisma.$executeRaw(Prisma.sql`DELETE FROM "dim_project" WHERE "masterCode" LIKE ${`${PERF_PREFIX}%`}`);
  await prisma.$executeRaw(Prisma.sql`DELETE FROM "audit_log" WHERE "changedBy" = ${PERF_USER}`);
  await prisma.$executeRaw(Prisma.sql`DELETE FROM "activity_log" WHERE "userEmail" = ${PERF_ACTIVITY_EMAIL}`);

  if (opts.clean) {
    console.log('[perf-seed] --clean-only: da don xong, dung.');
    await prisma.$disconnect();
    return;
  }

  const [dims] = await prisma.$queryRaw<{
    hasVnd: boolean; customers: bigint; teams: bigint; factories: bigint;
    contractors: bigint; equipments: bigint; shiftsActive: bigint; stages: bigint;
  }[]>(Prisma.sql`
    SELECT
      EXISTS(SELECT 1 FROM "dim_currency" WHERE code = 'VND') AS "hasVnd",
      (SELECT count(*) FROM "dim_customer")::bigint AS customers,
      (SELECT count(*) FROM "dim_team_kd")::bigint AS teams,
      (SELECT count(*) FROM "dim_factory")::bigint AS factories,
      (SELECT count(*) FROM "dim_contractor")::bigint AS contractors,
      (SELECT count(*) FROM "dim_equipment")::bigint AS equipments,
      (SELECT count(*) FROM "dim_shift" WHERE "isActive")::bigint AS "shiftsActive",
      (SELECT count(*) FROM "dim_stage")::bigint AS stages
  `);
  if (
    !dims.hasVnd || dims.customers < BigInt(1) || dims.teams < BigInt(1) || dims.factories < BigInt(1)
    || dims.contractors < BigInt(CONTRACTOR_LIMIT) || dims.equipments < BigInt(EQUIPMENT_LIMIT) || dims.shiftsActive < BigInt(1)
  ) {
    console.error(
      '[perf-seed] Thieu du lieu dim co ban (currency VND, >=1 customer/team/factory, '
      + `>=${CONTRACTOR_LIMIT} contractor, >=${EQUIPMENT_LIMIT} equipment, >=1 shift active). `
      + 'Chay `npx prisma db seed` truoc.',
    );
    process.exit(1);
  }

  const estimated = estimateRows(opts, CONTRACTOR_LIMIT, Number(dims.shiftsActive), EQUIPMENT_LIMIT, Number(dims.stages));
  console.log(`[perf-seed] Tham so: projects=${opts.projects} days=${opts.days} end=${opts.end} audit=${fmt(opts.audit)} activity=${fmt(opts.activity)}`);
  console.log(`[perf-seed] Uoc luong so dong se sinh: ~${fmt(estimated)}`);

  const S = addDaysIso(opts.end, -(opts.days - 1));

  // ---- dim_project ----
  console.log('[perf-seed] Tao dim_project...');
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "dim_project" (
      "masterCode","currentAliasCode","projectName","customerId","teamKdId","marketCode","projectType","priority",
      "contractValue","tonnage","currencyCode","plannedStartDate","plannedFinishDate","actualStartDate",
      "createdAt","updatedAt","createdBy","updatedBy"
    )
    SELECT
      ${PERF_PREFIX} || lpad(g::text, 4, '0'),
      ${PERF_PREFIX} || lpad(g::text, 4, '0'),
      'PERF project ' || g,
      (SELECT array_agg(id ORDER BY id) FROM "dim_customer")[1 + g % (SELECT count(*)::int FROM "dim_customer")],
      (SELECT array_agg(id ORDER BY id) FROM "dim_team_kd")[1 + g % (SELECT count(*)::int FROM "dim_team_kd")],
      (ARRAY['TN','XK','NoiBo']::"MarketCode"[])[1 + g % 3],
      (ARRAY['EPC','San_van_dong','San_bay','Nha_xuong','Cau_cang','Cao_tang','Dong_tau','Cau_giao_thong','Khac']::"ProjectTypeCode"[])[1 + g % 9],
      (ARRAY['P0','P1','P2','P3']::"PriorityCode"[])[1 + g % 4],
      100 + g % 900,
      500 + g % 5000,
      'VND',
      ${S}::date,
      ${opts.end}::date + 180,
      ${S}::date,
      now(), now(), ${PERF_USER}, ${PERF_USER}
    FROM generate_series(1, ${opts.projects}) AS g
  `);

  // ---- project_contractor: 6 nha thau dau (ORDER BY id LIMIT 6) ----
  console.log('[perf-seed] Tao project_contractor...');
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "project_contractor" ("projectId", "contractorId")
    SELECT p.id, c.id
    FROM "dim_project" p
    CROSS JOIN (SELECT id FROM "dim_contractor" ORDER BY id LIMIT ${CONTRACTOR_LIMIT}) c
    WHERE p."masterCode" LIKE ${`${PERF_PREFIX}%`}
  `);

  // ---- project_equipment_plan: 2 thiet bi dau x 3 chiec, khoang ngay nam trong cua so ----
  console.log('[perf-seed] Tao project_equipment_plan...');
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "project_equipment_plan" ("projectId", "equipmentId", "unitNo", "workItemId", "plannedStart", "plannedFinish", "note", "updatedAt", "updatedBy")
    SELECT p.id, e.id, u."unitNo", NULL,
      LEAST((${S}::date + ((e.rn - 1) * 3 + (u."unitNo" - 1)) * interval '20 day')::date, ${opts.end}::date - interval '1 day')::date AS "plannedStart",
      LEAST((${S}::date + ((e.rn - 1) * 3 + (u."unitNo" - 1)) * interval '20 day' + interval '40 day')::date, ${opts.end}::date)::date AS "plannedFinish",
      '', now(), ${PERF_USER}
    FROM "dim_project" p
    CROSS JOIN (SELECT id, row_number() OVER (ORDER BY id) AS rn FROM "dim_equipment" ORDER BY id LIMIT ${EQUIPMENT_LIMIT}) e
    CROSS JOIN (SELECT unnest(ARRAY[1, 2, 3]) AS "unitNo") u
    WHERE p."masterCode" LIKE ${`${PERF_PREFIX}%`}
  `);

  // ---- fact_progress_monthly: 36 thang, ket thuc o thang cua `end` ----
  console.log('[perf-seed] Tao fact_progress_monthly (36 thang/du an)...');
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "fact_progress_monthly" (
      "projectId","yearMonth","version","isLatest","pctPlan","pctActual","bac","pv","ev","ac","spi","cpi",
      "manpowerPlanned","manpowerActual","equipmentPlanned","equipmentActual","changedBy","changedAt","changeNote"
    )
    SELECT x."projectId", x."yearMonth", 1, true, x."pctPlan", x."pctActual", x.bac, x.pv, x.ev, x.ac,
      CASE WHEN x.pv = 0 THEN NULL ELSE x.ev / x.pv END,
      CASE WHEN x.ac = 0 THEN NULL ELSE x.ev / x.ac END,
      0, 0, 0, 0, ${PERF_USER}, now(), 'perf-seed'
    FROM (
      SELECT p.id AS "projectId",
        to_char(date_trunc('month', ${opts.end}::date) - ((${MONTHS} - k) * interval '1 month'), 'YYYY-MM') AS "yearMonth",
        LEAST(1, k / 36.0) AS "pctPlan",
        LEAST(1, k / 40.0) AS "pctActual",
        p."contractValue" AS bac,
        p."contractValue" * LEAST(1, k / 36.0) AS pv,
        p."contractValue" * LEAST(1, k / 40.0) AS ev,
        (p."contractValue" * LEAST(1, k / 40.0)) * (0.95 + (p.id % 10) / 100.0) AS ac
      FROM "dim_project" p CROSS JOIN generate_series(1, ${MONTHS}) AS k
      WHERE p."masterCode" LIKE ${`${PERF_PREFIX}%`}
    ) x
  `);

  // ---- fact_financial: 36 thang ----
  console.log('[perf-seed] Tao fact_financial (36 thang/du an)...');
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "fact_financial" (
      "projectId","yearMonth","version","isLatest","revenuePeriod","revenueCumulative","costActualPeriod","costActualCumulative",
      "grossProfit","grossMarginPct","backlog","arCollected","arOutstanding","arOverdue","changedBy","changedAt","changeNote"
    )
    SELECT x."projectId", x."yearMonth", 1, true, x."revenuePeriod", x."revenueCumulative", x."costActualPeriod", x."costActualCumulative",
      x."revenueCumulative" - x."costActualCumulative",
      CASE WHEN x."revenueCumulative" = 0 THEN 0 ELSE (x."revenueCumulative" - x."costActualCumulative") / x."revenueCumulative" END,
      x.backlog, x."arCollected", x."revenueCumulative" - x."arCollected", x."arOverdue",
      ${PERF_USER}, now(), 'perf-seed'
    FROM (
      SELECT p.id AS "projectId",
        to_char(date_trunc('month', ${opts.end}::date) - ((${MONTHS} - k) * interval '1 month'), 'YYYY-MM') AS "yearMonth",
        p."contractValue" / 36 AS "revenuePeriod",
        p."contractValue" * (k / 36.0) AS "revenueCumulative",
        p."contractValue" / 40 AS "costActualPeriod",
        p."contractValue" * LEAST(1, k / 40.0) AS "costActualCumulative",
        p."contractValue" * (1 - LEAST(1, k / 36.0)) AS backlog,
        (p."contractValue" * (k / 36.0)) * 0.8 AS "arCollected",
        (p."contractValue" * (k / 36.0)) * 0.05 AS "arOverdue"
      FROM "dim_project" p CROSS JOIN generate_series(1, ${MONTHS}) AS k
      WHERE p."masterCode" LIKE ${`${PERF_PREFIX}%`}
    ) x
  `);

  // ---- fact_volume: 36 thang, factory luan phien theo tung du an ----
  console.log('[perf-seed] Tao fact_volume (36 thang/du an)...');
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "fact_volume" ("projectId", "yearMonth", "factoryId", "tonnageProcessed")
    SELECT pm."projectId", pm."yearMonth", pm."factoryId", pm.tonnage * LEAST(1, pm.k / 36.0) / 36
    FROM (
      SELECT p.id AS "projectId", p.tonnage, k,
        to_char(date_trunc('month', ${opts.end}::date) - ((${MONTHS} - k) * interval '1 month'), 'YYYY-MM') AS "yearMonth",
        (SELECT array_agg(id ORDER BY id) FROM "dim_factory")[1 + (row_number() OVER (ORDER BY p.id))::int % (SELECT count(*)::int FROM "dim_factory")] AS "factoryId"
      FROM "dim_project" p CROSS JOIN generate_series(1, ${MONTHS}) AS k
      WHERE p."masterCode" LIKE ${`${PERF_PREFIX}%`}
    ) pm
  `);

  // ---- fact_value_chain_progress: 36 thang x moi dim_stage ----
  console.log('[perf-seed] Tao fact_value_chain_progress (36 thang x moi giai doan)...');
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "fact_value_chain_progress" ("projectId", "stageCode", "yearMonth", "pctComplete", "applicable")
    SELECT p.id, s.code,
      to_char(date_trunc('month', ${opts.end}::date) - ((${MONTHS} - k) * interval '1 month'), 'YYYY-MM'),
      LEAST(1, k / 36.0), true
    FROM "dim_project" p
    CROSS JOIN "dim_stage" s
    CROSS JOIN generate_series(1, ${MONTHS}) AS k
    WHERE p."masterCode" LIKE ${`${PERF_PREFIX}%`}
  `);

  // ---- fact_daily_manpower + fact_daily_equipment_usage: theo lo 50 du an ----
  const idRows = await prisma.$queryRaw<{ id: number }[]>(
    Prisma.sql`SELECT id FROM "dim_project" WHERE "masterCode" LIKE ${`${PERF_PREFIX}%`} ORDER BY id`,
  );
  const ids = idRows.map((r) => r.id);
  const totalBatches = Math.ceil(ids.length / BATCH_PROJECTS);
  for (let i = 0; i < ids.length; i += BATCH_PROJECTS) {
    const batch = ids.slice(i, i + BATCH_PROJECTS);
    const a = batch[0];
    const b = batch[batch.length - 1];
    const batchNo = Math.floor(i / BATCH_PROJECTS) + 1;
    console.log(`[perf-seed] fact_daily_manpower/equipment_usage: lo ${batchNo}/${totalBatches} (projectId ${a}-${b})`);

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "fact_daily_manpower" ("projectId", "contractorId", "workDate", "shiftCode", "plannedHeadcount", "actualHeadcount")
      SELECT p.id, c.id, d::date, s.code,
        20 + (p.id + c.id) % 30,
        15 + (p.id * 7 + c.id * 3 + EXTRACT(DOY FROM d)::int) % 35
      FROM "dim_project" p
      CROSS JOIN (SELECT id FROM "dim_contractor" ORDER BY id LIMIT ${CONTRACTOR_LIMIT}) c
      CROSS JOIN generate_series(${S}::date, ${opts.end}::date, interval '1 day') d
      CROSS JOIN (SELECT code FROM "dim_shift" WHERE "isActive" ORDER BY "sortOrder") s
      WHERE p."masterCode" LIKE ${`${PERF_PREFIX}%`} AND p.id BETWEEN ${a} AND ${b}
    `);

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "fact_daily_equipment_usage" ("projectId", "contractorId", "equipmentId", "workDate", "qtyPlanned", "qtyActual")
      SELECT p.id, c.id, e.id, d::date,
        1 + (p.id + e.id) % 3,
        (p.id + c.id + EXTRACT(DOY FROM d)::int) % 4
      FROM "dim_project" p
      CROSS JOIN (SELECT id FROM "dim_contractor" ORDER BY id LIMIT ${CONTRACTOR_LIMIT}) c
      CROSS JOIN (SELECT id FROM "dim_equipment" ORDER BY id LIMIT ${EQUIPMENT_LIMIT}) e
      CROSS JOIN generate_series(${S}::date, ${opts.end}::date, interval '1 day') d
      WHERE p."masterCode" LIKE ${`${PERF_PREFIX}%`} AND p.id BETWEEN ${a} AND ${b}
    `);
  }

  // ---- audit_log ----
  console.log(`[perf-seed] Tao audit_log (${fmt(opts.audit)} dong)...`);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "audit_log" ("tableName", "recordId", "field", "oldValue", "newValue", "changedBy", "changedAt")
    SELECT 'fact_progress_monthly', (g % ${opts.projects})::text, 'pctActual', '', '', ${PERF_USER}, now() - (g || ' minutes')::interval
    FROM generate_series(1, ${opts.audit}) AS g
  `);

  // ---- activity_log (createdAt trai dai ~140 ngay -> ~10% nam trong 14 ngay gan nhat) ----
  console.log(`[perf-seed] Tao activity_log (${fmt(opts.activity)} dong)...`);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "activity_log" ("userEmail", "userName", "action", "createdAt")
    SELECT ${PERF_ACTIVITY_EMAIL}, 'Perf Seed', 'view', now() - ((g * 121) || ' seconds')::interval
    FROM generate_series(1, ${opts.activity}) AS g
  `);

  console.log('[perf-seed] ANALYZE...');
  await prisma.$executeRaw(Prisma.sql`ANALYZE`);

  const counts = await prisma.$queryRaw<{ table: string; n: bigint }[]>(Prisma.sql`
    SELECT 'dim_project' AS "table", count(*)::bigint AS n FROM "dim_project" WHERE "masterCode" LIKE ${`${PERF_PREFIX}%`}
    UNION ALL SELECT 'project_contractor', count(*) FROM "project_contractor" pc JOIN "dim_project" p ON p.id = pc."projectId" WHERE p."masterCode" LIKE ${`${PERF_PREFIX}%`}
    UNION ALL SELECT 'project_equipment_plan', count(*) FROM "project_equipment_plan" e JOIN "dim_project" p ON p.id = e."projectId" WHERE p."masterCode" LIKE ${`${PERF_PREFIX}%`}
    UNION ALL SELECT 'fact_progress_monthly', count(*) FROM "fact_progress_monthly" f JOIN "dim_project" p ON p.id = f."projectId" WHERE p."masterCode" LIKE ${`${PERF_PREFIX}%`}
    UNION ALL SELECT 'fact_financial', count(*) FROM "fact_financial" f JOIN "dim_project" p ON p.id = f."projectId" WHERE p."masterCode" LIKE ${`${PERF_PREFIX}%`}
    UNION ALL SELECT 'fact_volume', count(*) FROM "fact_volume" f JOIN "dim_project" p ON p.id = f."projectId" WHERE p."masterCode" LIKE ${`${PERF_PREFIX}%`}
    UNION ALL SELECT 'fact_value_chain_progress', count(*) FROM "fact_value_chain_progress" f JOIN "dim_project" p ON p.id = f."projectId" WHERE p."masterCode" LIKE ${`${PERF_PREFIX}%`}
    UNION ALL SELECT 'fact_daily_manpower', count(*) FROM "fact_daily_manpower" f JOIN "dim_project" p ON p.id = f."projectId" WHERE p."masterCode" LIKE ${`${PERF_PREFIX}%`}
    UNION ALL SELECT 'fact_daily_equipment_usage', count(*) FROM "fact_daily_equipment_usage" f JOIN "dim_project" p ON p.id = f."projectId" WHERE p."masterCode" LIKE ${`${PERF_PREFIX}%`}
    UNION ALL SELECT 'audit_log', count(*) FROM "audit_log" WHERE "changedBy" = ${PERF_USER}
    UNION ALL SELECT 'activity_log', count(*) FROM "activity_log" WHERE "userEmail" = ${PERF_ACTIVITY_EMAIL}
  `);

  let total = 0;
  console.log('\n[perf-seed] So dong da sinh:');
  for (const c of counts) {
    const n = Number(c.n);
    total += n;
    console.log(`  ${c.table.padEnd(28)} ${fmt(n)}`);
  }
  console.log(`  ${'TONG'.padEnd(28)} ${fmt(total)}`);

  await prisma.$disconnect();

  if (total < 10_000_000) {
    console.error(`\n[perf-seed] CANH BAO: tong ${fmt(total)} dong < 10.000.000 - tang --projects/--days de du chi tieu.`);
    process.exit(1);
  }
  console.log('\n[perf-seed] OK - du 10 trieu dong.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

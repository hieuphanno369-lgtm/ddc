-- Hoi phuc migration 20260924090000_p1a_data_foundation.
-- Chay: npx prisma db execute --file prisma/rollback/20260924090000_p1a_data_foundation.down.sql --schema prisma/schema.prisma
-- Comment trong file nay viet khong dau.

BEGIN;

-- 1. Xoa 2 bang moi khong anh huong du lieu con lai.
DROP TABLE "project_equipment_plan";
DROP TABLE "dim_date";

-- 2. Gop cac ca ve lai NGAY, giu nguyen tong (nguoc voi buoc 2 cua migration up).
CREATE TEMP TABLE _mp AS SELECT "projectId","contractorId","workDate",
  SUM("plannedHeadcount")::int AS p, SUM("actualHeadcount")::int AS a
  FROM "fact_daily_manpower" GROUP BY 1,2,3;

ALTER TABLE "fact_daily_manpower" DROP CONSTRAINT "fact_daily_manpower_shiftCode_fkey";
DELETE FROM "fact_daily_manpower";
ALTER TABLE "fact_daily_manpower" DROP CONSTRAINT "fact_daily_manpower_pkey";
DROP INDEX "fact_daily_manpower_workDate_idx";
ALTER TABLE "fact_daily_manpower" DROP COLUMN "shiftCode";
ALTER TABLE "fact_daily_manpower" ADD CONSTRAINT "fact_daily_manpower_pkey" PRIMARY KEY ("projectId","contractorId","workDate");

INSERT INTO "fact_daily_manpower" ("projectId","contractorId","workDate","plannedHeadcount","actualHeadcount")
SELECT "projectId","contractorId","workDate",p,a FROM _mp;

DROP TABLE "dim_shift";

-- 3. dim_project: bo khu vuc SX + gia tri nguyen te.
ALTER TABLE "dim_project" DROP CONSTRAINT "dim_project_factoryId_fkey";
DROP INDEX "dim_project_factoryId_idx";
ALTER TABLE "dim_project" DROP COLUMN "factoryId";
ALTER TABLE "dim_project" DROP COLUMN "contractValueOriginal";

-- 3b. Bo cac index them cho audit_log / alert_log.
DROP INDEX "audit_log_changedAt_idx";
DROP INDEX "audit_log_tableName_recordId_idx";
DROP INDEX "alert_log_openedAt_idx";

-- 4. Xoa dau vet migration de "migrate deploy" co the ap lai tu dau.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260924090000_p1a_data_foundation';

COMMIT;

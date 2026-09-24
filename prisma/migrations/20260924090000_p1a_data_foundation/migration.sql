-- P1A: migration gop - ca lam viec, dim_date, khu vuc SX, nguyen te, ke hoach thiet bi, index.
-- Comment trong file nay viet khong dau.

-- 1. Ca lam viec (dim_shift) - bang mo rong duoc, them ca = INSERT, khong migration.
CREATE TABLE "dim_shift" (
    "code" TEXT NOT NULL,
    "nameVi" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "dim_shift_pkey" PRIMARY KEY ("code")
);

INSERT INTO "dim_shift" ("code","nameVi","nameEn","sortOrder","isActive") VALUES
    ('morning','Ca sáng','Morning',1,true),
    ('afternoon','Ca chiều','Afternoon',2,true);

-- 2. fact_daily_manpower: them shiftCode. Du lieu cu la tong ngay -> don ca vao 'morning' (mac dinh M1),
-- khong duoc de Prisma sinh ADD COLUMN ... NOT NULL khong default (se loi tren dong co san).
ALTER TABLE "fact_daily_manpower" ADD COLUMN "shiftCode" TEXT NOT NULL DEFAULT 'morning';
ALTER TABLE "fact_daily_manpower" DROP CONSTRAINT "fact_daily_manpower_pkey";
ALTER TABLE "fact_daily_manpower" ADD CONSTRAINT "fact_daily_manpower_pkey" PRIMARY KEY ("projectId","contractorId","workDate","shiftCode");
ALTER TABLE "fact_daily_manpower" ALTER COLUMN "shiftCode" DROP DEFAULT;
ALTER TABLE "fact_daily_manpower" ADD CONSTRAINT "fact_daily_manpower_shiftCode_fkey" FOREIGN KEY ("shiftCode") REFERENCES "dim_shift"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "fact_daily_manpower_workDate_idx" ON "fact_daily_manpower"("workDate");

-- 3. dim_project: khu vuc SX chinh (factoryId) + gia tri nguyen te (contractValueOriginal).
-- Backfill factoryId = nha may co tong tonnageProcessed lon nhat cua du an trong fact_volume; khong co -> NULL (mac dinh M6).
ALTER TABLE "dim_project" ADD COLUMN "factoryId" INTEGER;
ALTER TABLE "dim_project" ADD COLUMN "contractValueOriginal" DOUBLE PRECISION;

UPDATE "dim_project" p SET "factoryId" = (
  SELECT v."factoryId" FROM "fact_volume" v WHERE v."projectId" = p."id"
  GROUP BY v."factoryId" ORDER BY SUM(v."tonnageProcessed") DESC, v."factoryId" ASC LIMIT 1);

ALTER TABLE "dim_project" ADD CONSTRAINT "dim_project_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "dim_factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "dim_project_factoryId_idx" ON "dim_project"("factoryId");

-- 4. dim_date: lich ngay cho nhom theo tuan ISO (Thu 2 dau tuan). Do san 2020-01-01..2035-12-31, khong seed.
CREATE TABLE "dim_date" (
    "date" DATE NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "isoYear" INTEGER NOT NULL,
    "isoWeek" INTEGER NOT NULL,
    "weekStart" DATE NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,

    CONSTRAINT "dim_date_pkey" PRIMARY KEY ("date")
);

CREATE INDEX "dim_date_weekStart_idx" ON "dim_date"("weekStart");
CREATE INDEX "dim_date_yearMonth_idx" ON "dim_date"("yearMonth");

INSERT INTO "dim_date" ("date","yearMonth","isoYear","isoWeek","weekStart","dayOfWeek")
SELECT d::date, to_char(d,'YYYY-MM'), EXTRACT(ISOYEAR FROM d)::int, EXTRACT(WEEK FROM d)::int,
       date_trunc('week', d)::date, EXTRACT(ISODOW FROM d)::int
FROM generate_series('2020-01-01'::date, '2035-12-31'::date, interval '1 day') AS d;

-- 5. project_equipment_plan: ke hoach dung tung chiec thiet bi cho Gantt T14. 1 dong = 1 thanh.
CREATE TABLE "project_equipment_plan" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "unitNo" INTEGER NOT NULL,
    "workItemId" INTEGER,
    "plannedStart" DATE NOT NULL,
    "plannedFinish" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "project_equipment_plan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_equipment_plan_projectId_equipmentId_unitNo_idx" ON "project_equipment_plan"("projectId", "equipmentId", "unitNo");
CREATE INDEX "project_equipment_plan_projectId_plannedStart_idx" ON "project_equipment_plan"("projectId", "plannedStart");

ALTER TABLE "project_equipment_plan" ADD CONSTRAINT "project_equipment_plan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_equipment_plan" ADD CONSTRAINT "project_equipment_plan_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "dim_equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_equipment_plan" ADD CONSTRAINT "project_equipment_plan_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "project_work_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_equipment_plan" ADD CONSTRAINT "project_equipment_plan_unitNo_check" CHECK ("unitNo" >= 1);
ALTER TABLE "project_equipment_plan" ADD CONSTRAINT "project_equipment_plan_dates_check" CHECK ("plannedFinish" >= "plannedStart");

-- 6. Index bo sung cho audit_log / alert_log.
CREATE INDEX "audit_log_changedAt_idx" ON "audit_log"("changedAt");
CREATE INDEX "audit_log_tableName_recordId_idx" ON "audit_log"("tableName", "recordId");
CREATE INDEX "alert_log_openedAt_idx" ON "alert_log"("openedAt");

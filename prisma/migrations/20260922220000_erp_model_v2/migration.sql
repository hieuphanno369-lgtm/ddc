-- Run 1 - ERP data model v2: 11 bang moi, enum thay String tran, FK, fact append-only.
-- Sinh bang `prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma --script`
-- (thay cho `migrate dev --create-only` vi moi truong non-interactive), roi sua tay 3 diem:
--   1) Doi String -> enum: Prisma diff mac dinh DROP COLUMN + ADD COLUMN (mat du lieu vi cot
--      NOT NULL khong co default). Da sua thanh ALTER COLUMN ... TYPE ... USING (...::text::...)
--      cho alert_log.alertType, dim_project.marketCode/projectType/priority,
--      project_assignments.roleInProject, sap_queue.status (rieng status phai DROP DEFAULT truoc,
--      doi kieu, roi SET DEFAULT lai).
--   2) Doi PK cua fact_progress_monthly/fact_financial sang (projectId, yearMonth, version): giu
--      nguyen DROP/ADD CONSTRAINT do Prisma sinh (khong mat du lieu, chi doi khoa chinh).
--   3) Khoa ngoai: dem lai, migration nay co 32 FOREIGN KEY (> 0, dung ky vong).
--
-- CANH BAO (da ghi trong ke-hoach Task 4 - Quyet dinh ky thuat #4): 2 unique index partial
-- (WHERE "isLatest") o cuoi file la viet tay vi Prisma khong dien dat duoc index co menh de WHERE.
-- Lan chay `prisma migrate dev` ke tiep co the sinh migration DROP INDEX cho 2 index nay - luon
-- dung --create-only, xem SQL, xoa dong DROP INDEX do truoc khi apply.

-- CreateEnum
CREATE TYPE "MarketCode" AS ENUM ('TN', 'XK', 'NoiBo');

-- CreateEnum
CREATE TYPE "ProjectTypeCode" AS ENUM ('EPC', 'San_van_dong', 'San_bay', 'Nha_xuong', 'Cau_cang', 'Cao_tang', 'Dong_tau', 'Cau_giao_thong', 'Khac');

-- CreateEnum
CREATE TYPE "PriorityCode" AS ENUM ('P0', 'P1', 'P2', 'P3');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('Red', 'Amber');

-- CreateEnum
CREATE TYPE "RoleInProject" AS ENUM ('PIC', 'Backup');

-- CreateEnum
CREATE TYPE "SapQueueStatus" AS ENUM ('pending', 'resolved');

-- CreateEnum
CREATE TYPE "StageCalcMode" AS ENUM ('manual', 'volume');

-- AlterTable: alert_log.alertType String -> enum (USING giu du lieu cu)
ALTER TABLE "alert_log" ALTER COLUMN "alertType" TYPE "AlertType" USING ("alertType"::text::"AlertType");

-- AlterTable: dim_project.marketCode/projectType/priority String -> enum (USING giu du lieu cu)
ALTER TABLE "dim_project" ALTER COLUMN "marketCode" TYPE "MarketCode" USING ("marketCode"::text::"MarketCode");
ALTER TABLE "dim_project" ALTER COLUMN "projectType" TYPE "ProjectTypeCode" USING ("projectType"::text::"ProjectTypeCode");
ALTER TABLE "dim_project" ALTER COLUMN "priority" TYPE "PriorityCode" USING ("priority"::text::"PriorityCode");

-- AlterTable
ALTER TABLE "fact_financial" DROP CONSTRAINT "fact_financial_pkey",
ADD COLUMN     "isLatest" BOOLEAN NOT NULL DEFAULT true,
ADD CONSTRAINT "fact_financial_pkey" PRIMARY KEY ("projectId", "yearMonth", "version");

-- AlterTable
ALTER TABLE "fact_progress_monthly" DROP CONSTRAINT "fact_progress_monthly_pkey",
ADD COLUMN     "isLatest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "manpowerActual" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "manpowerPlanned" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "equipmentPlanned" SET DEFAULT 0,
ADD CONSTRAINT "fact_progress_monthly_pkey" PRIMARY KEY ("projectId", "yearMonth", "version");

-- AlterTable: project_assignments.roleInProject String -> enum (USING giu du lieu cu)
ALTER TABLE "project_assignments" ALTER COLUMN "roleInProject" TYPE "RoleInProject" USING ("roleInProject"::text::"RoleInProject");

-- AlterTable: sap_queue.status String -> enum (phai bo DEFAULT truoc, doi kieu, roi dat lai DEFAULT)
ALTER TABLE "sap_queue" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "sap_queue" ALTER COLUMN "status" TYPE "SapQueueStatus" USING ("status"::text::"SapQueueStatus");
ALTER TABLE "sap_queue" ALTER COLUMN "status" SET DEFAULT 'pending';

-- CreateTable
CREATE TABLE "dim_stage" (
    "code" TEXT NOT NULL,
    "nameVi" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "calcMode" "StageCalcMode" NOT NULL DEFAULT 'manual',

    CONSTRAINT "dim_stage_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "project_stage_weight" (
    "projectId" INTEGER NOT NULL,
    "stageCode" TEXT NOT NULL,
    "weightPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "applicable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "project_stage_weight_pkey" PRIMARY KEY ("projectId","stageCode")
);

-- CreateTable
CREATE TABLE "project_work_item" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "project_work_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_stage_work_item" (
    "projectId" INTEGER NOT NULL,
    "stageCode" TEXT NOT NULL,
    "workItemId" INTEGER NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "qtyPlan" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qtyActual" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "fact_stage_work_item_pkey" PRIMARY KEY ("projectId","stageCode","workItemId","yearMonth")
);

-- CreateTable
CREATE TABLE "fact_stage_milestone" (
    "projectId" INTEGER NOT NULL,
    "stageCode" TEXT NOT NULL,
    "plannedStart" TIMESTAMP(3),
    "plannedFinish" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualFinish" TIMESTAMP(3),
    "forecastDate" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "fact_stage_milestone_pkey" PRIMARY KEY ("projectId","stageCode")
);

-- CreateTable
CREATE TABLE "project_key_milestone" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "plannedDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),

    CONSTRAINT "project_key_milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_contractor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "scopeOfWork" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mergedIntoId" INTEGER,

    CONSTRAINT "dim_contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_contractor" (
    "projectId" INTEGER NOT NULL,
    "contractorId" INTEGER NOT NULL,

    CONSTRAINT "project_contractor_pkey" PRIMARY KEY ("projectId","contractorId")
);

-- CreateTable
CREATE TABLE "dim_equipment" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'cái',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "dim_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_daily_manpower" (
    "projectId" INTEGER NOT NULL,
    "contractorId" INTEGER NOT NULL,
    "workDate" DATE NOT NULL,
    "plannedHeadcount" INTEGER NOT NULL DEFAULT 0,
    "actualHeadcount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fact_daily_manpower_pkey" PRIMARY KEY ("projectId","contractorId","workDate")
);

-- CreateTable
CREATE TABLE "fact_daily_equipment_usage" (
    "projectId" INTEGER NOT NULL,
    "contractorId" INTEGER NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "workDate" DATE NOT NULL,
    "qtyPlanned" INTEGER NOT NULL DEFAULT 0,
    "qtyActual" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fact_daily_equipment_usage_pkey" PRIMARY KEY ("projectId","contractorId","equipmentId","workDate")
);

-- CreateIndex
CREATE INDEX "dim_stage_sortOrder_idx" ON "dim_stage"("sortOrder");

-- CreateIndex
CREATE INDEX "project_work_item_projectId_sortOrder_idx" ON "project_work_item"("projectId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "project_work_item_projectId_name_key" ON "project_work_item"("projectId", "name");

-- CreateIndex
CREATE INDEX "fact_stage_work_item_projectId_yearMonth_idx" ON "fact_stage_work_item"("projectId", "yearMonth");

-- CreateIndex
CREATE INDEX "project_key_milestone_projectId_sortOrder_idx" ON "project_key_milestone"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "fact_daily_manpower_projectId_workDate_idx" ON "fact_daily_manpower"("projectId", "workDate");

-- CreateIndex
CREATE INDEX "fact_daily_equipment_usage_projectId_workDate_idx" ON "fact_daily_equipment_usage"("projectId", "workDate");

-- CreateIndex: dim_project_marketCode_idx / dim_project_priority_idx KHÔNG cần tạo lại - đã có
-- sẵn từ trước (schema cũ @@index([marketCode])/@@index([priority])) và ALTER COLUMN TYPE ...
-- USING ở trên giữ nguyên index qua lần đổi kiểu String -> enum, không như DROP+ADD COLUMN.

-- CreateIndex
CREATE INDEX "fact_financial_projectId_yearMonth_isLatest_idx" ON "fact_financial"("projectId", "yearMonth", "isLatest");

-- CreateIndex
CREATE INDEX "fact_progress_monthly_projectId_yearMonth_isLatest_idx" ON "fact_progress_monthly"("projectId", "yearMonth", "isLatest");

-- 1) dim_stage phai co du lieu TRUOC khi gan FK tro vao no (goc cua loi deploy tren DB da co du lieu).
-- 7 dong lay dung tu src/data/seed/erp.ts:5-14.
INSERT INTO "dim_stage" ("code","nameVi","nameEn","sortOrder","calcMode") VALUES
  ('design','Thiết kế','Design',1,'manual'),
  ('shop','Shop Drawing','Shop Drawing',2,'volume'),
  ('procurement','Vật tư','Materials',3,'volume'),
  ('fabrication','Gia công','Fabrication',4,'volume'),
  ('transport','Vận chuyển','Transport',5,'volume'),
  ('erection','Lắp dựng','Erection',6,'volume'),
  ('handover','Nghiệm thu & Bàn giao','Handover',7,'manual')
ON CONFLICT ("code") DO NOTHING;

-- 2) Chi don phan THAT SU mo coi - co WHERE, khong xoa mu (khong co du lieu rac vi 7 ma vua INSERT o tren).
UPDATE "fact_progress_monthly" SET "bottleneckStage" = NULL
 WHERE "bottleneckStage" IS NOT NULL
   AND "bottleneckStage" NOT IN (SELECT "code" FROM "dim_stage");

DELETE FROM "fact_value_chain_progress"
 WHERE "stageCode" NOT IN (SELECT "code" FROM "dim_stage");

-- AddForeignKey
ALTER TABLE "dim_customer" ADD CONSTRAINT "dim_customer_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "dim_customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_team_kd" ADD CONSTRAINT "dim_team_kd_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "dim_team_kd"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_exchange_rate" ADD CONSTRAINT "dim_exchange_rate_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "dim_currency"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_project" ADD CONSTRAINT "dim_project_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "dim_customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_project" ADD CONSTRAINT "dim_project_teamKdId_fkey" FOREIGN KEY ("teamKdId") REFERENCES "dim_team_kd"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_project" ADD CONSTRAINT "dim_project_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "dim_currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_project_alias" ADD CONSTRAINT "dim_project_alias_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_sap_codes" ADD CONSTRAINT "project_sap_codes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_progress_monthly" ADD CONSTRAINT "fact_progress_monthly_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_progress_monthly" ADD CONSTRAINT "fact_progress_monthly_bottleneckStage_fkey" FOREIGN KEY ("bottleneckStage") REFERENCES "dim_stage"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_value_chain_progress" ADD CONSTRAINT "fact_value_chain_progress_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_value_chain_progress" ADD CONSTRAINT "fact_value_chain_progress_stageCode_fkey" FOREIGN KEY ("stageCode") REFERENCES "dim_stage"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_financial" ADD CONSTRAINT "fact_financial_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_volume" ADD CONSTRAINT "fact_volume_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_volume" ADD CONSTRAINT "fact_volume_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "dim_factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_history" ADD CONSTRAINT "project_history_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_log" ADD CONSTRAINT "alert_log_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_photos" ADD CONSTRAINT "project_photos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sap_queue" ADD CONSTRAINT "sap_queue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stage_weight" ADD CONSTRAINT "project_stage_weight_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stage_weight" ADD CONSTRAINT "project_stage_weight_stageCode_fkey" FOREIGN KEY ("stageCode") REFERENCES "dim_stage"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_work_item" ADD CONSTRAINT "project_work_item_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_stage_work_item" ADD CONSTRAINT "fact_stage_work_item_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_stage_work_item" ADD CONSTRAINT "fact_stage_work_item_stageCode_fkey" FOREIGN KEY ("stageCode") REFERENCES "dim_stage"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_stage_work_item" ADD CONSTRAINT "fact_stage_work_item_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "project_work_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_stage_milestone" ADD CONSTRAINT "fact_stage_milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_stage_milestone" ADD CONSTRAINT "fact_stage_milestone_stageCode_fkey" FOREIGN KEY ("stageCode") REFERENCES "dim_stage"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_key_milestone" ADD CONSTRAINT "project_key_milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_contractor" ADD CONSTRAINT "dim_contractor_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "dim_contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_contractor" ADD CONSTRAINT "project_contractor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_contractor" ADD CONSTRAINT "project_contractor_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "dim_contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_daily_manpower" ADD CONSTRAINT "fact_daily_manpower_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_daily_manpower" ADD CONSTRAINT "fact_daily_manpower_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "dim_contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_daily_equipment_usage" ADD CONSTRAINT "fact_daily_equipment_usage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_daily_equipment_usage" ADD CONSTRAINT "fact_daily_equipment_usage_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "dim_contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_daily_equipment_usage" ADD CONSTRAINT "fact_daily_equipment_usage_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "dim_equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bat bien append-only: moi (projectId, yearMonth) chi co DUNG 1 dong isLatest = true.
-- Prisma khong dien dat duoc index co menh de WHERE nen phai viet tay o day.
-- CANH BAO: lan `prisma migrate dev` sau co the sinh DROP INDEX cho 2 index nay.
-- Luon dung --create-only, xem SQL, xoa lenh DROP do truoc khi apply.
CREATE UNIQUE INDEX "ux_fact_progress_latest"
  ON "fact_progress_monthly" ("projectId", "yearMonth")
  WHERE "isLatest";

CREATE UNIQUE INDEX "ux_fact_financial_latest"
  ON "fact_financial" ("projectId", "yearMonth")
  WHERE "isLatest";

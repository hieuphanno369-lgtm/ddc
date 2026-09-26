-- P3C-A T4 + T5: ke hoach thiet bi theo dot (Tong SL + cac dot) va ke hoach nhan luc theo thang x ca.
-- Sinh khung bang `prisma migrate diff`, sap lai thu tu tay theo ke-hoach.md Task 2.

BEGIN;

-- 1) project_equipment_plan: them qty (SL dung trong dot), unitNo tro thanh tuy chon (dot moi
-- khong danh so tung chiec - unitNo NULL). Dong cu P3A giu unitNo, qty mac dinh 1.
ALTER TABLE "project_equipment_plan" ADD COLUMN "qty" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "project_equipment_plan" ADD CONSTRAINT "project_equipment_plan_qty_check" CHECK ("qty" >= 1);
ALTER TABLE "project_equipment_plan" ALTER COLUMN "unitNo" DROP NOT NULL;

-- 2) project_equipment_quota: tong SL moi loai thiet bi cua du an.
CREATE TABLE "project_equipment_quota" (
    "projectId" INTEGER NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "totalQty" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "project_equipment_quota_pkey" PRIMARY KEY ("projectId", "equipmentId")
);
ALTER TABLE "project_equipment_quota" ADD CONSTRAINT "project_equipment_quota_totalQty_check" CHECK ("totalQty" >= 1);
ALTER TABLE "project_equipment_quota" ADD CONSTRAINT "project_equipment_quota_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_equipment_quota" ADD CONSTRAINT "project_equipment_quota_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "dim_equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3) Chuyen du lieu cu: moi (du an, thiet bi) dang co cac dong theo tung chiec -> 1 dong quota,
-- totalQty = so unitNo khac nhau (toi thieu 1).
INSERT INTO "project_equipment_quota" ("projectId", "equipmentId", "totalQty", "updatedAt", "updatedBy")
SELECT "projectId", "equipmentId", GREATEST(COUNT(DISTINCT "unitNo"), 1)::int, CURRENT_TIMESTAMP, 'migration'
FROM "project_equipment_plan" GROUP BY "projectId", "equipmentId";

-- 4) project_manpower_plan_month: KH nhan luc theo thang x ca. Tong thang = cong cac ca, khong luu rieng.
CREATE TABLE "project_manpower_plan_month" (
    "projectId" INTEGER NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "shiftCode" TEXT NOT NULL,
    "planned" INTEGER NOT NULL,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "project_manpower_plan_month_pkey" PRIMARY KEY ("projectId", "yearMonth", "shiftCode")
);
ALTER TABLE "project_manpower_plan_month" ADD CONSTRAINT "project_manpower_plan_month_planned_check" CHECK ("planned" >= 0);
ALTER TABLE "project_manpower_plan_month" ADD CONSTRAINT "project_manpower_plan_month_yearMonth_check" CHECK ("yearMonth" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "project_manpower_plan_month" ADD CONSTRAINT "project_manpower_plan_month_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_manpower_plan_month" ADD CONSTRAINT "project_manpower_plan_month_shiftCode_fkey" FOREIGN KEY ("shiftCode") REFERENCES "dim_shift"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5) project_shift_ratio: ty le chia ca theo du an. Khong co dong = mac dinh DEFAULT_SHIFT_RATIO.
CREATE TABLE "project_shift_ratio" (
    "projectId" INTEGER NOT NULL,
    "shiftCode" TEXT NOT NULL,
    "pct" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "project_shift_ratio_pkey" PRIMARY KEY ("projectId", "shiftCode")
);
ALTER TABLE "project_shift_ratio" ADD CONSTRAINT "project_shift_ratio_pct_check" CHECK ("pct" >= 0 AND "pct" <= 1);
ALTER TABLE "project_shift_ratio" ADD CONSTRAINT "project_shift_ratio_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_shift_ratio" ADD CONSTRAINT "project_shift_ratio_shiftCode_fkey" FOREIGN KEY ("shiftCode") REFERENCES "dim_shift"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

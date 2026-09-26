-- Revert code truoc, roi moi chay file nay.
-- Hoi phuc migration 20260927100000_p7_c2_stage_side.
-- Chay: npx prisma db execute --file prisma/rollback/20260927100000_p7_c2_stage_side.down.sql --schema prisma/schema.prisma
-- Comment trong file nay viet khong dau.
--
-- Ghi chu: KHONG xoa 7 dong trong so da chen o buoc 6 cua migration (trung bo fallback cu, vo hai).
-- Du an da tu dat Thanh quyet toan > 0% se co tong trong so ap dung DUOI 100 sau rollback nay,
-- phai sua tay lai cho dung 100 (khong tu chia lai).

BEGIN;

-- 1) Xoa du lieu tham chieu settlement va moi ma custom_% (admin da them qua man quan tri Task 8).
DELETE FROM "project_stage_weight" WHERE "stageCode" = 'settlement' OR "stageCode" LIKE 'custom\_%';
DELETE FROM "fact_value_chain_progress" WHERE "stageCode" = 'settlement' OR "stageCode" LIKE 'custom\_%';
DELETE FROM "fact_stage_work_item" WHERE "stageCode" = 'settlement' OR "stageCode" LIKE 'custom\_%';
DELETE FROM "fact_stage_milestone" WHERE "stageCode" = 'settlement' OR "stageCode" LIKE 'custom\_%';
UPDATE "fact_progress_monthly" SET "bottleneckStage" = NULL
 WHERE "bottleneckStage" = 'settlement' OR "bottleneckStage" LIKE 'custom\_%';

-- 2) Xoa dong dim_stage cua settlement va cac giai doan admin them.
DELETE FROM "dim_stage" WHERE "code" = 'settlement' OR "code" LIKE 'custom\_%';

-- 3) Tra lai 2 ten cu.
UPDATE "dim_stage" SET "nameVi" = 'Nghiệm thu & Bàn giao' WHERE "code" = 'handover';
UPDATE "dim_stage" SET "nameEn" = 'Materials' WHERE "code" = 'procurement';

-- 4) Go cot + enum moi them.
ALTER TABLE "dim_stage" DROP COLUMN "side", DROP COLUMN "isActive";
DROP TYPE "StageSide";

-- 5) Xoa dau vet migration de "migrate deploy" co the ap lai tu dau.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260927100000_p7_c2_stage_side';

COMMIT;

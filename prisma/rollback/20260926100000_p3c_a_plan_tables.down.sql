-- Revert code truoc, roi moi chay file nay.
-- Hoi phuc migration 20260926100000_p3c_a_plan_tables.
-- Chay: npx prisma db execute --file prisma/rollback/20260926100000_p3c_a_plan_tables.down.sql --schema prisma/schema.prisma
-- Comment trong file nay viet khong dau.

BEGIN;

DROP TABLE IF EXISTS "project_shift_ratio";
DROP TABLE IF EXISTS "project_manpower_plan_month";
DROP TABLE IF EXISTS "project_equipment_quota";

-- Dot khong danh so (unitNo NULL, qty = n) -> tach thanh n dong chiec 1..n de cot unitNo ve NOT NULL.
INSERT INTO "project_equipment_plan" ("projectId","equipmentId","unitNo","workItemId","plannedStart","plannedFinish","note","updatedAt","updatedBy","qty")
SELECT p."projectId", p."equipmentId", g.k, p."workItemId", p."plannedStart", p."plannedFinish", p."note", p."updatedAt", p."updatedBy", 1
FROM "project_equipment_plan" p CROSS JOIN LATERAL generate_series(2, p."qty") AS g(k)
WHERE p."unitNo" IS NULL AND p."qty" >= 2;
UPDATE "project_equipment_plan" SET "unitNo" = 1 WHERE "unitNo" IS NULL;
ALTER TABLE "project_equipment_plan" ALTER COLUMN "unitNo" SET NOT NULL;
ALTER TABLE "project_equipment_plan" DROP CONSTRAINT IF EXISTS "project_equipment_plan_qty_check";
ALTER TABLE "project_equipment_plan" DROP COLUMN "qty";

-- Xoa dau vet migration de "migrate deploy" co the ap lai tu dau.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260926100000_p3c_a_plan_tables';

COMMIT;

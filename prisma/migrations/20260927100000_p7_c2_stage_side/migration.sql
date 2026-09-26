-- P7-C2 (7.5): them cot side/isActive vao dim_stage, giai doan Thanh quyet toan (settlement),
-- sua 2 ten cho khop chu dang hien thi, va dien trong so cho MOI du an (K5, K6, K7 trong ke hoach).

-- 1) Enum ben trai/phai cua the "Chuoi gia tri quan ly du an".
CREATE TYPE "StageSide" AS ENUM ('left', 'right');

-- 2) Them cot side (mac dinh trai) + isActive (mac dinh dang dung).
ALTER TABLE "dim_stage" ADD COLUMN "side" "StageSide" NOT NULL DEFAULT 'left', ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- 3) Backfill ben phai cho 3 giai doan cu (con lai giu 'left' mac dinh).
UPDATE "dim_stage" SET "side" = 'right' WHERE "code" IN ('transport', 'erection', 'handover');

-- 4) Sua ten cho khop chu dang hien thi tren UI (K5).
UPDATE "dim_stage" SET "nameVi" = 'Nghiệm thu' WHERE "code" = 'handover';
UPDATE "dim_stage" SET "nameEn" = 'Procurement' WHERE "code" = 'procurement';

-- 5) Them giai doan Thanh quyet toan / Settlement, ben phai, sortOrder 8, manual.
INSERT INTO "dim_stage" ("code","nameVi","nameEn","sortOrder","calcMode","side","isActive")
VALUES ('settlement','Thanh quyết toán','Settlement',8,'manual','right',true)
ON CONFLICT ("code") DO NOTHING;

-- 6) Du an CHUA CO dong trong so nao -> chen bo 7 so cu (dung bo dang duoc dung ngam qua fallback
-- DEFAULT_STAGE_WEIGHTS truoc P7-C2). PHAI chay TRUOC buoc 7 (buoc 7 thay da co dong settlement thi bo qua).
INSERT INTO "project_stage_weight" ("projectId","stageCode","weightPct","applicable")
SELECT p."id", v.code, v.w, true
FROM "dim_project" p
CROSS JOIN (VALUES ('design',5),('shop',10),('procurement',10),('fabrication',40),('transport',5),('erection',27),('handover',3)) AS v(code, w)
WHERE NOT EXISTS (SELECT 1 FROM "project_stage_weight" x WHERE x."projectId" = p."id");

-- 7) MOI du an (cu lan moi vua chen o buoc 6) -> them dong Thanh quyet toan 0%, ap dung.
INSERT INTO "project_stage_weight" ("projectId","stageCode","weightPct","applicable")
SELECT p."id", 'settlement', 0, true FROM "dim_project" p
ON CONFLICT ("projectId","stageCode") DO NOTHING;

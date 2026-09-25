-- P3A vong sua 1 (QD-11, S-2): mac CT (currentAliasCode) khong duoc trung nhau, khong phan
-- biet hoa thuong. Prisma 6 khong bieu dien duoc index bieu thuc (lower(...)) trong schema.prisma
-- -> tao bang SQL tay, xem chu thich tren field Project.currentAliasCode trong schema.prisma.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "dim_project" GROUP BY lower("currentAliasCode") HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Co ma CT (currentAliasCode) trung nhau (khong phan biet hoa thuong) - phai xu ly du lieu truoc khi chay migration nay';
  END IF;
END $$;

CREATE UNIQUE INDEX "dim_project_currentAliasCode_lower_key" ON "dim_project" (lower("currentAliasCode"));

-- P3A vong sua 1 (QD-11, S-6): moi du an toi da 1 PIC (partial unique index - chi ap dung cho
-- dong roleInProject = 'PIC'). Prisma 6 khong bieu dien duoc partial index trong schema.prisma
-- -> tao bang SQL tay, xem chu thich tren model ProjectAssignment trong schema.prisma.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "project_assignments" WHERE "roleInProject" = 'PIC' GROUP BY "projectId" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Co du an dang co nhieu hon 1 PIC - phai xu ly du lieu truoc khi chay migration nay';
  END IF;
END $$;

CREATE UNIQUE INDEX "project_assignments_one_pic_key" ON "project_assignments" ("projectId") WHERE "roleInProject" = 'PIC';

COMMIT;

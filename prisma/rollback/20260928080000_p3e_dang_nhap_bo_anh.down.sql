-- Revert code truoc, roi moi chay file nay.
-- Hoi phuc migration 20260928080000_p3e_dang_nhap_bo_anh.
-- Chay: npx prisma db execute --file prisma/rollback/20260928080000_p3e_dang_nhap_bo_anh.down.sql --schema prisma/schema.prisma
-- Comment trong file nay viet khong dau.
-- Luu y: anh hien truong cu (project_photos) KHONG khoi phuc duoc, bang tao lai se rong.

BEGIN;

-- Xoa 2 bang moi cua P3E (khoa dang nhap + dat lai mat khau).
DROP TABLE IF EXISTS "auth_throttle";
DROP TABLE IF EXISTS "password_reset_token";

-- Xoa 3 cot moi cua user_roles.
ALTER TABLE "user_roles" DROP COLUMN IF EXISTS "failedLoginCount";
ALTER TABLE "user_roles" DROP COLUMN IF EXISTS "lockedAt";
ALTER TABLE "user_roles" DROP COLUMN IF EXISTS "passwordChangedAt";

-- Tao lai bang project_photos dung DDL goc (migration 20260922220000_erp_model_v2 + 20260918071457_init).
CREATE TABLE "project_photos" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_photos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_photos_projectId_yearMonth_idx" ON "project_photos"("projectId", "yearMonth");

ALTER TABLE "project_photos" ADD CONSTRAINT "project_photos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Xoa dau vet migration de "migrate deploy" co the ap lai tu dau.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260928080000_p3e_dang_nhap_bo_anh';

COMMIT;

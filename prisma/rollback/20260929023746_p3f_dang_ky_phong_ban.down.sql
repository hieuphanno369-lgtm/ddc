-- Revert code truoc, roi moi chay file nay.
-- Hoi phuc migration 20260929023746_p3f_dang_ky_phong_ban.
-- Chay: npx prisma db execute --file prisma/rollback/20260929023746_p3f_dang_ky_phong_ban.down.sql --schema prisma/schema.prisma
-- Comment trong file nay viet khong dau.
-- Luu y: dang ky dang cho (signup_request) va danh muc phong ban (dim_department) bi MAT khi hoan tac;
-- cot user_roles.departmentId cung bi xoa (mat thong tin phong ban cua tung nguoi dung).

BEGIN;

ALTER TABLE "user_roles" DROP CONSTRAINT IF EXISTS "user_roles_departmentId_fkey";
DROP INDEX IF EXISTS "user_roles_departmentId_idx";
ALTER TABLE "user_roles" DROP COLUMN IF EXISTS "departmentId";

DROP TABLE IF EXISTS "signup_request";
DROP TABLE IF EXISTS "dim_department";

-- Xoa dau vet migration de "migrate deploy" co the ap lai tu dau.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260929023746_p3f_dang_ky_phong_ban';

COMMIT;

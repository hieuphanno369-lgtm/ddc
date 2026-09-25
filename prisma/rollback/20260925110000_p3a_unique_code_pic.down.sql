-- Revert code truoc, roi moi chay file nay.
-- Hoi phuc migration 20260925110000_p3a_unique_code_pic.
-- Chay: npx prisma db execute --file prisma/rollback/20260925110000_p3a_unique_code_pic.down.sql --schema prisma/schema.prisma
-- Comment trong file nay viet khong dau.

BEGIN;

DROP INDEX IF EXISTS "project_assignments_one_pic_key";
DROP INDEX IF EXISTS "dim_project_currentAliasCode_lower_key";

-- Xoa dau vet migration de "migrate deploy" co the ap lai tu dau.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260925110000_p3a_unique_code_pic';

COMMIT;

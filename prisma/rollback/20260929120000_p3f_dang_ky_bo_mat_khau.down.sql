-- Revert code truoc, roi moi chay file nay.
-- Hoi phuc migration 20260929120000_p3f_dang_ky_bo_mat_khau.
-- Chay: npx prisma db execute --file prisma/rollback/20260929120000_p3f_dang_ky_bo_mat_khau.down.sql --schema prisma/schema.prisma
-- Comment trong file nay viet khong dau.
-- Luu y: cot passwordHash da bi xoa nen khong the khoi phuc gia tri cu. Cac dang ky dang cho bi XOA
-- (khong co mat khau thi khong bat duoc theo ma cu); nguoi dung phai dang ky lai.

BEGIN;

DELETE FROM "signup_request";
ALTER TABLE "signup_request" ADD COLUMN "passwordHash" TEXT NOT NULL;

-- Xoa dau vet migration de "migrate deploy" co the ap lai tu dau.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260929120000_p3f_dang_ky_bo_mat_khau';

COMMIT;

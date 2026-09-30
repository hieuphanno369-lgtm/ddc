-- Revert code truoc, roi moi chay file nay.
-- Hoi phuc migration 20260929165146_p4_backfill_window.
-- Chay: npx prisma db execute --file prisma/rollback/20260929165146_p4_backfill_window.down.sql --schema prisma/schema.prisma
-- Comment trong file nay viet khong dau.
-- Luu y: cac cua so nhap bu lich su (project_backfill_window) bi MAT khi hoan tac;
-- so lieu da nhap bu vao bang nhap lieu hang ngay KHONG bi xoa.

BEGIN;

DROP TABLE IF EXISTS "project_backfill_window";

COMMIT;

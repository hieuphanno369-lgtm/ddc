-- Hoi phuc migration 20260925100000_p3a_customer_review.
-- Chay: npx prisma db execute --file prisma/rollback/20260925100000_p3a_customer_review.down.sql --schema prisma/schema.prisma
-- Comment trong file nay viet khong dau.

BEGIN;

ALTER TABLE "dim_customer" DROP COLUMN "createdBy";
ALTER TABLE "dim_customer" DROP COLUMN "needsReview";

-- Xoa dau vet migration de "migrate deploy" co the ap lai tu dau.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260925100000_p3a_customer_review';

COMMIT;

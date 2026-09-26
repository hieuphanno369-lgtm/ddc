-- P3A: chu dau tu moi tao tu form vao hang cho duyet gop.
BEGIN;
ALTER TABLE "dim_customer" ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "createdBy" TEXT NOT NULL DEFAULT 'system';
COMMIT;

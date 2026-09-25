-- Hoi phuc migration 20260924150000_p2a_entry_foundation.
-- Chay: npx prisma db execute --file prisma/rollback/20260924150000_p2a_entry_foundation.down.sql --schema prisma/schema.prisma
-- Comment trong file nay viet khong dau.

BEGIN;

-- 9) Xoa nen thong bao P3B.
DROP TABLE "notify_recipient";
DROP TABLE "notify_channel";
DROP TYPE "NotifyKind";

-- 8) Xoa job_run.
DROP TABLE "job_run";

-- 7) alert_log: bo unique + index + 8 cot moi.
DROP INDEX "alert_log_notifySentAt_idx";
DROP INDEX "alert_log_projectId_dedupeKey_key";
ALTER TABLE "alert_log" DROP COLUMN "closeNote";
ALTER TABLE "alert_log" DROP COLUMN "closedBy";
ALTER TABLE "alert_log" DROP COLUMN "dedupeKey";
ALTER TABLE "alert_log" DROP COLUMN "notifyAttempts";
ALTER TABLE "alert_log" DROP COLUMN "notifyChannel";
ALTER TABLE "alert_log" DROP COLUMN "notifyError";
ALTER TABLE "alert_log" DROP COLUMN "notifySentAt";
ALTER TABLE "alert_log" DROP COLUMN "ruleCode";

-- 6) audit_log: bo note.
ALTER TABLE "audit_log" DROP COLUMN "note";

-- 5b) Khoi phuc danh muc AUD/SAR (KHONG khoi phuc duoc ty gia da xoa - du lieu lich su mat that,
-- ghi lai o day de biet ly do neu can nhap tay).
INSERT INTO "dim_currency" ("code","name") VALUES
  ('AUD','Australian Dollar'),('SAR','Saudi Riyal') ON CONFLICT DO NOTHING;

-- 5) Ty gia: bo 2 check + source.
ALTER TABLE "dim_exchange_rate" DROP CONSTRAINT "dim_exchange_rate_rate_check";
ALTER TABLE "dim_exchange_rate" DROP CONSTRAINT "dim_exchange_rate_source_check";
ALTER TABLE "dim_exchange_rate" DROP COLUMN "source";

-- 4) dim_factory: bo isActive.
ALTER TABLE "dim_factory" DROP COLUMN "isActive";

-- 2) Bo updatedAt/updatedBy o 3 bang ghi theo ngay.
ALTER TABLE "fact_volume" DROP COLUMN "updatedAt";
ALTER TABLE "fact_volume" DROP COLUMN "updatedBy";
ALTER TABLE "fact_daily_equipment_usage" DROP COLUMN "updatedAt";
ALTER TABLE "fact_daily_equipment_usage" DROP COLUMN "updatedBy";
ALTER TABLE "fact_daily_manpower" DROP COLUMN "updatedAt";
ALTER TABLE "fact_daily_manpower" DROP COLUMN "updatedBy";

-- 1) Doi ca ve lai 'afternoon' (Ca chieu).
UPDATE "dim_shift" SET "code" = 'afternoon', "nameVi" = 'Ca chiều', "nameEn" = 'Afternoon' WHERE "code" = 'evening';

-- Xoa dau vet migration de "migrate deploy" co the ap lai tu dau.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260924150000_p2a_entry_foundation';

COMMIT;

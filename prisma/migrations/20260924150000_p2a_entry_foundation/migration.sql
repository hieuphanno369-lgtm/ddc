-- P2A: nen nhap lieu moi - ca toi, khu vuc SX, ty gia, canh bao, job_run, nen thong bao P3B.
-- Sinh khung bang `prisma migrate diff`, sap lai thu tu tay theo ke-hoach.md Task 1.2.

BEGIN;

-- 1) Ca lam viec: doi 'afternoon' -> 'evening' (Ca toi). FK fact_daily_manpower co
-- ON UPDATE CASCADE nen moi dong da co tu doi theo, khong can UPDATE rieng bang con.
UPDATE "dim_shift" SET "code" = 'evening', "nameVi" = 'Ca tối', "nameEn" = 'Evening' WHERE "code" = 'afternoon';

-- 2) updatedAt/updatedBy cho 3 bang ghi theo NGAY (sua ngay cu phai biet ai/luc nao sua).
ALTER TABLE "fact_daily_manpower" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedBy" TEXT NOT NULL DEFAULT 'system';

ALTER TABLE "fact_daily_equipment_usage" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedBy" TEXT NOT NULL DEFAULT 'system';

ALTER TABLE "fact_volume" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedBy" TEXT NOT NULL DEFAULT 'system';

-- 4) Khu vuc san xuat co the ngung dung (khong xoa - FK Restrict tu du an).
ALTER TABLE "dim_factory" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- 5) Ty gia: nguon 'vcb' | 'manual' + rang buoc du lieu.
ALTER TABLE "dim_exchange_rate" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "dim_exchange_rate" ADD CONSTRAINT "dim_exchange_rate_source_check" CHECK ("source" IN ('vcb','manual'));
ALTER TABLE "dim_exchange_rate" ADD CONSTRAINT "dim_exchange_rate_rate_check" CHECK ("rateToVnd" > 0);

-- 5b) Q8=a: gio tien te ngoai VND chi con USD/EUR - go AUD/SAR khoi danh muc (khong du an nao dung).
DELETE FROM "dim_exchange_rate" WHERE "currencyCode" IN ('AUD','SAR');
DELETE FROM "dim_currency" c WHERE c."code" IN ('AUD','SAR')
  AND NOT EXISTS (SELECT 1 FROM "dim_project" p WHERE p."currencyCode" = c."code");

-- 6) audit_log: ly do khi sua so DA CO cua ngay cu (Q2).
ALTER TABLE "audit_log" ADD COLUMN     "note" TEXT NOT NULL DEFAULT '';

-- 7) alert_log: ma luat + khoa chong trung + truong nen thong bao P3B.
ALTER TABLE "alert_log" ADD COLUMN     "closeNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "closedBy" TEXT,
ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "notifyAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notifyChannel" TEXT,
ADD COLUMN     "notifyError" TEXT,
ADD COLUMN     "notifySentAt" TIMESTAMP(3),
ADD COLUMN     "ruleCode" TEXT;

-- Backfill ruleCode cho alert seed cu (dedupeKey de NULL - khong vuong unique vi Postgres coi
-- nhieu NULL la khac nhau).
UPDATE "alert_log" SET "ruleCode" = CASE
  WHEN "ruleTriggered" LIKE 'SPI <%' THEN 'spi_low'
  WHEN "ruleTriggered" LIKE 'CPI <%' THEN 'cpi_low'
  WHEN "ruleTriggered" LIKE 'Nguy cơ phạt%' THEN 'penalty_risk'
  WHEN "ruleTriggered" LIKE 'Đã quá mốc%' THEN 'penalty_overdue'
  ELSE NULL END;

CREATE UNIQUE INDEX "alert_log_projectId_dedupeKey_key" ON "alert_log"("projectId", "dedupeKey");
CREATE INDEX "alert_log_notifySentAt_idx" ON "alert_log"("notifySentAt");

-- 8) job_run: nhat ky chay job dinh ky (ty gia, canh bao hang ngay).
CREATE TABLE "job_run" (
    "id" SERIAL NOT NULL,
    "jobName" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "startedBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "job_run_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "job_run_jobName_startedAt_idx" ON "job_run"("jobName", "startedAt");
ALTER TABLE "job_run" ADD CONSTRAINT "job_run_status_check" CHECK ("status" IN ('running','ok','error'));

-- 9) Nen thong bao cho P3B: kenh + nguoi nhan. Bi mat (webhook URL/mat khau SMTP) chi nam trong
-- secretEnc (AES-256-GCM), UI chi thay secretHint.
CREATE TYPE "NotifyKind" AS ENUM ('webhook', 'email');

CREATE TABLE "notify_channel" (
    "id" SERIAL NOT NULL,
    "kind" "NotifyKind" NOT NULL,
    "name" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "minSeverity" "AlertType" NOT NULL DEFAULT 'Red',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "secretEnc" TEXT,
    "secretHint" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "notify_channel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notify_recipient" (
    "id" SERIAL NOT NULL,
    "channelId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "minSeverity" "AlertType" NOT NULL DEFAULT 'Red',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notify_recipient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "notify_recipient_channelId_email_key" ON "notify_recipient"("channelId", "email");
ALTER TABLE "notify_recipient" ADD CONSTRAINT "notify_recipient_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "notify_channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

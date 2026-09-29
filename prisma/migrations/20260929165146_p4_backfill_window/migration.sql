-- CreateTable
CREATE TABLE "project_backfill_window" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "note" TEXT NOT NULL,
    "enabledBy" TEXT NOT NULL,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "disabledBy" TEXT,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "project_backfill_window_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_backfill_window_projectId_disabledAt_idx" ON "project_backfill_window"("projectId", "disabledAt");

-- AddForeignKey
ALTER TABLE "project_backfill_window" ADD CONSTRAINT "project_backfill_window_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dim_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

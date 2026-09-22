-- CreateTable
CREATE TABLE "dim_customer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mergedIntoId" INTEGER,

    CONSTRAINT "dim_customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_team_kd" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "picName" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mergedIntoId" INTEGER,

    CONSTRAINT "dim_team_kd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_factory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "capacityTonPerYear" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "dim_factory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_currency" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "dim_currency_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "dim_exchange_rate" (
    "currencyCode" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "rateToVnd" DOUBLE PRECISION NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "dim_exchange_rate_pkey" PRIMARY KEY ("currencyCode","yearMonth")
);

-- CreateTable
CREATE TABLE "dim_project" (
    "id" SERIAL NOT NULL,
    "masterCode" TEXT NOT NULL,
    "currentAliasCode" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "teamKdId" INTEGER NOT NULL,
    "marketCode" TEXT NOT NULL,
    "projectType" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "contractValue" DOUBLE PRECISION NOT NULL,
    "tonnage" DOUBLE PRECISION NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "contractDate" TIMESTAMP(3),
    "plannedStartDate" TIMESTAMP(3),
    "plannedFinishDate" TIMESTAMP(3),
    "committedHandoverDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualFinishDate" TIMESTAMP(3),
    "penaltyValue" DOUBLE PRECISION,
    "penalized" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "dim_project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_project_alias" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "aliasCode" TEXT NOT NULL,
    "aliasType" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,

    CONSTRAINT "dim_project_alias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_sap_codes" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "sapCode" TEXT NOT NULL,
    "sourceDocType" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedBy" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "project_sap_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_assignments" (
    "projectId" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    "roleInProject" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_assignments_pkey" PRIMARY KEY ("projectId","userEmail")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "passwordHash" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL,
    "canViewFinance" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "fact_progress_monthly" (
    "projectId" INTEGER NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "pctPlan" DOUBLE PRECISION NOT NULL,
    "pctActual" DOUBLE PRECISION NOT NULL,
    "actualStartDate" TIMESTAMP(3),
    "actualFinishDate" TIMESTAMP(3),
    "bac" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pv" DOUBLE PRECISION NOT NULL,
    "ev" DOUBLE PRECISION NOT NULL,
    "ac" DOUBLE PRECISION NOT NULL,
    "spi" DOUBLE PRECISION,
    "cpi" DOUBLE PRECISION,
    "bottleneckStage" TEXT,
    "equipmentPlanned" INTEGER NOT NULL,
    "equipmentActual" INTEGER NOT NULL,
    "snapshotLockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "changedBy" TEXT NOT NULL DEFAULT '',
    "changedAt" TIMESTAMP(3),
    "changeNote" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "fact_progress_monthly_pkey" PRIMARY KEY ("projectId","yearMonth")
);

-- CreateTable
CREATE TABLE "fact_value_chain_progress" (
    "projectId" INTEGER NOT NULL,
    "stageCode" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "pctComplete" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "fact_value_chain_progress_pkey" PRIMARY KEY ("projectId","stageCode","yearMonth")
);

-- CreateTable
CREATE TABLE "fact_financial" (
    "projectId" INTEGER NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "revenuePeriod" DOUBLE PRECISION NOT NULL,
    "revenueCumulative" DOUBLE PRECISION NOT NULL,
    "costActualPeriod" DOUBLE PRECISION NOT NULL,
    "costActualCumulative" DOUBLE PRECISION NOT NULL,
    "grossProfit" DOUBLE PRECISION NOT NULL,
    "grossMarginPct" DOUBLE PRECISION NOT NULL,
    "backlog" DOUBLE PRECISION NOT NULL,
    "arCollected" DOUBLE PRECISION NOT NULL,
    "arOutstanding" DOUBLE PRECISION NOT NULL,
    "arOverdue" DOUBLE PRECISION NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "changedBy" TEXT NOT NULL DEFAULT '',
    "changedAt" TIMESTAMP(3),
    "changeNote" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "fact_financial_pkey" PRIMARY KEY ("projectId","yearMonth")
);

-- CreateTable
CREATE TABLE "fact_volume" (
    "projectId" INTEGER NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "factoryId" INTEGER NOT NULL,
    "tonnageProcessed" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "fact_volume_pkey" PRIMARY KEY ("projectId","yearMonth","factoryId")
);

-- CreateTable
CREATE TABLE "project_history" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "by" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "project_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_log" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "alertType" TEXT NOT NULL,
    "ruleTriggered" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "owner" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT '',
    "deadline" TEXT NOT NULL,

    CONSTRAINT "alert_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "sap_queue" (
    "id" SERIAL NOT NULL,
    "sapCode" TEXT NOT NULL,
    "sourceDocType" TEXT NOT NULL,
    "projectNameHint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "projectId" INTEGER,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sap_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" SERIAL NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dim_project_masterCode_key" ON "dim_project"("masterCode");

-- CreateIndex
CREATE INDEX "dim_project_teamKdId_idx" ON "dim_project"("teamKdId");

-- CreateIndex
CREATE INDEX "dim_project_marketCode_idx" ON "dim_project"("marketCode");

-- CreateIndex
CREATE INDEX "dim_project_priority_idx" ON "dim_project"("priority");

-- CreateIndex
CREATE INDEX "dim_project_alias_projectId_idx" ON "dim_project_alias"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_sap_codes_sapCode_key" ON "project_sap_codes"("sapCode");

-- CreateIndex
CREATE INDEX "project_sap_codes_projectId_idx" ON "project_sap_codes"("projectId");

-- CreateIndex
CREATE INDEX "project_assignments_userEmail_idx" ON "project_assignments"("userEmail");

-- CreateIndex
CREATE INDEX "fact_progress_monthly_yearMonth_projectId_idx" ON "fact_progress_monthly"("yearMonth", "projectId");

-- CreateIndex
CREATE INDEX "fact_financial_yearMonth_projectId_idx" ON "fact_financial"("yearMonth", "projectId");

-- CreateIndex
CREATE INDEX "fact_volume_yearMonth_projectId_idx" ON "fact_volume"("yearMonth", "projectId");

-- CreateIndex
CREATE INDEX "project_history_projectId_idx" ON "project_history"("projectId");

-- CreateIndex
CREATE INDEX "alert_log_projectId_idx" ON "alert_log"("projectId");

-- CreateIndex
CREATE INDEX "project_photos_projectId_yearMonth_idx" ON "project_photos"("projectId", "yearMonth");

-- CreateIndex
CREATE INDEX "activity_log_createdAt_idx" ON "activity_log"("createdAt");

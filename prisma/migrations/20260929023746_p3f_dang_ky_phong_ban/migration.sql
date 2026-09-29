-- AlterTable
ALTER TABLE "user_roles" ADD COLUMN     "departmentId" INTEGER;

-- CreateTable
CREATE TABLE "dim_department" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "dim_department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signup_request" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" INTEGER,
    "passwordHash" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'vi',
    "requestIp" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signup_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dim_department_name_key" ON "dim_department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "signup_request_email_key" ON "signup_request"("email");

-- CreateIndex
CREATE INDEX "signup_request_createdAt_idx" ON "signup_request"("createdAt");

-- CreateIndex
CREATE INDEX "user_roles_departmentId_idx" ON "user_roles"("departmentId");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "dim_department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signup_request" ADD CONSTRAINT "signup_request_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "dim_department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

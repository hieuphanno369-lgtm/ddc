-- P3E: dang nhap an toan (khoa sau 5 lan sai, dat lai mat khau qua email) + bo bang anh hien truong.
-- DropForeignKey
ALTER TABLE "project_photos" DROP CONSTRAINT "project_photos_projectId_fkey";

-- AlterTable
ALTER TABLE "user_roles" ADD COLUMN     "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "project_photos";

-- CreateTable
CREATE TABLE "password_reset_token" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestIp" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "password_reset_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_throttle" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_throttle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_token_tokenHash_key" ON "password_reset_token"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_token_email_idx" ON "password_reset_token"("email");

-- CreateIndex
CREATE INDEX "auth_throttle_kind_key_createdAt_idx" ON "auth_throttle"("kind", "key", "createdAt");

-- CreateIndex
CREATE INDEX "auth_throttle_createdAt_idx" ON "auth_throttle"("createdAt");

-- AddForeignKey
ALTER TABLE "password_reset_token" ADD CONSTRAINT "password_reset_token_email_fkey" FOREIGN KEY ("email") REFERENCES "user_roles"("email") ON DELETE CASCADE ON UPDATE CASCADE;

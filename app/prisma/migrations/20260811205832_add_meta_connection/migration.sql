-- CreateEnum
CREATE TYPE "MetaConnectionStatus" AS ENUM ('ACTIVA', 'EXPIRADA', 'REVOCADA');

-- CreateEnum
CREATE TYPE "MetaTokenType" AS ENUM ('USER', 'SYSTEM_USER');

-- CreateTable
CREATE TABLE "meta_connections" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "metaBusinessId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "pageId" TEXT,
    "whatsappBusinessAccountId" TEXT,
    "instagramActorId" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "tokenType" "MetaTokenType" NOT NULL DEFAULT 'USER',
    "status" "MetaConnectionStatus" NOT NULL DEFAULT 'ACTIVA',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectedByUserId" TEXT,

    CONSTRAINT "meta_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meta_connections_organizationId_idx" ON "meta_connections"("organizationId");

-- AddForeignKey
ALTER TABLE "meta_connections" ADD CONSTRAINT "meta_connections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

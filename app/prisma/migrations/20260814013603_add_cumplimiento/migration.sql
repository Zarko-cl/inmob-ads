-- CreateEnum
CREATE TYPE "SeveridadHallazgo" AS ENUM ('BLOQUEA', 'ADVIERTE');

-- CreateEnum
CREATE TYPE "NormaCumplimiento" AS ENUM ('META_AD_STANDARDS', 'LEY_19496', 'LEY_21719', 'REQUISITOS_TECNICOS');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "dataRetentionMonths" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "privacyPolicyUrl" TEXT;

-- CreateTable
CREATE TABLE "compliance_checks" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "norma" "NormaCumplimiento" NOT NULL,
    "severidad" "SeveridadHallazgo" NOT NULL,
    "mensaje" TEXT NOT NULL,
    "aprobado" BOOLEAN NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compliance_checks_campaignId_idx" ON "compliance_checks"("campaignId");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "CampaignObjective" AS ENUM ('TRAFICO', 'INTERACCION', 'LEADS', 'VENTAS');

-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('DIARIO', 'TOTAL');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('BORRADOR', 'EN_META', 'ERROR');

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "metaConnectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" "CampaignObjective" NOT NULL,
    "budgetType" "BudgetType" NOT NULL,
    "budgetAmountClp" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "status" "CampaignStatus" NOT NULL DEFAULT 'BORRADOR',
    "metaCampaignId" TEXT,
    "errorMessage" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_sets" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'BORRADOR',
    "metaAdSetId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaigns_organizationId_idx" ON "campaigns"("organizationId");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_metaConnectionId_fkey" FOREIGN KEY ("metaConnectionId") REFERENCES "meta_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_sets" ADD CONSTRAINT "ad_sets_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

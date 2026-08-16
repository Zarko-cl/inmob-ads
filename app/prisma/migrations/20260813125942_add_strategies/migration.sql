-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "strategyId" TEXT;

-- CreateTable
CREATE TABLE "strategies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT,
    "name" TEXT NOT NULL,
    "monthlyBudgetClp" INTEGER NOT NULL,
    "nivel" INTEGER NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strategies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "strategies_organizationId_idx" ON "strategies"("organizationId");

-- CreateIndex
CREATE INDEX "campaigns_strategyId_idx" ON "campaigns"("strategyId");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

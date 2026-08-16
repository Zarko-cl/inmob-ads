-- AlterTable
ALTER TABLE "ad_sets" ADD COLUMN     "effectiveStatus" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "effectiveStatus" TEXT,
ADD COLUMN     "issuesInfo" JSONB,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "effectiveStatus" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "meta_connections" ADD COLUMN     "apiAccessTier" TEXT,
ADD COLUMN     "apiUsageAt" TIMESTAMP(3),
ADD COLUMN     "apiUsagePercent" INTEGER;

-- AlterTable
ALTER TABLE "ad_sets" ADD COLUMN     "dailyBudgetClp" INTEGER;

-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "creativeMediaId" TEXT;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_creativeMediaId_fkey" FOREIGN KEY ("creativeMediaId") REFERENCES "property_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

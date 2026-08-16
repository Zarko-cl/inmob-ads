-- CreateEnum
CREATE TYPE "TargetingMode" AS ENUM ('MANUAL', 'AUTOMATICO');

-- AlterTable
ALTER TABLE "ad_sets" ADD COLUMN     "specialAdCategoryActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "targetingJson" JSONB,
ADD COLUMN     "targetingMode" "TargetingMode" NOT NULL DEFAULT 'MANUAL';

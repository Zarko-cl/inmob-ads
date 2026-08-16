-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('LANDING_SITIO_WEB', 'FORMULARIO_INSTANTANEO', 'WHATSAPP', 'INSTAGRAM_MESSENGER');

-- AlterTable
ALTER TABLE "ad_sets" ADD COLUMN     "destinationType" TEXT;

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "campaignType" "CampaignType" NOT NULL DEFAULT 'LANDING_SITIO_WEB',
ADD COLUMN     "destinationUrl" TEXT;

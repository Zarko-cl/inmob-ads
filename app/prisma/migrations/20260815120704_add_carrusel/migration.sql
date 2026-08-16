-- CreateEnum
CREATE TYPE "AdFormat" AS ENUM ('IMAGEN_UNICA', 'CARRUSEL');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "adFormat" "AdFormat" NOT NULL DEFAULT 'IMAGEN_UNICA';

-- CreateTable
CREATE TABLE "carousel_cards" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "propertyMediaId" TEXT NOT NULL,
    "headline" TEXT,
    "description" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "carousel_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "carousel_cards_campaignId_idx" ON "carousel_cards"("campaignId");

-- AddForeignKey
ALTER TABLE "carousel_cards" ADD CONSTRAINT "carousel_cards_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carousel_cards" ADD CONSTRAINT "carousel_cards_propertyMediaId_fkey" FOREIGN KEY ("propertyMediaId") REFERENCES "property_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

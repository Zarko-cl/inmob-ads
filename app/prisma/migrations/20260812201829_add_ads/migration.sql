-- CreateTable
CREATE TABLE "ads" (
    "id" TEXT NOT NULL,
    "adSetId" TEXT NOT NULL,
    "copyVariantId" TEXT,
    "metaAdId" TEXT,
    "metaCreativeId" TEXT,
    "metaImageHash" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'BORRADOR',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ads_adSetId_idx" ON "ads"("adSetId");

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "ad_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_copyVariantId_fkey" FOREIGN KEY ("copyVariantId") REFERENCES "copy_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

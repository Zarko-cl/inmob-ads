-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "creativeMediaId" TEXT;

-- CreateTable
CREATE TABLE "property_media" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "contentType" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_media_propertyId_idx" ON "property_media"("propertyId");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_creativeMediaId_fkey" FOREIGN KEY ("creativeMediaId") REFERENCES "property_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

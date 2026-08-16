-- CreateEnum
CREATE TYPE "CopyGeneratedBy" AS ENUM ('IA', 'MANUAL');

-- CreateTable
CREATE TABLE "copy_variants" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "primaryText" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "description" TEXT,
    "generatedBy" "CopyGeneratedBy" NOT NULL DEFAULT 'IA',
    "promptVersion" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copy_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "copy_variants_campaignId_idx" ON "copy_variants"("campaignId");

-- AddForeignKey
ALTER TABLE "copy_variants" ADD CONSTRAINT "copy_variants_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

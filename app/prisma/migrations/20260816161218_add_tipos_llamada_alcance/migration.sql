-- AlterEnum
ALTER TYPE "CampaignObjective" ADD VALUE 'RECONOCIMIENTO';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CampaignType" ADD VALUE 'LLAMADA_TELEFONO';
ALTER TYPE "CampaignType" ADD VALUE 'ALCANCE_PROYECTO';

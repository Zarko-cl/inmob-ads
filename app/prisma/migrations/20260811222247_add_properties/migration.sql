-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('CASA', 'DEPARTAMENTO', 'OFICINA', 'TERRENO');

-- CreateEnum
CREATE TYPE "PropertyOperation" AS ENUM ('VENTA', 'ARRIENDO');

-- CreateEnum
CREATE TYPE "PropertyCurrency" AS ENUM ('CLP', 'UF');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('DISPONIBLE', 'RESERVADA', 'VENDIDA_ARRENDADA');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "propertyId" TEXT;

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "operation" "PropertyOperation" NOT NULL,
    "address" TEXT,
    "comuna" TEXT,
    "region" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" "PropertyCurrency" NOT NULL DEFAULT 'CLP',
    "surfaceM2" DOUBLE PRECISION,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "description" TEXT,
    "status" "PropertyStatus" NOT NULL DEFAULT 'DISPONIBLE',
    "agentName" TEXT,
    "agentEmail" TEXT,
    "agentPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "properties_organizationId_idx" ON "properties"("organizationId");

-- CreateIndex
CREATE INDEX "campaigns_propertyId_idx" ON "campaigns"("propertyId");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

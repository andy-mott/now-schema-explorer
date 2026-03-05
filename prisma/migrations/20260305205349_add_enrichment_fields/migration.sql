-- CreateEnum
CREATE TYPE "DefinitionSource" AS ENUM ('MANUAL', 'SYS_DOCUMENTATION', 'EXCEL_UPLOAD');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('DRAFT', 'VALIDATED');

-- AlterTable
ALTER TABLE "catalog_entries" ADD COLUMN     "definition_source" "DefinitionSource",
ADD COLUMN     "definition_source_detail" TEXT,
ADD COLUMN     "validated_at" TIMESTAMP(3),
ADD COLUMN     "validated_by_id" TEXT,
ADD COLUMN     "validation_status" "ValidationStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "catalog_entries_validation_status_idx" ON "catalog_entries"("validation_status");

-- AddForeignKey
ALTER TABLE "catalog_entries" ADD CONSTRAINT "catalog_entries_validated_by_id_fkey" FOREIGN KEY ("validated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

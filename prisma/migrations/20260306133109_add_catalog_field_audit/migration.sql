-- CreateTable
CREATE TABLE "catalog_field_audits" (
    "id" TEXT NOT NULL,
    "catalog_entry_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "comment" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_field_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_field_audits_catalog_entry_id_idx" ON "catalog_field_audits"("catalog_entry_id");

-- CreateIndex
CREATE INDEX "catalog_field_audits_user_id_idx" ON "catalog_field_audits"("user_id");

-- AddForeignKey
ALTER TABLE "catalog_field_audits" ADD CONSTRAINT "catalog_field_audits_catalog_entry_id_fkey" FOREIGN KEY ("catalog_entry_id") REFERENCES "catalog_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_field_audits" ADD CONSTRAINT "catalog_field_audits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

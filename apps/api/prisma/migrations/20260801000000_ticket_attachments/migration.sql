-- Adjuntos de tickets: solo se guardan metadatos en PostgreSQL.
-- El contenido binario vive en almacenamiento S3 (producción) o en el
-- directorio local de desarrollo, nunca en la base de datos.
CREATE TABLE "ticket_attachments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL,
  "file_name" TEXT NOT NULL,
  "stored_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "storage_key" TEXT NOT NULL,
  "uploaded_by_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ticket_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ticket_attachments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ticket_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ticket_attachments_report_id_created_at_idx" ON "ticket_attachments"("report_id", "created_at");

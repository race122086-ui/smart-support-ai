CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "technicians" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "technicians_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "technicians_normalized_name_key" UNIQUE ("normalized_name")
);

CREATE TABLE "reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ticket_number" INTEGER NOT NULL,
  "user_name" TEXT NOT NULL,
  "contact_email" TEXT NOT NULL,
  "contact_phone" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "technician_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reports_ticket_number_key" UNIQUE ("ticket_number"),
  CONSTRAINT "reports_priority_check" CHECK ("priority" IN ('Baja', 'Media', 'Alta')),
  CONSTRAINT "reports_status_check" CHECK ("status" IN ('Pendiente', 'En progreso', 'Resuelto')),
  CONSTRAINT "reports_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE RESTRICT
);

CREATE TABLE "report_activities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'activity',
  "message" TEXT NOT NULL,
  "actor" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_activities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "report_activities_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE
);

CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "recipient_id" TEXT,
  "message" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'info',
  "read_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profiles" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "profiles_singleton_check" CHECK ("id" = 1),
  CONSTRAINT "profiles_role_check" CHECK ("role" IN ('Administrador', 'Técnico', 'Consulta'))
);

CREATE TABLE "sla_settings" (
  "priority" TEXT NOT NULL,
  "hours" INTEGER NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sla_settings_pkey" PRIMARY KEY ("priority"),
  CONSTRAINT "sla_settings_priority_check" CHECK ("priority" IN ('Baja', 'Media', 'Alta')),
  CONSTRAINT "sla_settings_hours_check" CHECK ("hours" BETWEEN 1 AND 720)
);

CREATE TABLE "counters" (
  "name" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  CONSTRAINT "counters_pkey" PRIMARY KEY ("name"),
  CONSTRAINT "counters_value_check" CHECK ("value" >= 0)
);

CREATE TABLE "backup_imports" (
  "fingerprint" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "backup_imports_pkey" PRIMARY KEY ("fingerprint")
);

CREATE INDEX "reports_status_idx" ON "reports"("status");
CREATE INDEX "reports_priority_idx" ON "reports"("priority");
CREATE INDEX "reports_technician_id_idx" ON "reports"("technician_id");
CREATE INDEX "reports_created_at_idx" ON "reports"("created_at");
CREATE INDEX "report_activities_report_id_created_at_idx" ON "report_activities"("report_id", "created_at");
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

INSERT INTO "profiles" ("id", "name", "role") VALUES (1, 'Administrador', 'Administrador');
INSERT INTO "sla_settings" ("priority", "hours") VALUES ('Baja', 72), ('Media', 24), ('Alta', 8);
INSERT INTO "counters" ("name", "value") VALUES ('report-ticket', 0);

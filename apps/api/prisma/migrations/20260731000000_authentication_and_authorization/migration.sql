CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TECHNICIAN', 'USER');

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_email_key" UNIQUE ("email")
);

CREATE TABLE "sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "token_hash" TEXT NOT NULL,
  "csrf_hash" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sessions_token_hash_key" UNIQUE ("token_hash"),
  CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

ALTER TABLE "technicians" ADD COLUMN "user_id" UUID;
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_user_id_key" UNIQUE ("user_id");
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "reports" ADD COLUMN "created_by_id" UUID;
ALTER TABLE "reports" ADD CONSTRAINT "reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX "users_role_active_idx" ON "users"("role", "active");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");
CREATE INDEX "reports_created_by_id_idx" ON "reports"("created_by_id");

-- Los reportes históricos conservan propietario NULL porque no existe evidencia segura de su autoría.

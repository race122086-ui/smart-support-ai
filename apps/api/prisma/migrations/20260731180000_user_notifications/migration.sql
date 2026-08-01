ALTER TABLE "notifications" ADD COLUMN "report_id" UUID;
ALTER TABLE "notifications" ALTER COLUMN "recipient_id" TYPE UUID USING CASE WHEN "recipient_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN "recipient_id"::UUID ELSE NULL END;
UPDATE "notifications" SET "recipient_id" = NULL WHERE "recipient_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" WHERE "users"."id" = "notifications"."recipient_id");
DROP INDEX IF EXISTS "notifications_created_at_idx";
CREATE INDEX "notifications_recipient_id_created_at_idx" ON "notifications"("recipient_id", "created_at");
CREATE INDEX "notifications_report_id_idx" ON "notifications"("report_id");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "admin_accounts"
	ADD COLUMN "can_manage_admins" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "admin_accounts"
SET "can_manage_admins" = true
WHERE "discord_id" IN ('554465791358140417', '303118455635312641');
--> statement-breakpoint
ALTER TABLE "users"
	ADD COLUMN "application_blocked_at" timestamp with time zone,
	ADD COLUMN "application_blocked_by_discord_id" varchar;

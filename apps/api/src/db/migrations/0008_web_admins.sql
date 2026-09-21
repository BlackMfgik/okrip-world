CREATE TABLE "admin_accounts" (
	"discord_id" varchar PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "admin_accounts" ("discord_id") VALUES
	('554465791358140417'),
	('303118455635312641')
ON CONFLICT ("discord_id") DO NOTHING;

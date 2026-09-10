CREATE TYPE "public"."access_status" AS ENUM('active', 'revoked', 'banned');--> statement-breakpoint
CREATE TYPE "public"."actor_type" AS ENUM('user', 'telegram_admin', 'system', 'minecraft_server');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."command_status" AS ENUM('pending', 'leased', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."command_type" AS ENUM('whitelist_add', 'whitelist_remove', 'kick', 'ban');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" varchar NOT NULL,
	"user_id" uuid NOT NULL,
	"minecraft_identity_id" uuid NOT NULL,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"telegram_chat_id" varchar,
	"telegram_message_id" integer,
	"reviewed_by_telegram_id" varchar,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" varchar,
	"event_type" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ban_events" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"server_id" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "minecraft_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" varchar NOT NULL,
	"player_access_id" uuid NOT NULL,
	"type" "command_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "command_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "minecraft_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"username" varchar(16) NOT NULL,
	"normalized_username" varchar(16) NOT NULL,
	"verified_ownership" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "minecraft_identities_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "minecraft_identities_normalized_username_unique" UNIQUE("normalized_username")
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"token_hash" varchar PRIMARY KEY NOT NULL,
	"browser_hash" varchar NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"minecraft_identity_id" uuid NOT NULL,
	"status" "access_status" NOT NULL,
	"ban_reason" text,
	"banned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_access_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "player_access_minecraft_identity_id_unique" UNIQUE("minecraft_identity_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "telegram_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"kind" varchar NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_id" varchar NOT NULL,
	"discord_username" varchar NOT NULL,
	"discord_global_name" varchar,
	"discord_avatar" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_minecraft_identity_id_minecraft_identities_id_fk" FOREIGN KEY ("minecraft_identity_id") REFERENCES "public"."minecraft_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minecraft_commands" ADD CONSTRAINT "minecraft_commands_player_access_id_player_access_id_fk" FOREIGN KEY ("player_access_id") REFERENCES "public"."player_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minecraft_identities" ADD CONSTRAINT "minecraft_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_access" ADD CONSTRAINT "player_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_access" ADD CONSTRAINT "player_access_minecraft_identity_id_minecraft_identities_id_fk" FOREIGN KEY ("minecraft_identity_id") REFERENCES "public"."minecraft_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_jobs" ADD CONSTRAINT "telegram_jobs_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_pending_application" ON "applications" USING btree ("user_id") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "application_user_status" ON "applications" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "audit_entity" ON "audit_events" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "command_poll" ON "minecraft_commands" USING btree ("server_id","status","created_at");--> statement-breakpoint
CREATE INDEX "oauth_expiry" ON "oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "session_expiry" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_job_unique" ON "telegram_jobs" USING btree ("application_id","kind");
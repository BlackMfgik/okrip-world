ALTER TABLE "applications" ADD COLUMN "server_id" varchar DEFAULT 'vanilla' NOT NULL;
--> statement-breakpoint
ALTER TABLE "player_access" ADD COLUMN "server_id" varchar DEFAULT 'vanilla' NOT NULL;
--> statement-breakpoint
ALTER TABLE "player_access" DROP CONSTRAINT "player_access_minecraft_identity_id_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "player_access_identity_server_unique" ON "player_access" USING btree ("minecraft_identity_id", "server_id");
--> statement-breakpoint
DROP INDEX "one_pending_application";
--> statement-breakpoint
CREATE UNIQUE INDEX "one_pending_application" ON "applications" USING btree ("user_id", "server_id") WHERE status = 'pending';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_application() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM users WHERE id = NEW.user_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM minecraft_identities WHERE id = NEW.minecraft_identity_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Identity owner mismatch' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND (NEW.status <> 'pending' OR (EXISTS (SELECT 1 FROM player_access WHERE user_id = NEW.user_id AND server_id = NEW.server_id AND status <> 'revoked') AND current_setting('okrip.allow_repeat_applications', true) IS DISTINCT FROM 'on')) THEN
    RAISE EXCEPTION 'Access already decided' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id <> OLD.user_id OR NEW.minecraft_identity_id <> OLD.minecraft_identity_id OR NEW.public_id <> OLD.public_id OR NEW.number <> OLD.number OR NEW.server_id <> OLD.server_id THEN
      RAISE EXCEPTION 'Application identity immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.status <> OLD.status AND (OLD.status <> 'pending' OR NEW.status = 'pending') THEN
      RAISE EXCEPTION 'Invalid application transition' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'approved' AND OLD.status = 'pending' AND EXISTS (SELECT 1 FROM player_access WHERE user_id = NEW.user_id AND server_id = NEW.server_id AND status <> 'revoked') AND current_setting('okrip.allow_repeat_applications', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Access already decided' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_access() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM users WHERE id = NEW.user_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM minecraft_identities WHERE id = NEW.minecraft_identity_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Identity owner mismatch' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.user_id <> OLD.user_id OR
    NEW.minecraft_identity_id <> OLD.minecraft_identity_id OR
    NEW.server_id <> OLD.server_id OR
    (OLD.status = 'banned' AND NEW.status = 'active') OR
    (OLD.status = 'revoked' AND NEW.status = 'active' AND current_setting('okrip.allow_access_restoration', true) IS DISTINCT FROM 'on')
  ) THEN
    RAISE EXCEPTION 'Explicit administrative restoration required' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

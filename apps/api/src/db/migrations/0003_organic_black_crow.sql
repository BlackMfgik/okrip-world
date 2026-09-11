ALTER TABLE "applications" ADD COLUMN "number" bigserial NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_number_unique" UNIQUE("number");--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_application() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM users WHERE id = NEW.user_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM minecraft_identities WHERE id = NEW.minecraft_identity_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Identity owner mismatch' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND (NEW.status <> 'pending' OR EXISTS (SELECT 1 FROM player_access WHERE user_id = NEW.user_id)) THEN
    RAISE EXCEPTION 'Access already decided' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id <> OLD.user_id OR NEW.minecraft_identity_id <> OLD.minecraft_identity_id OR NEW.public_id <> OLD.public_id OR NEW.number <> OLD.number THEN
      RAISE EXCEPTION 'Application identity immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.status <> OLD.status AND (OLD.status <> 'pending' OR NEW.status = 'pending') THEN
      RAISE EXCEPTION 'Invalid application transition' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'approved' AND OLD.status = 'pending' AND EXISTS (SELECT 1 FROM player_access WHERE user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'Access already decided' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

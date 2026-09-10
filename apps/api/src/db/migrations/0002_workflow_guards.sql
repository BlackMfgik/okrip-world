CREATE FUNCTION guard_application() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM users WHERE id = NEW.user_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM minecraft_identities WHERE id = NEW.minecraft_identity_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Identity owner mismatch' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND (NEW.status <> 'pending' OR EXISTS (SELECT 1 FROM player_access WHERE user_id = NEW.user_id)) THEN
    RAISE EXCEPTION 'Access already decided' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id <> OLD.user_id OR NEW.minecraft_identity_id <> OLD.minecraft_identity_id OR NEW.public_id <> OLD.public_id THEN
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
--> statement-breakpoint
CREATE TRIGGER application_guard BEFORE INSERT OR UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION guard_application();
--> statement-breakpoint
CREATE FUNCTION guard_access() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM users WHERE id = NEW.user_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM minecraft_identities WHERE id = NEW.minecraft_identity_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Identity owner mismatch' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.user_id <> OLD.user_id OR NEW.minecraft_identity_id <> OLD.minecraft_identity_id OR (OLD.status IN ('banned','revoked') AND NEW.status = 'active')) THEN
    RAISE EXCEPTION 'Explicit administrative restoration required' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER access_guard BEFORE INSERT OR UPDATE ON player_access FOR EACH ROW EXECUTE FUNCTION guard_access();
--> statement-breakpoint
CREATE FUNCTION guard_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id <> OLD.user_id OR NEW.username <> OLD.username OR NEW.normalized_username <> OLD.normalized_username THEN
    RAISE EXCEPTION 'Explicit administrative nickname change required' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER identity_guard BEFORE UPDATE ON minecraft_identities FOR EACH ROW EXECUTE FUNCTION guard_identity();

CREATE OR REPLACE FUNCTION guard_access() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM users WHERE id = NEW.user_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM minecraft_identities WHERE id = NEW.minecraft_identity_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Identity owner mismatch' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.user_id <> OLD.user_id OR
    NEW.minecraft_identity_id <> OLD.minecraft_identity_id OR
    (OLD.status = 'banned' AND NEW.status = 'active') OR
    (
      OLD.status = 'revoked' AND
      NEW.status = 'active' AND
      current_setting('okrip.allow_access_restoration', true) IS DISTINCT FROM 'on'
    )
  ) THEN
    RAISE EXCEPTION 'Explicit administrative restoration required' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

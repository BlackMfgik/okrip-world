-- Адмін може змінити Minecraft-нік гравця з вебпанелі: транзакція явно вмикає okrip.allow_nickname_change.
CREATE OR REPLACE FUNCTION guard_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.user_id <> OLD.user_id OR NEW.username <> OLD.username OR NEW.normalized_username <> OLD.normalized_username)
     AND current_setting('okrip.allow_repeat_applications', true) IS DISTINCT FROM 'on'
     AND NOT (
       NEW.user_id = OLD.user_id AND
       current_setting('okrip.allow_nickname_change', true) IS NOT DISTINCT FROM 'on'
     ) THEN
    RAISE EXCEPTION 'Explicit administrative nickname change required' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

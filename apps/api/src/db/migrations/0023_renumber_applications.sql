-- Після скидання гравців (0021–0022) нумерація заявок продовжувалася зі старої послідовності.
-- Перенумеровуємо наявні заявки з 1 у порядку подання й ставимо послідовність на наступний номер.
-- Тригер guard_application забороняє змінювати number, тому на час цієї транзакції він дозволяє
-- це лише під прапорцем, а наприкінці повертається до версії з 0020. Решта перевірок діє весь час.
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
    IF NEW.user_id <> OLD.user_id OR NEW.minecraft_identity_id <> OLD.minecraft_identity_id OR NEW.public_id <> OLD.public_id OR NEW.server_id <> OLD.server_id OR (
      NEW.number <> OLD.number AND current_setting('okrip.renumber_applications', true) IS DISTINCT FROM 'on'
    ) THEN
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
SELECT set_config('okrip.renumber_applications', 'on', true);
--> statement-breakpoint
-- Спершу від'ємні номери, щоб унікальний індекс не спрацював на проміжних значеннях.
UPDATE applications SET number = -number;
--> statement-breakpoint
UPDATE applications a SET number = ordered.position
FROM (
  SELECT id, row_number() OVER (ORDER BY -number) AS position FROM applications
) ordered
WHERE ordered.id = a.id;
--> statement-breakpoint
SELECT setval(
  pg_get_serial_sequence('applications', 'number'),
  COALESCE((SELECT max(number) FROM applications), 0) + 1,
  false
);
--> statement-breakpoint
SELECT set_config('okrip.renumber_applications', 'off', true);
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

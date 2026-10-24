-- Міграція 0019 проставила server_id = 'vanilla' усім заявкам і доступам, створеним до неї,
-- хоча всі вони були на сервері заявок Amega ('modded'). Переносимо записи, створені до
-- розгортання 0019 (2026-10-23 16:58 UTC), разом із їхніми незавершеними командами.
-- Тригери guard_access і guard_application забороняють змінювати server_id, тому на час цієї
-- транзакції вони дозволяють лише перенос vanilla → modded під прапорцем, а наприкінці
-- повертаються до версії з 0019. Решта їхніх перевірок діє весь час.
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
    IF NEW.user_id <> OLD.user_id OR NEW.minecraft_identity_id <> OLD.minecraft_identity_id OR NEW.public_id <> OLD.public_id OR NEW.number <> OLD.number OR (
      NEW.server_id <> OLD.server_id AND NOT (
        OLD.server_id = 'vanilla' AND NEW.server_id = 'modded' AND
        current_setting('okrip.move_legacy_to_modded', true) = 'on'
      )
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
CREATE OR REPLACE FUNCTION guard_access() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM users WHERE id = NEW.user_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM minecraft_identities WHERE id = NEW.minecraft_identity_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Identity owner mismatch' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.user_id <> OLD.user_id OR
    NEW.minecraft_identity_id <> OLD.minecraft_identity_id OR
    (
      NEW.server_id <> OLD.server_id AND NOT (
        OLD.server_id = 'vanilla' AND NEW.server_id = 'modded' AND
        current_setting('okrip.move_legacy_to_modded', true) = 'on'
      )
    ) OR
    (OLD.status = 'banned' AND NEW.status = 'active') OR
    (OLD.status = 'revoked' AND NEW.status = 'active' AND current_setting('okrip.allow_access_restoration', true) IS DISTINCT FROM 'on')
  ) THEN
    RAISE EXCEPTION 'Explicit administrative restoration required' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
SELECT set_config('okrip.move_legacy_to_modded', 'on', true);
--> statement-breakpoint
-- Доступ не переносимо, якщо в цього Minecraft-акаунта вже є доступ на modded
-- (гравець подав нову заявку після 0019): унікальний індекс не дозволить двох.
CREATE TEMPORARY TABLE legacy_moved_access ON COMMIT DROP AS
SELECT pa.id
FROM player_access pa
WHERE pa.server_id = 'vanilla'
  AND pa.created_at < '2026-10-23 17:00:00+00'
  AND NOT EXISTS (
    SELECT 1 FROM player_access other
    WHERE other.minecraft_identity_id = pa.minecraft_identity_id AND other.server_id = 'modded'
  );
--> statement-breakpoint
UPDATE player_access SET server_id = 'modded', updated_at = now()
WHERE id IN (SELECT id FROM legacy_moved_access);
--> statement-breakpoint
-- Незавершені команди йдуть разом із доступом, щоб їх виконав плагін Amega.
UPDATE minecraft_commands SET server_id = 'modded'
WHERE server_id = 'vanilla'
  AND status <> 'completed'
  AND player_access_id IN (SELECT id FROM legacy_moved_access);
--> statement-breakpoint
-- Заявку на розгляді не переносимо, якщо в користувача вже є така на modded
-- (одна заявка на розгляді на сервер).
UPDATE applications a SET server_id = 'modded', updated_at = now()
WHERE a.server_id = 'vanilla'
  AND a.created_at < '2026-10-23 17:00:00+00'
  AND NOT (
    a.status = 'pending' AND EXISTS (
      SELECT 1 FROM applications other
      WHERE other.user_id = a.user_id AND other.server_id = 'modded' AND other.status = 'pending'
    )
  );
--> statement-breakpoint
INSERT INTO audit_events (actor_type, actor_id, event_type, entity_type, entity_id, metadata)
SELECT 'system', 'migration_0020', 'access_server_moved', 'player_access', id,
  '{"from": "vanilla", "to": "modded"}'::jsonb
FROM legacy_moved_access;
--> statement-breakpoint
SELECT set_config('okrip.move_legacy_to_modded', 'off', true);
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

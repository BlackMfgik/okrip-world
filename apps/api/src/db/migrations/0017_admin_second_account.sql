-- Адмін сайту може мати два Minecraft-акаунти на один Discord, звичайний гравець — один.
-- Унікальність user_id замінює тригер з лімітом; доступ і далі один на кожен нік.
ALTER TABLE "minecraft_identities" DROP CONSTRAINT "minecraft_identities_user_id_unique";
--> statement-breakpoint
ALTER TABLE "player_access" DROP CONSTRAINT "player_access_user_id_unique";
--> statement-breakpoint
CREATE INDEX "minecraft_identities_user_id" ON "minecraft_identities" ("user_id");
--> statement-breakpoint
CREATE INDEX "player_access_user_id" ON "player_access" ("user_id");
--> statement-breakpoint
CREATE FUNCTION guard_identity_limit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  allowed integer := 1;
BEGIN
  PERFORM 1 FROM users WHERE id = NEW.user_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM admin_accounts a JOIN users u ON u.discord_id = a.discord_id WHERE u.id = NEW.user_id) THEN
    allowed := 2;
  END IF;
  IF (SELECT count(*) FROM minecraft_identities WHERE user_id = NEW.user_id) >= allowed THEN
    RAISE EXCEPTION 'Minecraft account limit reached' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER identity_limit_guard BEFORE INSERT ON minecraft_identities FOR EACH ROW EXECUTE FUNCTION guard_identity_limit();

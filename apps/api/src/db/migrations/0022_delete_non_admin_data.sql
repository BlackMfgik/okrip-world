-- Одноразове скидання гравців на запит оператора, крок 2 з 2.
-- Видаляє всіх користувачів, крім адмінів сайту (admin_accounts), разом із їхніми
-- Minecraft-акаунтами, доступом і командами, а також усі заявки, Telegram-задачі, бани,
-- аудит, сесії та OAuth-стани. Адміни зберігають акаунт, нік і доступ.
-- Захист: якщо плагіни ще не виконали whitelist_remove з 0021 (або хтось отримав доступ
-- після неї), міграція падає, деплой зупиняється й нічого не видаляється.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM player_access pa
    JOIN users u ON u.id = pa.user_id
    WHERE u.discord_id NOT IN (SELECT discord_id FROM admin_accounts)
      AND (
        pa.status = 'active' OR EXISTS (
          SELECT 1 FROM minecraft_commands c
          WHERE c.player_access_id = pa.id AND c.status <> 'completed'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Player reset: non-admin access is still active or has unfinished commands; wait for the plugins and redeploy'
      USING ERRCODE = '55000';
  END IF;
END $$;
--> statement-breakpoint
CREATE TEMPORARY TABLE reset_deleted_users ON COMMIT DROP AS
SELECT id FROM users
WHERE discord_id NOT IN (SELECT discord_id FROM admin_accounts);
--> statement-breakpoint
DELETE FROM telegram_jobs;
--> statement-breakpoint
DELETE FROM applications;
--> statement-breakpoint
-- Виконані команди — лише історія; невиконані команди адмінів лишаються в черзі.
DELETE FROM minecraft_commands c
USING player_access pa
WHERE pa.id = c.player_access_id
  AND (c.status = 'completed' OR pa.user_id IN (SELECT id FROM reset_deleted_users));
--> statement-breakpoint
DELETE FROM player_access WHERE user_id IN (SELECT id FROM reset_deleted_users);
--> statement-breakpoint
DELETE FROM minecraft_identities WHERE user_id IN (SELECT id FROM reset_deleted_users);
--> statement-breakpoint
DELETE FROM sessions;
--> statement-breakpoint
DELETE FROM oauth_states;
--> statement-breakpoint
DELETE FROM ban_events;
--> statement-breakpoint
DELETE FROM audit_events;
--> statement-breakpoint
DELETE FROM users WHERE id IN (SELECT id FROM reset_deleted_users);

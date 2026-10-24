-- Одноразове скидання гравців на запит оператора, крок 1 з 2.
-- Знімає активний доступ з усіх, крім адмінів сайту (admin_accounts), і ставить
-- whitelist_remove у чергу відповідного сервера, щоб плагіни Vanilla й Amega самі прибрали
-- гравців із whitelist.json. Заявки на розгляді скасовуються, щоб до кроку 2 їх не схвалили.
-- Видалення даних — окрема наступна міграція, після того як плагіни виконають ці команди.
CREATE TEMPORARY TABLE reset_revoked_access ON COMMIT DROP AS
SELECT pa.id, pa.server_id, mi.username
FROM player_access pa
JOIN users u ON u.id = pa.user_id
JOIN minecraft_identities mi ON mi.id = pa.minecraft_identity_id
WHERE pa.status = 'active'
  AND u.discord_id NOT IN (SELECT discord_id FROM admin_accounts);
--> statement-breakpoint
UPDATE player_access SET status = 'revoked', updated_at = now()
WHERE id IN (SELECT id FROM reset_revoked_access);
--> statement-breakpoint
INSERT INTO minecraft_commands (server_id, player_access_id, type, payload)
SELECT server_id, id, 'whitelist_remove', jsonb_build_object('username', username)
FROM reset_revoked_access;
--> statement-breakpoint
INSERT INTO audit_events (actor_type, actor_id, event_type, entity_type, entity_id, metadata)
SELECT 'system', 'migration_0021', 'whitelist_player_removed', 'player_access', id,
  '{"source": "player_reset"}'::jsonb
FROM reset_revoked_access;
--> statement-breakpoint
UPDATE applications a SET status = 'cancelled', updated_at = now()
FROM users u
WHERE u.id = a.user_id
  AND a.status = 'pending'
  AND u.discord_id NOT IN (SELECT discord_id FROM admin_accounts);

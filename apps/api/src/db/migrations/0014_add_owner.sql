INSERT INTO "admin_accounts" ("discord_id", "can_manage_admins") VALUES
	('302714744626741248', true)
ON CONFLICT ("discord_id") DO UPDATE SET "can_manage_admins" = true;

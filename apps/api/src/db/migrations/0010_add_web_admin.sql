INSERT INTO "admin_accounts" ("discord_id") VALUES
	('876509255308541977')
ON CONFLICT ("discord_id") DO NOTHING;

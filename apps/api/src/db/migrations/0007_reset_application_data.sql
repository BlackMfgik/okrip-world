-- One-time operator-requested production data reset.
-- Preserve the schema and Drizzle's migration bookkeeping while removing all
-- user, application, access, command, Telegram, session, ban and audit data.
TRUNCATE TABLE
  "telegram_jobs",
  "minecraft_commands",
  "ban_events",
  "audit_events",
  "applications",
  "player_access",
  "minecraft_identities",
  "sessions",
  "oauth_states",
  "users"
RESTART IDENTITY CASCADE;

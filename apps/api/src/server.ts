import { cleanupExpired } from "./modules/auth/maintenance.repository.js";
import { envSchema } from "./config/env.js";
import { createDatabase } from "./db/client.js";
import { buildApp } from "./app.js";
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    parsed.error.issues.map((i) => i.path.join(".")).join(", "),
  );
  process.exit(1);
}
const env = parsed.data,
  { db, pool } = createDatabase(env.DATABASE_URL);
const { app, worker } = await buildApp(env, db);
const interval = setInterval(() => {
  void worker.tick().catch(() => app.log.warn("Telegram delivery deferred"));
}, 5000);
interval.unref();
const maintenance = setInterval(() => {
  void cleanupExpired(db).catch(() => app.log.warn("Session cleanup deferred"));
}, 3600000);
maintenance.unref();
async function close() {
  clearInterval(interval);
  clearInterval(maintenance);
  await app.close();
  await pool.end();
}
process.once("SIGTERM", () => void close());
process.once("SIGINT", () => void close());
await app.listen({ port: env.PORT, host: "0.0.0.0" });

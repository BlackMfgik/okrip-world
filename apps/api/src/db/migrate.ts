import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "./client.js";
const { db, pool } = createDatabase(process.env.DATABASE_URL!);
try {
  await migrate(db, { migrationsFolder: "src/db/migrations" });
} finally {
  await pool.end();
}

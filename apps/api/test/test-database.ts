import { randomUUID } from "node:crypto";
import pg from "pg";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase, type Database } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";
export async function testDatabase(): Promise<{
  db: Database;
  close: () => Promise<void>;
}> {
  if (!process.env.TEST_DATABASE_URL) {
    const client = new PGlite();
    const db = drizzle(client, { schema });
    await migratePglite(db, { migrationsFolder: "src/db/migrations" });
    return { db: db as unknown as Database, close: () => client.close() };
  }
  const url = new URL(process.env.TEST_DATABASE_URL);
  if (!url.pathname.endsWith("_test"))
    throw new Error(
      "TEST_DATABASE_URL must name a dedicated database ending in _test",
    );
  const admin = new pg.Pool({ connectionString: url.toString() });
  const name = "okrip_test_" + randomUUID().replaceAll("-", "");
  await admin.query('CREATE DATABASE "' + name + '"');
  url.pathname = "/" + name;
  const { db, pool } = createDatabase(url.toString());
  const close = async () => {
    await pool.end();
    await admin.query('DROP DATABASE "' + name + '"');
    await admin.end();
  };
  try {
    await migrate(db, { migrationsFolder: "src/db/migrations" });
  } catch (error) {
    await close();
    throw error;
  }
  return { db, close };
}

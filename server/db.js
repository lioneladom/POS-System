import dns from "node:dns";
import pg from "pg";

const { Pool, types } = pg;

types.setTypeParser(1700, (value) => Number(value));

// Many local/dev networks do not have IPv6 reachability. Prefer IPv4 first so
// hosted Postgres endpoints that publish both AAAA and A records remain usable.
dns.setDefaultResultOrder("ipv4first");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Add it to your .env file before starting the app.");
}

const shouldUseSsl =
  /supabase\.com/i.test(process.env.DATABASE_URL) ||
  /sslmode=require/i.test(process.env.DATABASE_URL);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
});

export async function withTransaction(work) {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

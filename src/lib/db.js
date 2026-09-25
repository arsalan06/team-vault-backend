import mysql from "mysql2/promise";
import { env } from "../config/env.js";

// A pool keeps a set of open connections ready to reuse, instead of
// opening/closing a new TCP+auth handshake to MySQL on every request.
// connectionLimit caps how many run at once, protecting MySQL from
// being overwhelmed if traffic spikes.
export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionLimit: 10,
  namedPlaceholders: true, // allows :name style params instead of positional ?
  supportBigNumbers: true,
  bigNumberStrings: true, // BIGINT columns return as strings, avoiding precision loss
  timezone: "Z", // always read/write dates as UTC
});

// Runs several queries as one atomic unit. If any query inside `fn`
// throws, everything rolls back — used whenever more than one table
// must change together (e.g. creating a workspace + its owner membership).
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release(); // MUST run even on error, or the pool leaks connections
  }
}

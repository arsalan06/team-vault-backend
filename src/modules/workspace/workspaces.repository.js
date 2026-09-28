import { pool } from "../../lib/db.js";

// Every function takes an optional `db` as its last argument. Pass a
// transaction connection to run inside a transaction; otherwise the shared
// pool is used. That lets the same query function work in both situations.
//
// Columns are aliased to camelCase (storage_used AS storageUsed) so the rest
// of the app never deals with snake_case.

// ---------- workspaces ----------

export async function insertWorkspace({ id, name }, db = pool) {
  await db.execute("INSERT INTO workspaces (id, name) VALUES (:id, :name)", {
    id,
    name,
  });
}

export async function findUserById(id) {
  const [rows] = await pool.execute(
    `SELECT id, email, name, email_verified FROM users WHERE id = :id`,
    { id },
  );
  return rows[0] ?? null;
}

export async function insertUser({ id, email, name, passwordHash }) {
  await pool.execute(
    `INSERT INTO users (id, email, name, password_hash)
     VALUES (:id, :email, :name, :passwordHash)`,
    { id, email, name, passwordHash },
  );
}

export async function insertRefreshToken({ id, tokenHash, userId, expiresAt }) {
  await pool.execute(
    `INSERT INTO refresh_tokens (id, token_hash, user_id, expires_at)
     VALUES (:id, :tokenHash, :userId, :expiresAt)`,
    { id, tokenHash, userId, expiresAt },
  );
}

export async function findValidRefreshToken(tokenHash) {
  const [rows] = await pool.execute(
    `SELECT id, user_id, expires_at, revoked FROM refresh_tokens
     WHERE token_hash = :tokenHash`,
    { tokenHash },
  );
  return rows[0] ?? null;
}

export async function revokeRefreshToken(id) {
  await pool.execute(
    `UPDATE refresh_tokens SET revoked = TRUE WHERE id = :id`,
    { id },
  );
}

export async function revokeAllUserTokens(userId) {
  await pool.execute(
    `UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = :userId`,
    { userId },
  );
}

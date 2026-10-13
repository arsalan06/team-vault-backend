import { pool } from "../../lib/db.js";

// Repositories are the ONLY files allowed to contain raw SQL. Every
// query here uses named placeholders (:email) — never string-concatenate
// user input into SQL, or you open the door to SQL injection.
export async function findUserByEmail(email) {
  const [rows] = await pool.execute(
    `SELECT id, email, name, password_hash, email_verified
     FROM users WHERE email = :email`,
    { email },
  );
  return rows[0] ?? null; // explicit columns — never SELECT *, so password_hash
  // can't accidentally leak through a careless spread later
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

// Returns true only if THIS call flipped the token from active to revoked.
// The `revoked = FALSE` condition makes it atomic: if two requests race
// with the same refresh token, exactly one wins and the other sees false.
export async function revokeRefreshToken(id) {
  const [result] = await pool.execute(
    `UPDATE refresh_tokens SET revoked = TRUE
     WHERE id = :id AND revoked = FALSE`,
    { id },
  );
  return result.affectedRows === 1;
}

export async function revokeAllUserTokens(userId) {
  await pool.execute(
    `UPDATE refresh_tokens SET revoked = TRUE
     WHERE user_id = :userId AND revoked = FALSE`,
    { userId },
  );
}

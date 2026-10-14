import crypto from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { conflict, unauthorized } from "../../utils/AppError.js";
import * as repo from "./auth.repository.js";

// Service files hold business logic — the "what happens" — and call
// the repository for "how it's stored." Controllers never call the
// repository directly; they only ever call the service.

export async function registerUser({ email, name, password }) {
  const existing = await repo.findUserByEmail(email);
  if (existing) throw conflict("An account with this email already exists");

  // argon2 is a slow, memory-hard hash — deliberately expensive so
  // brute-forcing leaked hashes is impractical. Never store plain passwords.
  const passwordHash = await argon2.hash(password);
  const id = crypto.randomUUID();
  try {
    await repo.insertUser({ id, email, name, passwordHash });
  } catch (err) {
    // Two signups racing with the same email both pass the check above;
    // the UNIQUE index catches the loser, which should be a 409, not a 500.
    if (err.code === "ER_DUP_ENTRY")
      throw conflict("An account with this email already exists");
    throw err;
  }

  return { id, email, name };
}

// A real argon2 hash of a random value, computed once. Verifying against
// it when the email doesn't exist makes "unknown email" take as long as
// "wrong password" — otherwise response timing reveals registered emails.
const dummyHashPromise = argon2.hash(crypto.randomBytes(32).toString("hex"));

export async function verifyCredentials({ email, password }) {
  const user = await repo.findUserByEmail(email);
  const hash = user?.password_hash ?? (await dummyHashPromise);
  const valid = await argon2.verify(hash, password);

  // Same generic error for "no such user" and "wrong password" — this
  // stops an attacker from using the error message to discover which
  // emails are registered.
  if (!user || !valid) throw unauthorized("Invalid email or password");

  return { id: user.id, email: user.email, name: user.name };
}

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function signAccessToken(userId) {
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  });
}

// Refresh tokens are opaque random strings, NOT JWTs. We store only
// their SHA-256 hash in the DB, so a database leak alone can't be
// used to forge sessions. This also lets us revoke a specific token
// (JWTs can't be individually revoked without extra infrastructure).
export async function issueRefreshToken(userId) {
  const rawToken = crypto.randomBytes(40).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await repo.insertRefreshToken({
    id: crypto.randomUUID(),
    tokenHash,
    userId,
    expiresAt,
  });

  return rawToken; // only the raw value goes to the client, as a cookie
}

export async function rotateRefreshToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const record = await repo.findValidRefreshToken(tokenHash);

  if (!record || new Date(record.expires_at) < new Date()) {
    throw unauthorized("Session expired, please log in again");
  }

  // Rotation: revoke the used token and issue a fresh one. If the token
  // was already revoked (or another request just revoked it), it is being
  // replayed — a strong signal it was stolen. Kill every session for this
  // user so the attacker's copy dies too; the real user simply logs in again.
  const claimed = !record.revoked && (await repo.revokeRefreshToken(record.id));
  if (!claimed) {
    await repo.revokeAllUserTokens(record.user_id);
    throw unauthorized("Session expired, please log in again");
  }

  const user = await repo.findUserById(record.user_id);
  if (!user) throw unauthorized("User no longer exists");

  const newRawToken = await issueRefreshToken(user.id);
  return {
    user: { id: user.id, email: user.email, name: user.name },
    newRawToken,
  };
}

export async function logout(rawToken) {
  const tokenHash = hashToken(rawToken);
  const record = await repo.findValidRefreshToken(tokenHash);
  if (record) await repo.revokeRefreshToken(record.id);
}

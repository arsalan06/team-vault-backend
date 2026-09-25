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
  await repo.insertUser({ id, email, name, passwordHash });

  return { id, email, name };
}

export async function verifyCredentials({ email, password }) {
  const user = await repo.findUserByEmail(email);
  // Same generic error for "no such user" and "wrong password" — this
  // stops an attacker from using the error message to discover which
  // emails are registered.
  if (!user) throw unauthorized("Invalid email or password");

  const valid = await argon2.verify(user.password_hash, password);
  if (!valid) throw unauthorized("Invalid email or password");

  return user;
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
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
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
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const record = await repo.findValidRefreshToken(tokenHash);

  if (!record || record.revoked || new Date(record.expires_at) < new Date()) {
    throw unauthorized("Session expired, please log in again");
  }

  // Rotation: revoke the used token and issue a fresh one. If a stolen
  // token is ever replayed after the legitimate user already rotated it,
  // this record will show as revoked, which is a signal of token theft.
  await repo.revokeRefreshToken(record.id);
  const newRawToken = await issueRefreshToken(record.user_id);

  return { userId: record.user_id, newRawToken };
}

export async function logout(rawToken) {
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const record = await repo.findValidRefreshToken(tokenHash);
  if (record) await repo.revokeRefreshToken(record.id);
}

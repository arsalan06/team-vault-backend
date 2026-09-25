import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { unauthorized } from "../utils/AppError.js";
import { findUserById } from "../modules/auth/auth.repository.js";

// Protects routes: verifies the access token from the Authorization
// header, loads the user, and attaches it as req.user for downstream
// handlers to use. Any route that needs a logged-in user gets this
// middleware inserted before its controller.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    throw unauthorized("Missing access token");

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    throw unauthorized("Invalid or expired access token");
  }

  const user = await findUserById(payload.sub);
  if (!user) throw unauthorized("User no longer exists");

  req.user = user;
  next();
}

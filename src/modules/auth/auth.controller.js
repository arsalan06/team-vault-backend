import { env } from "../../config/env.js";
import * as authService from "./auth.service.js";
import { unauthorized } from "../../utils/AppError.js";

// Cookie settings shared by every place we set the refresh token cookie.
// clearCookie must be given the same attributes (minus maxAge) or the
// browser treats it as a different cookie and keeps the old one.
const baseCookieOptions = {
  httpOnly: true, // JavaScript in the browser can't read it — blocks XSS token theft
  secure: env.NODE_ENV === "production", // only sent over HTTPS in production
  sameSite: "lax", // blocks most cross-site request forgery
  path: "/auth", // cookie is only sent to /auth/* routes
};
const refreshCookieOptions = {
  ...baseCookieOptions,
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
};

// Controllers: read the request, call the service, shape the response.
// They contain NO business logic and NO SQL.
// Signing a user in = short-lived access token in the body, long-lived
// refresh token in an httpOnly cookie. Shared by register and login.
async function startSession(res, user) {
  const accessToken = authService.signAccessToken(user.id);
  const refreshToken = await authService.issueRefreshToken(user.id);

  res.cookie("refreshToken", refreshToken, refreshCookieOptions);
  return {
    accessToken,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

// A new account is signed in immediately, so the client doesn't need a
// second round trip (and doesn't have to hold on to the password for one).
export async function register(req, res) {
  const user = await authService.registerUser(req.body);
  res.status(201).json(await startSession(res, user));
}

export async function login(req, res) {
  const user = await authService.verifyCredentials(req.body);
  res.json(await startSession(res, user));
}

// Also returns the user, so a client restoring a session on page load
// gets everything it needs in one round trip.
export async function refresh(req, res) {
  const rawToken = req.cookies.refreshToken;
  if (!rawToken) throw unauthorized("No refresh token provided");

  let result;
  try {
    result = await authService.rotateRefreshToken(rawToken);
  } catch (err) {
    // A dead cookie is useless; clear it so the browser stops sending it.
    res.clearCookie("refreshToken", baseCookieOptions);
    throw err;
  }

  const accessToken = authService.signAccessToken(result.user.id);
  res.cookie("refreshToken", result.newRawToken, refreshCookieOptions);
  res.json({ accessToken, user: result.user });
}

export async function logout(req, res) {
  const rawToken = req.cookies.refreshToken;
  if (rawToken) await authService.logout(rawToken);
  res.clearCookie("refreshToken", baseCookieOptions);
  res.status(204).send();
}

export async function me(req, res) {
  // req.user is attached by the requireAuth middleware (below)
  res.json({ user: req.user });
}

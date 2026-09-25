import { env } from "../../config/env.js";
import * as authService from "./auth.service.js";
import { unauthorized } from "../../utils/AppError.js";

// Cookie settings shared by every place we set the refresh token cookie.
const refreshCookieOptions = {
  httpOnly: true, // JavaScript in the browser can't read it — blocks XSS token theft
  secure: env.NODE_ENV === "production", // only sent over HTTPS in production
  sameSite: "lax", // blocks most cross-site request forgery
  path: "/auth", // cookie is only sent to /auth/* routes
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
};

// Controllers: read the request, call the service, shape the response.
// They contain NO business logic and NO SQL.
export async function register(req, res) {
  const user = await authService.registerUser(req.body);
  res.status(201).json({ user });
}

export async function login(req, res) {
  const user = await authService.verifyCredentials(req.body);
  const accessToken = authService.signAccessToken(user.id);
  const refreshToken = await authService.issueRefreshToken(user.id);

  res.cookie("refreshToken", refreshToken, refreshCookieOptions);
  res.json({
    accessToken,
    user: { id: user.id, email: user.email, name: user.name },
  });
}

export async function refresh(req, res) {
  const rawToken = req.cookies.refreshToken;
  if (!rawToken) throw unauthorized("No refresh token provided");

  const { userId, newRawToken } =
    await authService.rotateRefreshToken(rawToken);
  const accessToken = authService.signAccessToken(userId);

  res.cookie("refreshToken", newRawToken, refreshCookieOptions);
  res.json({ accessToken });
}

export async function logout(req, res) {
  const rawToken = req.cookies.refreshToken;
  if (rawToken) await authService.logout(rawToken);
  res.clearCookie("refreshToken", { path: "/auth" });
  res.status(204).send();
}

export async function me(req, res) {
  // req.user is attached by the requireAuth middleware (below)
  res.json({ user: req.user });
}

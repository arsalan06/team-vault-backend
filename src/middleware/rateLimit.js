import { rateLimit } from "express-rate-limit";

// Throttles credential endpoints so passwords can't be brute-forced.
// Keyed by IP (the library default). Successful logins don't count
// against the limit, so a real user who mistypes once isn't punished.
// Note: behind a reverse proxy, set app.set("trust proxy", 1) so the
// real client IP is used instead of the proxy's.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later" },
});

// Looser limit for refresh/register — they're called more often but
// still shouldn't be hammered.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

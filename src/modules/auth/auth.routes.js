import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { loginLimiter, authLimiter } from "../../middleware/rateLimit.js";
import { registerSchema, loginSchema } from "./auth.schema.js";
import * as controller from "./auth.controller.js";

// Routes only declare URL → middleware chain → controller. No logic here.
export const authRouter = Router();

authRouter.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  controller.register,
);
authRouter.post(
  "/login",
  loginLimiter,
  validate(loginSchema),
  controller.login,
);
authRouter.post("/refresh", authLimiter, controller.refresh);
authRouter.post("/logout", controller.logout);
authRouter.get("/me", requireAuth, controller.me);

import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { registerSchema, loginSchema } from "./auth.schema.js";
import * as controller from "./auth.controller.js";

// Routes only declare URL → middleware chain → controller. No logic here.
export const authRouter = Router();

authRouter.post("/register", validate(registerSchema), controller.register);
authRouter.post("/login", validate(loginSchema), controller.login);
authRouter.post("/refresh", controller.refresh);
authRouter.post("/logout", controller.logout);
authRouter.get("/me", requireAuth, controller.me);

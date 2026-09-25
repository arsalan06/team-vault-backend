import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger.js";
import { requestId } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./modules/auth/auth.routes.js";

// This file ONLY builds and configures the app — it never calls
// app.listen(). That separation lets tests (Supertest) import this app
// and send it fake requests without opening a real network port.
export const app = express();

app.use(requestId);
app.use(helmet()); // sets security-related HTTP headers
app.use(cors({ origin: "http://localhost:5173", credentials: true })); // allow the React dev server, with cookies
app.use(express.json({ limit: "1mb" })); // parses JSON bodies into req.body
app.use(cookieParser()); // parses cookies into req.cookies
app.use(pinoHttp({ logger })); // logs every request/response automatically

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/auth", authRouter);

// Catch-all for unmatched routes — must come after all real routes.
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler must be registered LAST. Express identifies it by its
// 4-argument signature (err, req, res, next).
app.use(errorHandler);

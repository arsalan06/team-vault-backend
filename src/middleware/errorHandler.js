import { ZodError, z } from "zod";
import { logger } from "../lib/logger.js";

// Express recognizes this as an error handler because it takes 4
// arguments. Any `next(err)` call, or any thrown error inside an
// async route (Express 5 catches these automatically), lands here.
// This is the ONE place that decides what error responses look like.
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: z.flattenError(err).fieldErrors,
    });
  }

  const statusCode = err.statusCode || 500;

  if (statusCode === 500) {
    // Log full detail server-side, but never leak internals to the client.
    logger.error({ err, path: req.path }, "Unhandled error");
    return res.status(500).json({ error: "Something went wrong" });
  }

  res.status(statusCode).json({ error: err.message });
}

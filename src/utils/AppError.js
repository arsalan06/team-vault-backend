// A custom error class carrying an HTTP status code alongside the
// message. Anywhere in the app, `throw new AppError('Not found', 404)`
// gets turned into a clean JSON response by the error middleware —
// instead of every route having its own try/catch and res.status() calls.
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // marks "expected" errors vs. real bugs
  }
}

export const badRequest = (msg) => new AppError(msg, 400);
export const unauthorized = (msg = "Unauthorized") => new AppError(msg, 401);
export const forbidden = (msg = "Forbidden") => new AppError(msg, 403);
export const notFound = (msg = "Not found") => new AppError(msg, 404);
export const conflict = (msg) => new AppError(msg, 409);

import crypto from "node:crypto";

// Attaches a unique ID to every request, echoed back in the response
// header. Useful once you have logs from many requests interleaved —
// you can filter by this ID to see everything one request did.
export function requestId(req, res, next) {
  req.id = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}

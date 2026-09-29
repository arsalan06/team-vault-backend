import { badRequest } from "./AppError.js";

// Cursor pagination: instead of "page 5", the client sends back an opaque
// cursor pointing at the last row it saw. MySQL then jumps straight to that
// position using the index, so page 500 is as fast as page 1 (OFFSET
// pagination gets slower the deeper you go).
//
// The cursor holds (createdAt, id): createdAt gives the ordering, and id
// breaks ties when two rows share the same millisecond.

export function clampLimit(limit, fallback = 20, max = 100) {
  const n = Number.parseInt(limit, 10);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(n, max);
}

export function encodeCursor({ createdAt, id }) {
  const payload = JSON.stringify({ t: new Date(createdAt).toISOString(), id });
  return Buffer.from(payload).toString("base64url");
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const { t, id } = JSON.parse(Buffer.from(cursor, "base64url").toString());
    const date = new Date(t);
    if (Number.isNaN(date.getTime()) || typeof id !== "string")
      throw new Error();
    return { date, id };
  } catch {
    throw badRequest("Invalid cursor");
  }
}

// Repositories fetch limit + 1 rows. The extra row tells us whether another
// page exists without running a separate COUNT query.
export function buildPage(rows, limit, toCursorParts) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? encodeCursor(toCursorParts(items[items.length - 1]))
    : null;
  return { items, nextCursor };
}

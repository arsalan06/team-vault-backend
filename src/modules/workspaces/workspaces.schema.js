import { z } from "zod";

// Every schema wraps its pieces in { body, params, query } because that's
// the shape validate() sends to schema.parse() — see middleware/validate.js.
// Any part the route doesn't use is simply left out of the object.

const uuid = z.uuid("Must be a valid ID");

// ---------- shared param/query pieces ----------

// GET /workspaces/:id, DELETE /workspaces/:id
export const idSchema = z.object({
  params: z.object({ id: uuid }),
});

// GET /workspaces?limit=20&cursor=...
// GET /workspaces/:id/members?limit=20&cursor=...
// Reused for both, since :id is optional in one and required in the other —
// z.object with an optional key handles that without two near-duplicate schemas.
export const listSchema = z.object({
  params: z.object({ id: uuid.optional() }),
  query: z.object({
    // Coerced from a query string ("20") to a real number. Left loose here
    // (just "a positive number") because clampLimit() in utils/pagination.js
    // already enforces the actual min/max/fallback — duplicating that range
    // check in two places would let them drift out of sync.
    limit: z.coerce.number().int().positive().optional(),
    cursor: z.string().optional(),
  }),
});

// ---------- workspaces ----------

// POST /workspaces
export const createWorkspaceSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100),
  }),
});

// PATCH /workspaces/:id
export const updateSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    name: z.string().trim().min(2).max(100),
  }),
});

// ---------- invites ----------

// POST /workspaces/:id/invites
export const inviteSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    // No OWNER here by design — an invite can never mint a second owner.
    // The service still separately blocks an ADMIN inviter from setting
    // ADMIN, since that rule depends on WHO is inviting, not just the shape.
    role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
  }),
});

// POST /invites/accept
export const acceptInviteSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Token is required"),
  }),
});

// ---------- members ----------

// PATCH /workspaces/:id/members/:userId
export const changeRoleSchema = z.object({
  params: z.object({ id: uuid, userId: uuid }),
  body: z.object({
    role: z.enum(["ADMIN", "MEMBER"]), // OWNER excluded — role changes can't create a second owner
  }),
});

// DELETE /workspaces/:id/members/:userId
export const memberParamsSchema = z.object({
  params: z.object({ id: uuid, userId: uuid }),
});

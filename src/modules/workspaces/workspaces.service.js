import crypto from "node:crypto";
import { withTransaction } from "../../lib/db.js";
import { logger } from "../../lib/logger.js";
import { env } from "../../config/env.js";
import {
  badRequest,
  forbidden,
  notFound,
  conflict,
} from "../../utils/AppError.js";
import { clampLimit, decodeCursor, buildPage } from "../../utils/pagination.js";
import * as repo from "./workspaces.repository.js";

// The service is where the RULES live. The route middleware answers
// "is this person in the workspace with a role that may call this
// endpoint?". The service answers finer questions like "can an admin
// remove another admin?" because those depend on two people's roles.
//
// Ownership model (kept simple on purpose): every workspace has exactly one
// OWNER, its creator. The owner cannot be demoted, removed, or leave; they
// can delete the workspace. Transferring ownership is a good extension later.

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

// ---------- workspaces ----------

export async function createWorkspace(userId, name) {
  // Two inserts that must succeed or fail together: a workspace with no
  // owner would be unreachable forever. Hence one transaction.
  return withTransaction(async (conn) => {
    const id = crypto.randomUUID();
    await repo.insertWorkspace({ id, name }, conn);
    await repo.insertMembership(
      { id: crypto.randomUUID(), userId, workspaceId: id, role: "OWNER" },
      conn,
    );
    return { id, name, role: "OWNER" };
  });
}

export async function listUserWorkspaces(userId, { limit, cursor }) {
  const safeLimit = clampLimit(limit);
  const rows = await repo.listWorkspacesForUser(userId, {
    limit: safeLimit,
    cursor: decodeCursor(cursor),
  });
  return buildPage(rows, safeLimit, (row) => ({
    createdAt: row.joinedAt,
    id: row.membershipId,
  }));
}

export async function getWorkspace(id) {
  const workspace = await repo.findWorkspaceById(id);
  if (!workspace) throw notFound("Workspace not found");
  return workspace;
}

export async function updateWorkspace(id, { name }) {
  await repo.updateWorkspaceName(id, name);
  return getWorkspace(id);
}

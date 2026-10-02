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

export async function deleteWorkspace(id) {
  // getWorkspace throws 404 if it is already gone, so a repeated DELETE
  // doesn't quietly report success. Deleting the row takes memberships,
  // invites, files and messages with it via ON DELETE CASCADE.
  await getWorkspace(id);
  await repo.deleteWorkspaceById(id);
}

// ---------- members ----------

export async function listMembers(workspaceId, { limit, cursor }) {
  const safeLimit = clampLimit(limit);
  const rows = await repo.listMembers(workspaceId, {
    limit: safeLimit,
    cursor: decodeCursor(cursor),
  });
  return buildPage(rows, safeLimit, (row) => ({
    createdAt: row.joinedAt,
    id: row.membershipId,
  }));
}

// Only the OWNER reaches this (route middleware), so the rules left here are
// about the TARGET: in this model the owner role is immutable.
export async function changeMemberRole({
  workspaceId,
  targetUserId,
  newRole,
  actor,
}) {
  if (targetUserId === actor.userId) {
    throw badRequest("You cannot change your own role");
  }

  const target = await repo.findMembership(targetUserId, workspaceId);
  if (!target) throw notFound("Member not found");

  // Defence in depth: the schema already excludes OWNER from newRole and the
  // actor cannot be the target. This still blocks a second owner appearing
  // through some future caller that skips one of those checks.
  if (target.role === "OWNER") {
    throw forbidden("The workspace owner role cannot be changed");
  }

  await repo.updateMembershipRole(targetUserId, workspaceId, newRole);
  return { userId: targetUserId, workspaceId, role: newRole };
}

// Two different actions share one endpoint, because the URL is the same:
//   - removing someone else -> needs OWNER, or ADMIN over a plain MEMBER
//   - removing yourself      -> "leave", allowed for anyone but the owner
export async function removeMember({
  workspaceId,
  targetUserId,
  actor,
  actorUserId,
}) {
  const target = await repo.findMembership(targetUserId, workspaceId);
  if (!target) throw notFound("Member not found");

  if (target.role === "OWNER") {
    throw forbidden(
      "The workspace owner cannot be removed - delete the workspace instead",
    );
  }

  const isLeaving = targetUserId === actorUserId;
  if (!isLeaving) {
    if (actor.role === "MEMBER") {
      throw forbidden("You do not have permission to remove members");
    }
    // An admin manages members, not peers - otherwise two admins could
    // remove each other and the owner would lose control of the team.
    if (actor.role === "ADMIN" && target.role === "ADMIN") {
      throw forbidden("Only the owner can remove an admin");
    }
  }

  await repo.deleteMembership(targetUserId, workspaceId);
}

// ---------- invites ----------

export async function createInvite({ workspaceId, email, role, inviter }) {
  // The schema keeps OWNER out of `role`. This extra check depends on WHO is
  // inviting, which a schema cannot see: an admin may only add members.
  if (inviter.role === "ADMIN" && role === "ADMIN") {
    throw forbidden("Only the owner can invite admins");
  }

  if (await repo.isEmailMemberOfWorkspace(workspaceId, email)) {
    throw conflict("That person is already a member of this workspace");
  }

  // Clear stale invites for this address first, so an expired one can never
  // block a fresh invite.
  await repo.deleteExpiredInvites(workspaceId, email);

  const pending = await repo.findPendingInvite(workspaceId, email);
  if (pending) {
    throw conflict("An invite for this email address is already pending");
  }

  // Same pattern as refresh tokens in auth.service.js: the raw token is the
  // only thing that can accept the invite, and we store just its SHA-256
  // hash, so a database leak alone cannot be used to join a workspace.
  const rawToken = crypto.randomBytes(32).toString("hex");
  const invite = {
    id: crypto.randomUUID(),
    email,
    workspaceId,
    role,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  };

  await repo.insertInvite({ ...invite, tokenHash: sha256(rawToken) });

  // No mailer is wired up yet, so outside production the token goes to the
  // log to keep the flow testable. Replace this with the real email send.
  // The raw token must never be returned in the HTTP response, or anyone
  // allowed to invite could redeem it as the invited person.
  if (env.NODE_ENV !== "production") {
    logger.debug({ email, workspaceId, rawToken }, "invite token (dev only)");
  }

  return invite;
}

export async function acceptInvite(user, token) {
  const invite = await repo.findInviteByTokenHash(sha256(token));
  // One message for "no such token" and "already used", so a wrong guess
  // cannot be told apart from an invite that was already redeemed.
  if (!invite) throw notFound("Invite not found or already used");

  if (new Date(invite.expiresAt) < new Date()) {
    await repo.deleteInvite(invite.id);
    throw badRequest("This invite has expired");
  }

  // Invites are bound to an address: holding the link is not enough, you
  // must be signed in as the person it was sent to.
  if (invite.email !== user.email.toLowerCase()) {
    throw forbidden("This invite was sent to a different email address");
  }

  const existing = await repo.findMembership(user.id, invite.workspaceId);
  if (existing) {
    await repo.deleteInvite(invite.id); // it has no purpose any more
    throw conflict("You are already a member of this workspace");
  }

  // Join and consume in one transaction: a membership created while the
  // invite is still live would let the same link be redeemed twice.
  return withTransaction(async (conn) => {
    const membership = {
      id: crypto.randomUUID(),
      userId: user.id,
      workspaceId: invite.workspaceId,
      role: invite.role,
    };
    await repo.insertMembership(membership, conn);
    await repo.deleteInvite(invite.id, conn);
    return membership;
  });
}

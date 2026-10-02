import { pool } from "../../lib/db.js";

// Every function takes an optional `db` as its last argument. Pass a
// transaction connection to run inside a transaction; otherwise the shared
// pool is used. That lets the same query function work in both situations.
//
// Columns are aliased to camelCase (storage_used AS storageUsed) so the rest
// of the app never deals with snake_case.

// ---------- workspaces ----------

export async function insertWorkspace({ id, name }, db = pool) {
  await db.execute("INSERT INTO workspaces (id, name) VALUES (:id, :name)", {
    id,
    name,
  });
}

export async function findWorkspaceById(id, db = pool) {
  const [rows] = await db.execute(
    `SELECT id, name, storage_used AS storageUsed, storage_limit AS storageLimit,
            created_at AS createdAt
     FROM workspaces WHERE id = :id`,
    { id },
  );
  return rows[0] ?? null;
}

export async function updateWorkspaceName(id, name, db = pool) {
  await db.execute("UPDATE workspaces SET name = :name WHERE id = :id", {
    id,
    name,
  });
}

export async function deleteWorkspaceById(id, db = pool) {
  // ON DELETE CASCADE removes memberships, invites, and later files/messages.
  await db.execute("DELETE FROM workspaces WHERE id = :id", { id });
}

// The workspaces the user belongs to, newest membership first.
// `limit` must already be a clamped integer (see clampLimit), which is why
// it is safe to place directly in the SQL: prepared statements in mysql2
// have trouble binding LIMIT parameters, and this value never comes
// straight from the user.
export async function listWorkspacesForUser(
  userId,
  { limit, cursor },
  db = pool,
) {
  const cursorSql = cursor
    ? "AND (m.created_at, m.id) < (:cursorDate, :cursorId)"
    : "";
  const params = { userId };
  if (cursor) {
    params.cursorDate = cursor.date;
    params.cursorId = cursor.id;
  }

  const [rows] = await db.execute(
    `SELECT w.id, w.name, m.role,
            m.created_at AS joinedAt, m.id AS membershipId
     FROM memberships m
     JOIN workspaces w ON w.id = m.workspace_id
     WHERE m.user_id = :userId ${cursorSql}
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT ${limit + 1}`,
    params,
  );
  return rows;
}

// ---------- memberships ----------

export async function insertMembership(
  { id, userId, workspaceId, role },
  db = pool,
) {
  await db.execute(
    `INSERT INTO memberships (id, user_id, workspace_id, role)
     VALUES (:id, :userId, :workspaceId, :role)`,
    { id, userId, workspaceId, role },
  );
}

// Used by the requireWorkspaceRole middleware and by the service to look
// up "who is this person inside this workspace".
export async function findMembership(userId, workspaceId, db = pool) {
  const [rows] = await db.execute(
    `SELECT id, user_id AS userId, workspace_id AS workspaceId, role
     FROM memberships
     WHERE user_id = :userId AND workspace_id = :workspaceId`,
    { userId, workspaceId },
  );
  return rows[0] ?? null;
}

export async function updateMembershipRole(
  userId,
  workspaceId,
  role,
  db = pool,
) {
  await db.execute(
    `UPDATE memberships SET role = :role
     WHERE user_id = :userId AND workspace_id = :workspaceId`,
    { userId, workspaceId, role },
  );
}

export async function deleteMembership(userId, workspaceId, db = pool) {
  await db.execute(
    "DELETE FROM memberships WHERE user_id = :userId AND workspace_id = :workspaceId",
    { userId, workspaceId },
  );
}

// Members with their public profile. Explicit columns, so password_hash
// can never leak through this query.
export async function listMembers(workspaceId, { limit, cursor }, db = pool) {
  const cursorSql = cursor
    ? "AND (m.created_at, m.id) < (:cursorDate, :cursorId)"
    : "";
  const params = { workspaceId };
  if (cursor) {
    params.cursorDate = cursor.date;
    params.cursorId = cursor.id;
  }

  const [rows] = await db.execute(
    `SELECT u.id AS userId, u.name, u.email, m.role,
            m.created_at AS joinedAt, m.id AS membershipId
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     WHERE m.workspace_id = :workspaceId ${cursorSql}
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT ${limit + 1}`,
    params,
  );
  return rows;
}

export async function isEmailMemberOfWorkspace(workspaceId, email, db = pool) {
  const [rows] = await db.execute(
    `SELECT m.id FROM memberships m
     JOIN users u ON u.id = m.user_id
     WHERE m.workspace_id = :workspaceId AND u.email = :email`,
    { workspaceId, email },
  );
  return rows.length > 0;
}

// ---------- invites ----------

export async function deleteExpiredInvites(workspaceId, email, db = pool) {
  await db.execute(
    `DELETE FROM invites
     WHERE workspace_id = :workspaceId AND email = :email AND expires_at < :now`,
    { workspaceId, email, now: new Date() },
  );
}

// An invite that is still redeemable. The service calls this after
// deleteExpiredInvites, so a second invite to the same address is only
// refused while the first one is actually live.
export async function findPendingInvite(workspaceId, email, db = pool) {
  const [rows] = await db.execute(
    `SELECT id, role, expires_at AS expiresAt
     FROM invites
     WHERE workspace_id = :workspaceId AND email = :email AND expires_at >= :now`,
    { workspaceId, email, now: new Date() },
  );
  return rows[0] ?? null;
}

export async function insertInvite(
  { id, email, workspaceId, role, tokenHash, expiresAt },
  db = pool,
) {
  await db.execute(
    `INSERT INTO invites (id, email, workspace_id, role, token_hash, expires_at)
     VALUES (:id, :email, :workspaceId, :role, :tokenHash, :expiresAt)`,
    { id, email, workspaceId, role, tokenHash, expiresAt },
  );
}

export async function findInviteByTokenHash(tokenHash, db = pool) {
  const [rows] = await db.execute(
    `SELECT id, email, workspace_id AS workspaceId, role, expires_at AS expiresAt
     FROM invites WHERE token_hash = :tokenHash`,
    { tokenHash },
  );
  return rows[0] ?? null;
}

export async function deleteInvite(id, db = pool) {
  await db.execute("DELETE FROM invites WHERE id = :id", { id });
}

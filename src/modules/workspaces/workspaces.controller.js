import * as workspaceService from "./workspaces.service.js";

// Controllers only translate HTTP <-> service calls.
// By the time any of these run:
//   - requireAuth has set req.user (who is calling)
//   - validate() has cleaned req.body / req.params / req.query
//   - requireWorkspaceRole() has set req.membership (their role in THIS
//     workspace) on routes that have :id in the URL
// So the controller can trust all of them and stay tiny.

// POST /workspaces
// Any logged-in user can create a workspace and becomes its OWNER.
export async function createWorkspace(req, res) {
  const workspace = await workspaceService.createWorkspace(
    req.user.id,
    req.body.name,
  );
  res.status(201).json({ workspace });
}

// GET /workspaces?limit=20&cursor=...
// Lists only workspaces the caller belongs to (never everyone's).
export async function listMyWorkspaces(req, res) {
  const { limit, cursor } = req.query;
  const result = await workspaceService.listUserWorkspaces(req.user.id, {
    limit,
    cursor,
  });
  res.json(result); // { items: [...], nextCursor: '...' | null }
}

// GET /workspaces/:id
// Members only (enforced by middleware). We also return the caller's
// role so a client knows which buttons to show.
export async function getWorkspace(req, res) {
  const workspace = await workspaceService.getWorkspace(req.params.id);
  res.json({ workspace, role: req.membership.role });
}

// PATCH /workspaces/:id
// Owner or admin only (enforced by middleware).
export async function updateWorkspace(req, res) {
  const workspace = await workspaceService.updateWorkspace(
    req.params.id,
    req.body,
  );
  res.json({ workspace });
}

// DELETE /workspaces/:id
// Owner only (enforced by middleware). 204 = success, nothing to return.
export async function deleteWorkspace(req, res) {
  await workspaceService.deleteWorkspace(req.params.id);
  res.status(204).send();
}

// GET /workspaces/:id/members?limit=20&cursor=...
export async function listMembers(req, res) {
  const { limit, cursor } = req.query;
  const result = await workspaceService.listMembers(req.params.id, {
    limit,
    cursor,
  });
  res.json(result);
}

// POST /workspaces/:id/invites
// Owner or admin. The service creates the invite token and queues the
// email. The raw token is never returned here, only sent by email.
export async function createInvite(req, res) {
  const invite = await workspaceService.createInvite({
    workspaceId: req.params.id,
    email: req.body.email,
    role: req.body.role,
    inviter: req.membership, // service checks an admin can't invite as ADMIN, etc.
  });
  res.status(201).json({ invite });
}

// POST /invites/accept
// Not tied to a workspace ID in the URL: the token identifies the invite.
// The logged-in user's email must match the invite's email (checked in service).
export async function acceptInvite(req, res) {
  const membership = await workspaceService.acceptInvite(
    req.user,
    req.body.token,
  );
  res.status(201).json({ membership });
}

// PATCH /workspaces/:id/members/:userId
// Owner only. Changes another member's role.
export async function changeMemberRole(req, res) {
  const member = await workspaceService.changeMemberRole({
    workspaceId: req.params.id,
    targetUserId: req.params.userId,
    newRole: req.body.role,
    actor: req.membership,
  });
  res.json({ member });
}

// DELETE /workspaces/:id/members/:userId
// Owner/admin can remove others; any member can remove themselves (leave).
// The service decides, because the rules depend on both people's roles.
export async function removeMember(req, res) {
  await workspaceService.removeMember({
    workspaceId: req.params.id,
    targetUserId: req.params.userId,
    actor: req.membership,
    actorUserId: req.user.id,
  });
  res.status(204).send();
}

import { notFound, forbidden } from "../utils/AppError.js";
import { findMembership } from "../modules/workspaces/workspaces.repository.js";

// A middleware FACTORY, same pattern as validate(schema) and your earlier
// requireRole(role) example: it takes configuration (allowed roles) and
// returns the actual middleware function.
//
// Call with no arguments — requireWorkspaceRole() — to mean "any member is
// allowed", since every route under /workspaces/:id first needs to confirm
// the caller belongs to that workspace at all, before finer role checks apply.
//
// Usage:
//   requireWorkspaceRole()                 -> any member
//   requireWorkspaceRole('OWNER')          -> owner only
//   requireWorkspaceRole('OWNER', 'ADMIN') -> owner or admin
export function requireWorkspaceRole(...allowedRoles) {
  return async (req, res, next) => {
    const workspaceId = req.params.id;
    const membership = await findMembership(req.user.id, workspaceId);

    // Deliberately 404, not 403. If we said "403 Forbidden", an outsider
    // could tell the workspace exists just by getting a different error
    // than for a made-up ID. 404 makes a real workspace they can't see
    // look identical to one that doesn't exist.
    if (!membership) throw notFound("Workspace not found");

    if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
      throw forbidden("You do not have permission to do this");
    }

    // Attach it so the controller and service don't have to look it up
    // again — this is the req.membership used throughout workspaces.service.js.
    req.membership = membership;
    next();
  };
}

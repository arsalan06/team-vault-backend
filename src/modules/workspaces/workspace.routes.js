import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireWorkspaceRole } from "../../middleware/requireWorkspaceRole.js";
import * as schemas from "./workspaces.schema.js";
import * as controller from "./workspaces.controller.js";

export const workspaceRouter = Router();

// Every route below needs a logged-in user.
workspaceRouter.use(requireAuth);

workspaceRouter.post(
  "/",
  validate(schemas.createWorkspaceSchema),
  controller.createWorkspace,
);
workspaceRouter.get(
  "/",
  validate(schemas.listSchema),
  controller.listMyWorkspaces,
);

// requireWorkspaceRole(...) with no arguments = any member.
workspaceRouter.get(
  "/:id",
  validate(schemas.idSchema),
  requireWorkspaceRole(),
  controller.getWorkspace,
);
workspaceRouter.patch(
  "/:id",
  validate(schemas.updateSchema),
  requireWorkspaceRole("OWNER", "ADMIN"),
  controller.updateWorkspace,
);
workspaceRouter.delete(
  "/:id",
  validate(schemas.idSchema),
  requireWorkspaceRole("OWNER"),
  controller.deleteWorkspace,
);

workspaceRouter.get(
  "/:id/members",
  validate(schemas.listSchema),
  requireWorkspaceRole(),
  controller.listMembers,
);
workspaceRouter.post(
  "/:id/invites",
  validate(schemas.inviteSchema),
  requireWorkspaceRole("OWNER", "ADMIN"),
  controller.createInvite,
);
workspaceRouter.patch(
  "/:id/members/:userId",
  validate(schemas.changeRoleSchema),
  requireWorkspaceRole("OWNER"),
  controller.changeMemberRole,
);
workspaceRouter.delete(
  "/:id/members/:userId",
  validate(schemas.memberParamsSchema),
  requireWorkspaceRole(),
  controller.removeMember,
);

// Separate router (mounted at /invites) because the URL has no workspace ID.
export const inviteRouter = Router();
inviteRouter.post(
  "/accept",
  requireAuth,
  validate(schemas.acceptInviteSchema),
  controller.acceptInvite,
);

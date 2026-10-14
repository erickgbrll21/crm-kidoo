import type { Role } from '../types/index.js';

export const PERMISSIONS = {
  'leads.write_any': ['admin', 'manager'],
  'leads.assign': ['admin', 'manager'],
  'leads.archive': ['admin', 'manager'],
  'reports.view': ['admin', 'manager'],
  'clients.manage': ['admin', 'manager'],
  'integrations.view': ['admin', 'manager'],
  'users.manage': ['admin'],
  'settings.manage': ['admin'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export const can = (role: Role | undefined, permission: Permission) =>
  !!role && (PERMISSIONS[permission] as readonly Role[]).includes(role);

/** Closers editam apenas leads atribuídos a eles; admin e gestor editam qualquer lead. */
export const canEditLead = (user: { id: string; role: Role }, lead: { owner_id: string | null }) =>
  can(user.role, 'leads.write_any') || lead.owner_id === user.id;

export const canViewLead = (
  user: { id: string; role: Role },
  lead: { owner_id: string | null },
  closerSeesAll: boolean,
) => can(user.role, 'leads.write_any') || closerSeesAll || lead.owner_id === user.id;

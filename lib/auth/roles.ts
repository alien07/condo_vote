export const APP_ROLES = {
  ADMIN: "admin",
  COMMITTEE: "committee",
  SYSTEM_ADMIN: "system_admin",
} as const;

export type AppRole = (typeof APP_ROLES)[keyof typeof APP_ROLES];

export function isAppRole(value: string): value is AppRole {
  return Object.values(APP_ROLES).includes(value as AppRole);
}

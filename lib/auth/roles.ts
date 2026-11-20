export const APP_ROLES = {
  ADMIN: "admin",
  COMMITTEE: "committee",
  SYSTEM_ADMIN: "system_admin",
  /** Office staff: data entry only (demo feedback item 14c). */
  STAFF: "staff",
  /** Read-only auditor (item 14b). */
  AUDITOR: "auditor",
} as const;

/**
 * Not stored: added to a System Admin's roles while their temporary,
 * read-only access to the building is open (req_0011 B, D027). Page guards
 * accept it only with { readOnly: true }; the database refuses every write.
 */
export const SYSTEM_READ = "system_read";

export type AppRole = (typeof APP_ROLES)[keyof typeof APP_ROLES];

export function isAppRole(value: string): value is AppRole {
  return Object.values(APP_ROLES).includes(value as AppRole);
}

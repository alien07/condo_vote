import { getCurrentProfileWithRoles } from "@/lib/auth/permissions";

/**
 * Job roles of the person reading the help, or null when signed out.
 * Help pages are public, so this never redirects.
 */
export async function getHelpReaderRoles(): Promise<string[] | null> {
  const current = await getCurrentProfileWithRoles();

  return current ? current.roles : null;
}

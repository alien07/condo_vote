import { redirect } from "next/navigation";
import { APP_ROLES, type AppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

function hasSupabaseAuthConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export async function getCurrentProfile() {
  if (!hasSupabaseAuthConfig()) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return profile;
}

export async function getCurrentProfileWithRoles() {
  const profile = await getCurrentProfile();

  if (!profile) {
    return null;
  }

  const supabase = await createClient();
  const { data: roles, error } = await supabase
    .from("app_roles")
    .select("role")
    .eq("profile_id", profile.id)
    .order("role", { ascending: true });

  if (error) {
    throw error;
  }

  return {
    profile,
    roles: roles.map((role) => role.role),
  };
}

export async function requireProfile() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  return profile;
}

export async function requireProfileWithRoles() {
  const current = await getCurrentProfileWithRoles();

  if (!current) {
    redirect("/login");
  }

  return current;
}

export async function hasAppRole(role: AppRole) {
  const profile = await getCurrentProfile();

  if (!profile) {
    return false;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_roles")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("role", role)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function isAdmin() {
  return hasAppRole(APP_ROLES.ADMIN);
}

export async function isCommittee() {
  return hasAppRole(APP_ROLES.COMMITTEE);
}

export async function isSystemAdmin() {
  return hasAppRole(APP_ROLES.SYSTEM_ADMIN);
}

/** Signed in without the role a page needs: back home with a notice. */
export const DENIED_PATH = "/?denied=1";

// Technical settings belong to system admins (D016).
export async function requireSystemAdmin() {
  const profile = await requireProfile();

  if (!(await isSystemAdmin())) {
    redirect(DENIED_PATH);
  }

  return profile;
}

/** Admin or office staff: the data-entry admin pages (item 14c). */
export async function requireOfficeStaff() {
  const current = await requireProfileWithRoles();

  if (!current.roles.includes("admin") && !current.roles.includes("staff")) {
    redirect(DENIED_PATH);
  }

  return current.profile;
}

export async function requireAdmin() {
  const profile = await requireProfile();

  if (!(await isAdmin())) {
    redirect(DENIED_PATH);
  }

  return profile;
}

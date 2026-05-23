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

export async function requireProfile() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  return profile;
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

export async function requireAdmin() {
  const allowed = await isAdmin();

  if (!allowed) {
    redirect("/login");
  }

  return requireProfile();
}

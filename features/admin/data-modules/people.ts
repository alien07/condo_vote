import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function fetchPeopleData(supabase: SupabaseServerClient) {
  const [
    roomsResult,
    appRolesResult,
    ownersResult,
    roomOwnersResult,
    profilesResult,
    ownerLinksResult,
  ] =
    await Promise.all([
      supabase
        .from("rooms")
        .select(
          "id, room_number, floor, building, area_size, ownership_percent, active",
        )
        .order("room_number", { ascending: true }),
      supabase
        .from("app_roles")
        .select("id, profile_id, role")
        .order("role", { ascending: true }),
      supabase
        .from("owners")
        .select("id, full_name, email, phone, line_id, active, profile_id")
        .order("created_at", { ascending: false }),
      supabase
        .from("room_owners")
        .select(
          "id, ownership_role, starts_at, ends_at, status, cancelled_at, cancelled_by, rooms(id, room_number), owners(id, full_name)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select(
          "id, full_name, email, default_status, approval_status, preferred_language, created_at",
        )
        .order("created_at", { ascending: false }),
      // Recent account links for the admin to review (D024). Office staff
      // cannot read the audit log, so they get an empty list. 50 so the
      // admin changes still show on a sign-in day full of automatic links.
      supabase
        .from("audit_logs")
        .select("id, action, created_at, entity_id, details_json")
        .in("action", ["owner.profile_linked", "owner.profile_moved", "owner.profile_unlinked"])
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  if (roomsResult.error) {
    throw roomsResult.error;
  }

  if (appRolesResult.error) {
    throw appRolesResult.error;
  }

  if (ownersResult.error) {
    throw ownersResult.error;
  }

  if (roomOwnersResult.error) {
    throw roomOwnersResult.error;
  }

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  if (ownerLinksResult.error) {
    throw ownerLinksResult.error;
  }

  return {
    ownerAccountEvents: ownerLinksResult.data,
    rooms: roomsResult.data,
    appRoles: appRolesResult.data,
    owners: ownersResult.data,
    roomOwners: roomOwnersResult.data,
    profiles: profilesResult.data,
  };
}

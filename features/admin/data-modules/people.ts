import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function fetchPeopleData(supabase: SupabaseServerClient) {
  const [roomsResult, appRolesResult, ownersResult, roomOwnersResult, profilesResult] =
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
        .select("id, full_name, email, phone, line_id, active")
        .order("created_at", { ascending: false }),
      supabase
        .from("room_owners")
        .select(
          "id, ownership_role, starts_at, ends_at, rooms(id, room_number), owners(id, full_name)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select(
          "id, full_name, email, default_status, approval_status, created_at",
        )
        .order("created_at", { ascending: false }),
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

  return {
    rooms: roomsResult.data,
    appRoles: appRolesResult.data,
    owners: ownersResult.data,
    roomOwners: roomOwnersResult.data,
    profiles: profilesResult.data,
  };
}

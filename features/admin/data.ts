import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export async function getAdminDashboardData() {
  await requireAdmin();

  const supabase = await createClient();
  const [
    roomsResult,
    ownersResult,
    roomOwnersResult,
    meetingsResult,
    proxyAuthorizationsResult,
    profilesResult,
  ] =
    await Promise.all([
      supabase
        .from("rooms")
        .select(
          "id, room_number, floor, building, area_size, ownership_percent, active",
        )
        .order("room_number", { ascending: true }),
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
        .from("meetings")
        .select("id, title, description, starts_at, ends_at, status")
        .order("starts_at", { ascending: false }),
      supabase
        .from("proxy_authorizations")
        .select(
          "id, status, valid_from, valid_until, meetings(id, title), rooms(id, room_number), owners(id, full_name), profiles!proxy_authorizations_proxy_profile_id_fkey(id, full_name, email)",
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

  if (ownersResult.error) {
    throw ownersResult.error;
  }

  if (roomOwnersResult.error) {
    throw roomOwnersResult.error;
  }

  if (meetingsResult.error) {
    throw meetingsResult.error;
  }

  if (proxyAuthorizationsResult.error) {
    throw proxyAuthorizationsResult.error;
  }

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  return {
    rooms: roomsResult.data,
    owners: ownersResult.data,
    roomOwners: roomOwnersResult.data,
    meetings: meetingsResult.data,
    proxyAuthorizations: proxyAuthorizationsResult.data,
    profiles: profilesResult.data,
  };
}

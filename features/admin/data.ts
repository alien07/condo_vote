import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export async function getAdminDashboardData() {
  await requireAdmin();

  const supabase = await createClient();
  const [roomsResult, ownersResult, profilesResult] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, room_number, floor, building, area_size, ownership_percent, active")
      .order("room_number", { ascending: true }),
    supabase
      .from("owners")
      .select("id, full_name, email, phone, line_id, active")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, email, default_status, approval_status, created_at")
      .order("created_at", { ascending: false }),
  ]);

  if (roomsResult.error) {
    throw roomsResult.error;
  }

  if (ownersResult.error) {
    throw ownersResult.error;
  }

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  return {
    rooms: roomsResult.data,
    owners: ownersResult.data,
    profiles: profilesResult.data,
  };
}

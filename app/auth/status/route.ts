import { NextResponse } from "next/server";
import { getCurrentProfileWithRoles } from "@/lib/auth/permissions";

export async function GET() {
  const current = await getCurrentProfileWithRoles();

  return NextResponse.json(
    current
      ? {
          profile: {
            default_status: current.profile.default_status,
            email: current.profile.email,
            full_name: current.profile.full_name,
          },
          roles: current.roles,
        }
      : null,
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

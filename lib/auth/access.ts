import { cache } from "react";
import { redirect } from "next/navigation";
import { needsPrivacyConsent } from "@/features/privacy/service";
import { DENIED_PATH, requireProfile } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export type DelegatedRoom = {
  room_number: string;
  meeting_title: string;
  proxy_name: string;
  ends_at: string;
};

export type MemberAccess = {
  approved: boolean;
  /** Approved members and staff (admin, committee, system admin). */
  canViewResults: boolean;
  /** Approved and owner, proxy, or holds a ballot right. */
  canVote: boolean;
  ownsRoom: boolean;
  /** Own rooms a proxy holds in a meeting that is still open. */
  delegatedRooms: DelegatedRoom[];
};

const NO_ACCESS: MemberAccess = {
  approved: false,
  canViewResults: false,
  canVote: false,
  ownsRoom: false,
  delegatedRooms: [],
};

type AccessPayload = {
  approved?: boolean;
  can_view_results?: boolean;
  can_vote?: boolean;
  owns_room?: boolean;
  delegated_rooms?: DelegatedRoom[];
};

/** What the signed-in person may open (my_member_access(), migration 0029).
 * Menus and pages use it; RLS still guards the data. */
export const getMemberAccess = cache(async function getMemberAccess(): Promise<MemberAccess> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_member_access");

  if (error) {
    throw error;
  }

  if (!data || typeof data !== "object") {
    return NO_ACCESS;
  }

  const payload = data as unknown as AccessPayload;

  return {
    approved: payload.approved === true,
    canViewResults: payload.can_view_results === true,
    canVote: payload.can_vote === true,
    ownsRoom: payload.owns_room === true,
    delegatedRooms: Array.isArray(payload.delegated_rooms) ? payload.delegated_rooms : [],
  };
});

// Same order as the shell: sign-in, then the privacy notice, then the page.
// Layout and page render together, so the page must not decide first.
async function requireSignedInAndConsented() {
  await requireProfile();

  if (await needsPrivacyConsent(await createClient())) {
    redirect("/consent");
  }
}

export async function requireResultsAccess() {
  await requireSignedInAndConsented();
  const access = await getMemberAccess();

  if (!access.canViewResults) {
    redirect(DENIED_PATH);
  }

  return access;
}

export async function requireVoteAccess() {
  await requireSignedInAndConsented();
  const access = await getMemberAccess();

  if (!access.canVote) {
    redirect(DENIED_PATH);
  }

  return access;
}

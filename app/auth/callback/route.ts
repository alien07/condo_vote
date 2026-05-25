import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { ensureProfile } from "@/features/auth/profile";
import { ERROR_CODES, type ErrorCode } from "@/lib/error-codes";
import { createClient } from "@/lib/supabase/server";

function getSummaryPath(meetingId: string | null) {
  return meetingId ? `/summary/${meetingId}` : "/summary";
}

function parseVoteNext(next: string) {
  const match = next.match(/^\/vote\/([^/]+)\/([^/]+)$/);

  if (!match) {
    return null;
  }

  return {
    meetingId: match[1],
    roomId: match[2],
  };
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const nextParam = requestUrl.searchParams.get("next");
  const next =
    nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  const supabase = await createClient();
  let authError: unknown = null;
  let errorCode: ErrorCode = ERROR_CODES.AUTH_CALLBACK_MISSING_TOKEN;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
    errorCode = ERROR_CODES.AUTH_CALLBACK_EXCHANGE_FAILED;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    authError = error;
    errorCode = ERROR_CODES.AUTH_CALLBACK_EXCHANGE_FAILED;
  }

  if (!authError && (code || tokenHash)) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error(ERROR_CODES.AUTH_CALLBACK_USER_MISSING, {
        next,
      });

      return NextResponse.redirect(
        new URL(
          `/login?error=${ERROR_CODES.AUTH_CALLBACK_USER_MISSING}`,
          requestUrl.origin,
        ),
      );
    }

    try {
      const profile = await ensureProfile(supabase, user);
      const voteTarget = parseVoteNext(next);

      if (voteTarget) {
        const { data: eligible } = await supabase
          .from("eligible_voters_snapshot")
          .select("meeting_id, room_id, voter_type, meetings(status, starts_at, ends_at)")
          .eq("profile_id", profile.id)
          .eq("meeting_id", voteTarget.meetingId)
          .eq("room_id", voteTarget.roomId)
          .maybeSingle();
        const meeting = eligible?.meetings;
        const now = new Date();
        const canVote =
          eligible &&
          (eligible.voter_type === "owner" || eligible.voter_type === "proxy") &&
          meeting?.status === "published" &&
          now >= new Date(meeting.starts_at) &&
          now <= new Date(meeting.ends_at);

        return NextResponse.redirect(
          new URL(
            canVote ? next : getSummaryPath(voteTarget.meetingId),
            requestUrl.origin,
          ),
        );
      }
    } catch (error) {
      console.error(ERROR_CODES.AUTH_CALLBACK_PROFILE_FAILED, {
        error,
        next,
      });

      return NextResponse.redirect(
        new URL(
          `/login?error=${ERROR_CODES.AUTH_CALLBACK_PROFILE_FAILED}`,
          requestUrl.origin,
        ),
      );
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  console.error(errorCode, {
    error: authError,
    hasCode: Boolean(code),
    hasTokenHash: Boolean(tokenHash),
    next,
  });

  return NextResponse.redirect(
    new URL(`/login?error=${errorCode}`, requestUrl.origin),
  );
}

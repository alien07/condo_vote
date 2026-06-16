import { NextResponse, type NextRequest } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import { debugAction } from "@/lib/debug/action-log";
import { ERROR_CODES } from "@/lib/error-codes";
import type { Database } from "@/lib/supabase/database.types";

function getSafeNext(value: string | null) {
  const next = String(value ?? "").trim();

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  return next;
}

function getServiceRoleKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function isPrivateHost(hostname: string) {
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname)) {
    return true;
  }

  if (hostname.startsWith("192.168.") || hostname.startsWith("10.")) {
    return true;
  }

  const match = hostname.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

async function findUserByEmail(
  supabase: ReturnType<typeof createClient<Database>>,
  email: string,
) {
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw error;
    }

    const found = data.users.find(
      (user: User) => user.email?.toLowerCase() === email,
    );

    if (found || data.users.length < 100) {
      return found ?? null;
    }

    page += 1;
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const next = getSafeNext(requestUrl.searchParams.get("next"));
  const serviceKey = getServiceRoleKey();
  const email = (
    process.env.LOCAL_AUTH_BYPASS_EMAIL ?? "demo.admin@example.test"
  ).toLowerCase();
  const fullName = process.env.LOCAL_AUTH_BYPASS_NAME ?? "Demo Admin";

  debugAction("auth.local_bypass.start", {
    next,
  });

  if (
    process.env.NODE_ENV === "production" ||
    process.env.ENABLE_LOCAL_AUTH_BYPASS === "0" ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !serviceKey ||
    !isPrivateHost(requestUrl.hostname)
  ) {
    debugAction("auth.local_bypass.disabled", { next });
    return NextResponse.redirect(
      new URL(`/login?error=${ERROR_CODES.AUTH_LOCAL_BYPASS_DISABLED}`, requestUrl),
    );
  }

  try {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
    let user = await findUserByEmail(supabase, email);

    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      });

      if (error) {
        throw error;
      }

      user = data.user;
    }

    if (!user) {
      throw new Error("Local bypass user was not created.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          auth_user_id: user.id,
          email,
          full_name: fullName,
          approval_status: "approved",
          default_status: "owner",
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    if (profileError) {
      throw profileError;
    }

    const { error: roleError } = await supabase.from("app_roles").upsert(
      {
        profile_id: profile.id,
        role: "admin",
      },
      { onConflict: "profile_id,role" },
    );

    if (roleError) {
      throw roleError;
    }

    const { data: link, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo: `${requestUrl.origin}/auth/callback?next=${encodeURIComponent(
            next,
          )}`,
        },
      });

    if (
      linkError ||
      !link.properties?.hashed_token ||
      !link.properties?.verification_type
    ) {
      throw linkError ?? new Error("Local bypass magic link was not generated.");
    }

    debugAction("auth.local_bypass.redirect", { next });
    return NextResponse.redirect(
      new URL(
        `/auth/callback?token_hash=${encodeURIComponent(
          link.properties.hashed_token,
        )}&type=${encodeURIComponent(
          link.properties.verification_type,
        )}&next=${encodeURIComponent(next)}`,
        requestUrl,
      ),
    );
  } catch (error) {
    console.error(ERROR_CODES.AUTH_LOCAL_BYPASS_FAILED, { error, next });
    return NextResponse.redirect(
      new URL(`/login?error=${ERROR_CODES.AUTH_LOCAL_BYPASS_FAILED}`, requestUrl),
    );
  }
}

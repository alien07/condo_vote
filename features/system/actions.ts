"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSystemAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  endSystemAccess,
  grantSystemAdmin,
  revokeSystemAdmin,
  startSystemAccess,
  SystemError,
} from "@/features/system/access-service";
import { formatDateTimeIn } from "@/lib/i18n/format";
import { getStaffI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/template";

type SystemText = Awaited<ReturnType<typeof getStaffI18n>>["s"]["system"];

async function run(work: (t: SystemText, locale: "th" | "en") => Promise<string>) {
  await requireSystemAdmin();
  const { locale, s } = await getStaffI18n();
  let href: string;

  try {
    href = `/system?feedback=success&message=${encodeURIComponent(await work(s.system, locale))}`;
  } catch (error) {
    const message =
      error instanceof SystemError && s.system.errors[error.code]
        ? s.system.errors[error.code]
        : error instanceof Error
          ? error.message
          : String(error);
    href = `/system?feedback=error&message=${encodeURIComponent(message)}`;
  }

  revalidatePath("/", "layout");
  redirect(href);
}

/** Open read-only access to the building's data (D027). */
export async function startSystemAccessAction(formData: FormData) {
  await run(async (t, locale) => {
    const result = await startSystemAccess(await createClient(), {
      reason: String(formData.get("reason") ?? "").trim(),
      hours: Number(formData.get("hours")),
    });

    return fill(t.access.opened, { time: formatDateTimeIn(locale, result.ends_at) });
  });
}

export async function endSystemAccessAction() {
  await run(async (t) => {
    await endSystemAccess(await createClient());

    return t.access.ended;
  });
}

/** Strict notice period (req_0011 C, D027): refuse or warn. */
export async function setStrictNoticeAction(formData: FormData) {
  await run(async (t) => {
    const strict = formData.get("strict") === "on";
    const { error } = await (await createClient()).rpc("set_strict_notice_period", { p_strict: strict });

    if (error) {
      throw new Error(error.message);
    }

    const { data: days } = await (await createClient()).rpc("notice_period_days");

    return fill(strict ? t.notice.savedStrict : t.notice.savedWarn, { days: days ?? 7 });
  });
}

export async function grantSystemAdminAction(formData: FormData) {
  await run(async (t) => {
    const result = await grantSystemAdmin(await createClient(), String(formData.get("email") ?? "").trim());

    return result.building_roles.length > 0 ? t.admins.addedWithBuilding : t.admins.added;
  });
}

export async function revokeSystemAdminAction(formData: FormData) {
  await run(async (t) => {
    await revokeSystemAdmin(await createClient(), String(formData.get("profile_id") ?? ""));

    return t.admins.removed;
  });
}

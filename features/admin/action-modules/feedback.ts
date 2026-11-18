// Admin action standard (2026-11-19, docs/admin-crud-flow.md "Action
// Feedback"): every admin action ends on the page it came from with a
// message, success or the reason it failed, and never on an error page.

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidateAdminPaths } from "@/features/admin/action-modules/shared";

export type ActionTone = "success" | "error";

/** The reason an action failed, in words the page can show (English; the
 * banner translates it). A row that other records still use (23503)
 * gets `inUse` when given. */
export function actionErrorText(error: unknown, inUse?: string) {
  const record = (error ?? {}) as { code?: string; message?: string };

  if (record.code === "23503" && inUse) {
    return inUse;
  }

  return record.message || "Something went wrong. Please try again.";
}

/** Back to the page the form was on (Referer), with the message in the
 * URL for the shared feedback banner. Other query params are kept. */
export async function backToPage(tone: ActionTone, message: string, fallback = "/admin"): Promise<never> {
  const referer = (await headers()).get("referer");
  let target = fallback;

  if (referer) {
    try {
      const url = new URL(referer);

      url.searchParams.delete("feedback");
      url.searchParams.delete("message");
      target = `${url.pathname}?${url.searchParams.toString()}`;
    } catch {
      target = fallback;
    }
  }

  const params = new URLSearchParams({ feedback: tone, message });
  redirect(`${target}${target.includes("?") ? "&" : "?"}${params.toString()}`.replace("?&", "?"));
}

/**
 * Runs an admin action and reports the outcome on the same page:
 * `success` when it worked, or why it failed. A redirect inside `run`
 * (for example sign-in) still happens.
 */
export async function withFeedback(
  success: string,
  run: () => Promise<unknown>,
  options: { inUse?: string } = {},
): Promise<never> {
  try {
    await run();
  } catch (error) {
    unstable_rethrow(error);
    await backToPage("error", actionErrorText(error, options.inUse));
  }

  revalidateAdminPaths();
  return backToPage("success", success);
}

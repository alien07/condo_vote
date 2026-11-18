"use server";

import { redirect } from "next/navigation";
import {
  createClient,
  optionalDate,
  optionalText,
  requiredText,
  requireAdmin,
  revalidateAdminPaths,
} from "@/features/admin/action-modules/shared";
import { writeAuditLog } from "@/lib/audit/business-audit";
import { toVoteError } from "@/features/voting/core/ballot-service";
import { PROXY_MEETING_CLOSED, takesNewProxy } from "@/features/admin/proxy-meetings";
import {
  type ProxyActionState,
  proxyFormValues,
  validateProxyCreate,
  validateProxyReview,
  proxyValidationState,
} from "@/features/admin/action-modules/voting/helpers";

export async function createProxyAuthorizationWithState(
  _state: ProxyActionState,
  formData: FormData,
): Promise<ProxyActionState> {
  const values = proxyFormValues(formData);

  try {
    const admin = await requireAdmin();
    const validation = proxyValidationState(validateProxyCreate(values), values);

    if (validation) {
      return validation;
    }

    const supabase = await createClient();
    // Only where the proxy can still change who votes (2026-11-19).
    const { data: meeting } = await supabase
      .from("meetings")
      .select("status, ends_at")
      .eq("id", values.meeting_id)
      .maybeSingle();

    if (!meeting || !takesNewProxy(meeting)) {
      return {
        error: PROXY_MEETING_CLOSED,
        fieldErrors: { meeting_id: PROXY_MEETING_CLOSED },
        values,
      };
    }

    const { data: authorization, error } = await supabase
      .from("proxy_authorizations")
      .insert({
        meeting_id: values.meeting_id,
        room_id: values.room_id,
        owner_id: optionalText(values.owner_id),
        proxy_profile_id: values.proxy_profile_id,
        valid_from: optionalDate(values.valid_from),
        valid_until: optionalDate(values.valid_until),
      })
      .select("id")
      .single();

    if (error) {
      return { error: toVoteError(error).message, values };
    }

    await writeAuditLog(supabase, {
      action: "proxy_authorization.created",
      actorProfileId: admin.id,
      entityId: authorization.id,
      entityType: "proxy_authorization",
    });
    revalidateAdminPaths();

    return {
      recordId: authorization.id,
      success: "Proxy authorization added",
      values,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not add proxy authorization.",
      values,
    };
  }
}

export async function reviewProxyAuthorizationWithState(
  _state: ProxyActionState,
  formData: FormData,
): Promise<ProxyActionState> {
  const values = proxyFormValues(formData);

  try {
    const reviewer = await requireAdmin();
    const validation = proxyValidationState(validateProxyReview(values), values);

    if (validation) {
      return validation;
    }

    const supabase = await createClient();
    const { data: authorization, error } = await supabase
      .from("proxy_authorizations")
      .update({
        status: values.status,
        reviewed_by: reviewer.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", values.id)
      .select("id")
      .single();

    if (error) {
      return { error: toVoteError(error).message, values };
    }

    await writeAuditLog(supabase, {
      action: "proxy_authorization.reviewed",
      actorProfileId: reviewer.id,
      details: { status: values.status },
      entityId: authorization.id,
      entityType: "proxy_authorization",
    });
    revalidateAdminPaths();

    return {
      recordId: authorization.id,
      success: "Proxy authorization reviewed",
      values,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not review proxy authorization.",
      values,
    };
  }
}

export async function createProxyAuthorization(formData: FormData) {
  const admin = await requireAdmin();

  const supabase = await createClient();
  const { data: authorization, error } = await supabase
    .from("proxy_authorizations")
    .insert({
      meeting_id: requiredText(formData.get("meeting_id"), "Meeting"),
      room_id: requiredText(formData.get("room_id"), "Room"),
      owner_id: optionalText(formData.get("owner_id")),
      proxy_profile_id: requiredText(formData.get("proxy_profile_id"), "Proxy profile"),
      valid_from: optionalDate(formData.get("valid_from")),
      valid_until: optionalDate(formData.get("valid_until")),
    })
    .select("id")
    .single();

  if (error) {
    throw toVoteError(error);
  }

  await writeAuditLog(supabase, {
    action: "proxy_authorization.created",
    actorProfileId: admin.id,
    entityId: authorization.id,
    entityType: "proxy_authorization",
  });
  revalidateAdminPaths();
  redirect(
    "/admin/proxies?feedback=success&message=Proxy%20authorization%20created",
  );
}

export async function reviewProxyAuthorization(formData: FormData) {
  const reviewer = await requireAdmin();

  const id = requiredText(formData.get("id"), "Proxy authorization ID");
  const status = requiredText(formData.get("status"), "Status");
  const supabase = await createClient();
  const { error } = await supabase
    .from("proxy_authorizations")
    .update({
      status,
      reviewed_by: reviewer.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw toVoteError(error);
  }

  await writeAuditLog(supabase, {
    action: "proxy_authorization.reviewed",
    actorProfileId: reviewer.id,
    details: { status },
    entityId: id,
    entityType: "proxy_authorization",
  });
  revalidateAdminPaths();
  redirect(
    "/admin/proxies?feedback=success&message=Proxy%20authorization%20reviewed",
  );
}

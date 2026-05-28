import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function fetchCommunicationsData(supabase: SupabaseServerClient) {
  const emailLogsResult = await supabase
    .from("email_logs")
    .select(
      "id, recipient_email, template_key, status, sent_at, error_message, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(25);

  if (emailLogsResult.error) {
    throw emailLogsResult.error;
  }

  return {
    emailLogs: emailLogsResult.data,
  };
}

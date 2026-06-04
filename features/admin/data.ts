import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { fetchCommunicationsData } from "@/features/admin/data-modules/communications";
import { fetchDocumentData } from "@/features/admin/data-modules/documents";
import { fetchMeetingsData } from "@/features/admin/data-modules/meetings";
import { fetchPeopleData } from "@/features/admin/data-modules/people";
import { fetchResultsData } from "@/features/admin/data-modules/results";
import { fetchSetupData } from "@/features/admin/data-modules/setup";
import { fetchVotingData } from "@/features/admin/data-modules/voting";
import type { AuditLogFilters } from "@/features/admin/data-modules/documents";

type AdminDashboardDataOptions = {
  auditFilters?: AuditLogFilters;
};

export async function getAdminDashboardData(
  options: AdminDashboardDataOptions = {},
) {
  await requireAdmin();

  const supabase = await createClient();
  const [setup, people, meetings, voting, results, communications, documents] =
    await Promise.all([
      fetchSetupData(supabase),
      fetchPeopleData(supabase),
      fetchMeetingsData(supabase),
      fetchVotingData(supabase),
      fetchResultsData(supabase),
      fetchCommunicationsData(supabase),
      fetchDocumentData(supabase, options.auditFilters),
    ]);

  return {
    ...setup,
    ...people,
    ...meetings,
    ...voting,
    ...results,
    ...communications,
    ...documents,
  };
}

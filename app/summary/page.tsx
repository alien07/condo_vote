import { getSummaryData } from "@/features/summary/data";
import { requireResultsAccess } from "@/lib/auth/access";
import { SummaryPage } from "@/features/summary/summary-page";
import { getLocale } from "@/lib/i18n/server";

export default async function ResultSummaryPage() {
  await requireResultsAccess();
  const { condoProfile, historyLimit, summaries } = await getSummaryData();
  const locale = await getLocale();

  return (
    <SummaryPage
      condoProfile={condoProfile}
      history={summaries}
      historyLimit={historyLimit}
      locale={locale}
      selected={summaries[0] ?? null}
    />
  );
}

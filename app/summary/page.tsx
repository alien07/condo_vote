import { getSummaryData } from "@/features/summary/data";
import { SummaryPage } from "@/features/summary/summary-page";
import { getLocale } from "@/lib/i18n/server";

export default async function ResultSummaryPage() {
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

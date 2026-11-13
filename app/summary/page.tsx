import { getSummaryData } from "@/features/summary/data";
import { SummaryPage } from "@/features/summary/summary-page";
import { requireResultsAccess } from "@/lib/auth/access";
import { getLocale } from "@/lib/i18n/server";

export default async function ResultSummaryPage() {
  await requireResultsAccess();
  const { condoProfile, historyLimit, history, selected, totalCount } = await getSummaryData();
  const locale = await getLocale();

  return (
    <SummaryPage
      condoProfile={condoProfile}
      history={history}
      historyLimit={historyLimit}
      locale={locale}
      selected={selected}
      totalCount={totalCount}
    />
  );
}

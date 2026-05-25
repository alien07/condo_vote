import { getSummaryData } from "@/features/summary/data";
import { SummaryPage } from "@/features/summary/summary-page";

export default async function ResultSummaryPage() {
  const { condoProfile, historyLimit, summaries } = await getSummaryData();

  return (
    <SummaryPage
      condoProfile={condoProfile}
      history={summaries}
      historyLimit={historyLimit}
      selected={summaries[0] ?? null}
    />
  );
}

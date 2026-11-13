import { getSummaryData } from "@/features/summary/data";
import { requireResultsAccess } from "@/lib/auth/access";
import { SummaryPage } from "@/features/summary/summary-page";
import { getLocale } from "@/lib/i18n/server";

type ResultSummaryDetailPageProps = {
  params: Promise<{
    meetingId: string;
  }>;
};

export default async function ResultSummaryDetailPage({
  params,
}: ResultSummaryDetailPageProps) {
  await requireResultsAccess();
  const { meetingId } = await params;
  const selectedData = await getSummaryData(meetingId);
  const historyData = await getSummaryData();
  const locale = await getLocale();

  return (
    <SummaryPage
      condoProfile={selectedData.condoProfile ?? historyData.condoProfile}
      history={historyData.summaries}
      historyLimit={historyData.historyLimit}
      locale={locale}
      selected={selectedData.summaries[0] ?? null}
    />
  );
}

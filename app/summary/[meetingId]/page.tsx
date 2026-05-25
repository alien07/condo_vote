import { getSummaryData } from "@/features/summary/data";
import { SummaryPage } from "@/features/summary/summary-page";

type ResultSummaryDetailPageProps = {
  params: Promise<{
    meetingId: string;
  }>;
};

export default async function ResultSummaryDetailPage({
  params,
}: ResultSummaryDetailPageProps) {
  const { meetingId } = await params;
  const selectedData = await getSummaryData(meetingId);
  const historyData = await getSummaryData();

  return (
    <SummaryPage
      condoProfile={selectedData.condoProfile ?? historyData.condoProfile}
      history={historyData.summaries}
      historyLimit={historyData.historyLimit}
      selected={selectedData.summaries[0] ?? null}
    />
  );
}

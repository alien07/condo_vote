import { getSummaryData } from "@/features/summary/data";
import { SummaryPage } from "@/features/summary/summary-page";
import { requireResultsAccess } from "@/lib/auth/access";
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
  const { condoProfile, historyLimit, history, selected, totalCount } =
    await getSummaryData(meetingId);
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

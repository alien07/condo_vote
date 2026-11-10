import { getStaffI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/template";
import { formatBangkokDateTime } from "@/lib/datetime";
import Link from "next/link";
import {
  BallotChoiceInputs,
  selectedChoicesByQuestion,
} from "@/features/voting/components/ballot-choice-inputs";
import { notFound } from "next/navigation";
import { Vote } from "lucide-react";
import { RequiredMark, RequiredNote } from "@/features/admin/components/field-label";
import { submitManualBallot } from "@/features/admin/action-modules/voting";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

type ManualVotePageProps = {
  params: Promise<{
    meetingId: string;
    roomId: string;
  }>;
  searchParams: Promise<{
    voterName?: string;
    voterProfileId?: string;
  }>;
};

const formatDateTime = formatBangkokDateTime;

export default async function ManualVotePage({
  params,
  searchParams,
}: ManualVotePageProps) {
  const { s } = await getStaffI18n();
  await requireAdmin();

  const { meetingId, roomId } = await params;
  const query = await searchParams;
  const voterProfileId = query.voterProfileId?.trim() ?? "";
  const voterName = query.voterName?.trim() ?? "";

  if (!voterProfileId && !voterName) {
    notFound();
  }

  const supabase = await createClient();
  const [meetingResult, roomResult, questionsResult, manualBallotResult, profileResult] =
    await Promise.all([
      supabase
        .from("meetings")
        .select("id, title, starts_at, ends_at, status")
        .eq("id", meetingId)
        .single(),
      supabase
        .from("rooms")
        .select("id, room_number, ownership_percent")
        .eq("id", roomId)
        .single(),
      supabase
        .from("meeting_questions")
        .select(
          "id, agenda_no, agenda_title, question_text, question_type, max_choices, required, display_order, meeting_choices(id, choice_text, display_order, is_abstain)",
        )
        .eq("meeting_id", meetingId)
        .order("display_order", { ascending: true }),
      supabase
        .from("manual_ballots")
        .select(
          "id, status, identity_status, voter_profile_id, voter_identity_text, manual_ballot_answers(question_id, choice_id)",
        )
        .eq("meeting_id", meetingId)
        .eq("room_id", roomId)
        .maybeSingle(),
      voterProfileId
        ? supabase
            .from("profiles")
            .select("id, full_name, email")
            .eq("id", voterProfileId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (meetingResult.error || roomResult.error || questionsResult.error) {
    notFound();
  }

  if (manualBallotResult.error) {
    throw manualBallotResult.error;
  }

  if (profileResult.error) {
    throw profileResult.error;
  }

  const meeting = meetingResult.data;
  const room = roomResult.data;
  const profile = profileResult.data;
  const answerByQuestion = selectedChoicesByQuestion(manualBallotResult.data?.manual_ballot_answers);
  const voterLabel = profile
    ? `${profile.full_name ?? profile.email} (${profile.email})`
    : voterName;
  const pendingIdentity = !profile;

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <Vote className="text-[var(--primary)]" size={26} />
          <div>
            <Link className="text-sm text-[var(--muted)]" href="/admin/voting">
              {s.voting.backToManual}
            </Link>
            <h1 className="mt-1 text-2xl font-semibold">
              {fill(s.voting.entryTitle, { title: meeting.title })}
            </h1>
            <p className="text-sm text-[var(--muted)]">
              {fill(s.voting.entryRoom, { room: room.room_number, voter: voterLabel })}
            </p>
          </div>
        </div>

        {pendingIdentity ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {s.voting.entryPending}
          </p>
        ) : null}

        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-col gap-2 border-b border-[var(--border)] pb-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm text-[var(--muted)]">
                {formatDateTime(meeting.starts_at)} -{" "}
                {formatDateTime(meeting.ends_at)}
              </p>
            </div>
            <div className="text-sm text-[var(--muted)]">
              {fill(s.voting.entrySource, { percent: room.ownership_percent })}
            </div>
          </div>

          {questionsResult.data.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              {s.voting.noQuestions}
            </p>
          ) : (
            <form action={submitManualBallot} className="mt-4 grid gap-5">
              <RequiredNote />
              <input name="meeting_id" type="hidden" value={meetingId} />
              <input name="room_id" type="hidden" value={roomId} />
              <input name="voter_profile_id" type="hidden" value={voterProfileId} />
              <input name="voter_identity_text" type="hidden" value={voterName} />
              {questionsResult.data.map((question) => (
                <fieldset
                  className="rounded-md border border-[var(--border)] p-4"
                  key={question.id}
                >
                  <legend className="px-1 text-sm font-semibold">
                    {question.agenda_no ? `${question.agenda_no}. ` : ""}
                    {question.question_text}
                    {question.required ? (
                      <>
                        {" "}
                        <RequiredMark />
                      </>
                    ) : null}
                  </legend>
                  {question.agenda_title ? (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {question.agenda_title}
                    </p>
                  ) : null}
                  <BallotChoiceInputs
                    choices={question.meeting_choices}
                    question={question}
                    selectedChoiceIds={
                      answerByQuestion.get(question.id) ?? new Set<string>()
                    }
                  />
                </fieldset>
              ))}
              <section className="rounded-md border border-[var(--border)] bg-[var(--background)] p-4">
                <h2 className="text-sm font-semibold">{s.voting.review}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {s.voting.reviewText}
                </p>
              </section>
              <PendingSubmitButton
                className="min-h-10 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                pendingLabel={s.common.saving}
                type="submit"
              >
                {s.voting.save}
              </PendingSubmitButton>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}

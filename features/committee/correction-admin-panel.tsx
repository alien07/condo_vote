import { ChevronDown } from "lucide-react";
import { LongText } from "@/features/ui/long-text";
import { CountedText } from "@/features/committee/counted-text";
import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";
import { RequiredMark } from "@/features/admin/components/field-label";
import {
  answerCorrectionAsAdmin,
  raiseCorrectionLevelAsAdmin,
} from "@/features/committee/correction-admin-actions";
import { formatDateTimeIn } from "@/lib/i18n/format";
import { getStaffI18n } from "@/lib/i18n/server";
import { codeLabel, fill } from "@/lib/i18n/template";
import { createClient } from "@/lib/supabase/server";

const LEVELS = ["low", "medium", "high"];
const choice =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[var(--border)] px-3 has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--accent)]";
const input =
  "min-h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-normal";

/** Open correction requests on Admin > Results (demo feedback item 12). */
export async function CorrectionAdminPanel() {
  const supabase = await createClient();
  const { locale, s } = await getStaffI18n();
  const t = s.committee;
  const { data, error } = await supabase
    .from("result_correction_requests")
    .select(
      "id, category, level, reason, legal_reference, created_at, level_change_reason, meetings(title), requester:profiles!result_correction_requests_requested_by_fkey(full_name)",
    )
    .eq("status", "open")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <section
      className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
      data-testid="correction-requests"
    >
      <h2 className="text-base font-semibold">{t.adminCorrectionsTitle}</h2>
      <p className="mt-1">{t.adminCorrectionsText}</p>
      <div className="mt-3 grid gap-3">
        {data.map((request) => {
          const meeting = Array.isArray(request.meetings) ? request.meetings[0] : request.meetings;
          const requester = Array.isArray(request.requester)
            ? request.requester[0]
            : request.requester;
          const higher = LEVELS.slice(LEVELS.indexOf(request.level) + 1);

          return (
            <article
              className="grid gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--foreground)]"
              data-correction-id={request.id}
              key={request.id}
            >
              <div className="font-semibold">{meeting?.title ?? "-"}</div>
              <div>
                {codeLabel(t.categories, request.category)} ·{" "}
                {fill(t.correctionLevel, { level: codeLabel(t.levels, request.level) })}
              </div>
              <div className="text-[var(--muted)]">
                {fill(t.correctionBy, {
                  name: requester?.full_name ?? "-",
                  time: formatDateTimeIn(locale, request.created_at),
                })}
              </div>
              <LongText label={t.labelReason} less={t.showLess} more={t.showMore} text={request.reason} />
              {request.legal_reference ? (
                <LongText label={t.labelReference} less={t.showLess} lines={2} more={t.showMore} text={request.legal_reference} />
              ) : null}

              {/* One task at a time (2026-11-19 review): the answer is the main
                  form; raising the level folds away below it. */}
              <div className="grid gap-3 border-t border-[var(--border)] pt-3">
                <form action={answerCorrectionAsAdmin} className="grid gap-2">
                  <input name="request_id" type="hidden" value={request.id} />
                  <fieldset className="flex flex-wrap gap-2">
                    <legend className="sr-only">{t.answerText}</legend>
                    <label className={choice}>
                      <input className="h-4 w-4" defaultChecked name="status" type="radio" value="fixed" />
                      {t.answerFixed}
                    </label>
                    <label className={choice}>
                      <input className="h-4 w-4" name="status" type="radio" value="no_change" />
                      {t.answerNoChange}
                    </label>
                  </fieldset>
                  <label className="grid gap-1 font-medium">
                    <span>
                      {t.answerText} <RequiredMark />
                    </span>
                    <CountedText className={input} maxLength={500} multiline name="answer" required />
                  </label>
                  <ConfirmSubmitButton
                    className="min-h-11 w-fit rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                    confirmMessage={t.confirmAnswer}
                    pendingLabel={t.saving}
                    tone="primary"
                  >
                    {t.saveAnswer}
                  </ConfirmSubmitButton>
                </form>

                {higher.length > 0 ? (
                  <details className="group" data-raise-level>
                    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-medium text-[var(--primary)] [&::-webkit-details-marker]:hidden">
                      {t.raiseLevelQuestion}
                      <ChevronDown aria-hidden="true" className="transition-transform group-open:rotate-180" size={16} />
                    </summary>
                  <form action={raiseCorrectionLevelAsAdmin} className="mt-2 grid gap-2">
                    <input name="request_id" type="hidden" value={request.id} />
                    <select aria-label={t.raiseLevel} className={input} name="level">
                      {higher.map((level) => (
                        <option key={level} value={level}>
                          {codeLabel(t.levels, level)}
                        </option>
                      ))}
                    </select>
                    <label className="grid gap-1 font-medium">
                      <span>
                        {t.raiseReason} <RequiredMark />
                      </span>
                      <CountedText className={input} maxLength={500} name="reason" required />
                    </label>
                    <label className="grid gap-1 font-medium">
                      {t.correctionReference}
                      <CountedText className={input} maxLength={200} name="legal_reference" />
                    </label>
                    <ConfirmSubmitButton
                      className="min-h-11 w-fit rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
                      confirmMessage={t.confirmRaise}
                      pendingLabel={t.saving}
                    >
                      {t.raiseLevel}
                    </ConfirmSubmitButton>
                  </form>
                  </details>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

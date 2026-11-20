import { CalendarClock } from "lucide-react";
import { setStrictNoticeAction } from "@/features/system/actions";
import type { StaffDictionary } from "@/lib/i18n/staff";
import { fill } from "@/lib/i18n/template";

/** "Require 7 days' notice" (req_0011 C, D027; Condominium Act s.42/3). */
export function NoticePeriodPanel({
  days,
  strict,
  t,
}: {
  /** notice_period_days(): the one place the number lives. */
  days: number;
  strict: boolean;
  t: StaffDictionary["system"]["notice"];
}) {
  return (
    <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm" data-notice-period>
      <div className="mb-2 flex items-center gap-2">
        <CalendarClock className="text-[var(--primary)]" size={20} />
        <h2 className="text-lg font-semibold">{t.title}</h2>
      </div>
      <p className="mb-4 text-[var(--muted)]">{fill(t.intro, { days })}</p>
      <form action={setStrictNoticeAction} className="grid gap-3">
        <label className="inline-flex min-h-11 items-center gap-2 font-medium">
          <input defaultChecked={strict} name="strict" type="checkbox" />
          {fill(t.strict, { days })}
        </label>
        <div>
          <button
            className="min-h-11 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            type="submit"
          >
            {t.save}
          </button>
        </div>
      </form>
    </section>
  );
}

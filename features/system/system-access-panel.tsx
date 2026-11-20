import { Eye, UserCog } from "lucide-react";
import { CountedText } from "@/features/committee/counted-text";
import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";
import { RequiredMark } from "@/features/admin/components/field-label";
import {
  endSystemAccessAction,
  grantSystemAdminAction,
  revokeSystemAdminAction,
  startSystemAccessAction,
} from "@/features/system/actions";
import { ACCESS_HOURS, type SystemAccessStatus, type SystemAdmin } from "@/features/system/access-service";
import type { Locale } from "@/lib/i18n/locales";
import { formatDateTimeIn } from "@/lib/i18n/format";
import type { StaffDictionary } from "@/lib/i18n/staff";
import { fill } from "@/lib/i18n/template";

const input =
  "min-h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-normal";
const primary =
  "min-h-11 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]";
const secondary =
  "min-h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium";

/** Temporary read-only access to the building's data (req_0011 B, D027). */
export function SystemAccessPanel({
  locale,
  status,
  t,
}: {
  locale: Locale;
  status: SystemAccessStatus | null;
  t: StaffDictionary["system"]["access"];
}) {
  const mine = status?.active.find((entry) => entry.mine) ?? null;
  const hourLabel: Record<number, string> = { 1: t.hour1, 4: t.hour4, 24: t.hour24 };

  return (
    <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5" data-system-access>
      <div className="mb-2 flex items-center gap-2">
        <Eye className="text-[var(--primary)]" size={20} />
        <h2 className="text-lg font-semibold">{t.title}</h2>
      </div>
      <p className="mb-4 text-sm text-[var(--muted)]">{t.intro}</p>
      {mine ? (
        <div className="grid gap-3 text-sm">
          <p className="font-medium" data-access-active>
            {fill(t.activeUntil, { time: formatDateTimeIn(locale, mine.ends_at) })}
          </p>
          <p className="text-[var(--muted)] [overflow-wrap:anywhere]">
            {t.reason}: {mine.reason}
          </p>
          <form action={endSystemAccessAction}>
            <ConfirmSubmitButton className={secondary} confirmMessage={t.confirmEnd} pendingLabel="...">
              {t.end}
            </ConfirmSubmitButton>
          </form>
        </div>
      ) : (
        <form action={startSystemAccessAction} className="grid gap-3 text-sm sm:max-w-md" data-access-form>
          <label className="grid gap-1 font-medium">
            <span>
              {t.reason} <RequiredMark />
            </span>
            <CountedText className={input} maxLength={500} multiline name="reason" required />
          </label>
          <fieldset className="grid gap-1">
            <legend className="font-medium">{t.hours}</legend>
            <div className="flex flex-wrap gap-3">
              {ACCESS_HOURS.map((hours) => (
                <label className="inline-flex min-h-11 items-center gap-2" key={hours}>
                  <input defaultChecked={hours === 1} name="hours" type="radio" value={hours} />
                  {hourLabel[hours]}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <ConfirmSubmitButton className={primary} confirmMessage={t.confirmOpen} pendingLabel="..." tone="primary">
              {t.open}
            </ConfirmSubmitButton>
          </div>
        </form>
      )}
    </section>
  );
}

/** System admins: add by email, remove (never the last one). */
export function SystemAdminsPanel({
  admins,
  roleNames,
  t,
}: {
  admins: SystemAdmin[];
  roleNames: Record<string, string>;
  t: StaffDictionary["system"]["admins"];
}) {
  return (
    <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5" data-system-admins>
      <div className="mb-2 flex items-center gap-2">
        <UserCog className="text-[var(--primary)]" size={20} />
        <h2 className="text-lg font-semibold">{t.title}</h2>
      </div>
      <p className="mb-4 text-sm text-[var(--muted)]">{t.intro}</p>
      <ul className="mb-4 grid gap-2 text-sm">
        {admins.map((admin) => (
          <li
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2"
            key={admin.profile_id}
          >
            <div className="grid min-w-0 gap-0.5">
              <span className="font-medium [overflow-wrap:anywhere]">
                {admin.name ?? "-"}
                {admin.me ? ` (${t.you})` : null}
              </span>
              <span className="text-xs text-[var(--muted)] [overflow-wrap:anywhere]">{admin.email}</span>
              {admin.building_roles.length > 0 ? (
                <span className="text-xs text-amber-800" data-also-building>
                  {fill(t.alsoBuilding, {
                    roles: admin.building_roles.map((role) => roleNames[role] ?? role).join(", "),
                  })}
                </span>
              ) : null}
            </div>
            {admins.length > 1 ? (
              <form action={revokeSystemAdminAction}>
                <input name="profile_id" type="hidden" value={admin.profile_id} />
                <ConfirmSubmitButton
                  className={secondary}
                  confirmMessage={fill(t.confirmRemove, { name: admin.name ?? admin.email ?? "-" })}
                  pendingLabel="..."
                >
                  {t.remove}
                </ConfirmSubmitButton>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      <form action={grantSystemAdminAction} className="flex flex-wrap items-end gap-2 text-sm">
        <label className="grid min-w-0 flex-1 gap-1 font-medium sm:max-w-sm">
          {t.email}
          <input className={input} name="email" required type="email" />
        </label>
        <button className={primary} type="submit">
          {t.add}
        </button>
      </form>
    </section>
  );
}

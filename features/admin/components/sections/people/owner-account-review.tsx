"use client";

import Link from "next/link";
import { useStaffText } from "@/lib/i18n/staff/client";
import { formatDateTimeIn } from "@/lib/i18n/format";
import { fill } from "@/lib/i18n/template";
import type {
  Owner,
  OwnerAccountEvent,
  Profile,
} from "@/features/admin/components/sections/people/people-types";

function eventLabel(
  event: OwnerAccountEvent,
  labels: { auto: string; linked: string; moved: string; unlinked: string },
) {
  const source = (event.details_json as { source?: string } | null)?.source;

  if (event.action === "owner.profile_moved") {
    return labels.moved;
  }

  if (event.action === "owner.profile_unlinked") {
    return labels.unlinked;
  }

  return source === "admin" ? labels.linked : labels.auto;
}

/** Admin review of owner accounts (D024): who has none, and recent links. */
export function OwnerAccountReview({
  buildOwnerHref,
  events,
  owners,
  profiles,
}: {
  buildOwnerHref: (ownerId: string) => string;
  events: OwnerAccountEvent[];
  owners: Owner[];
  profiles: Profile[];
}) {
  const { locale, s } = useStaffText();
  const ownersById = new Map(owners.map((owner) => [owner.id, owner]));
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const unlinked = owners.filter((owner) => owner.active && !owner.profile_id);
  const labels = {
    auto: s.people.accountEventAuto,
    linked: s.people.accountEventLinked,
    moved: s.people.accountEventMoved,
    unlinked: s.people.accountEventUnlinked,
  };

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-lg font-semibold">{s.people.accountReviewTitle}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{s.people.accountReviewIntro}</p>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">
            {fill(s.people.accountUnlinkedCount, { count: unlinked.length })}
          </h3>
          {unlinked.length > 0 ? (
            <ul className="mt-2 grid gap-1 text-sm">
              {unlinked.slice(0, 10).map((owner) => (
                <li className="flex flex-wrap items-center justify-between gap-2" key={owner.id}>
                  <span>
                    {owner.full_name}
                    <span className="text-[var(--muted)]"> · {owner.email ?? "-"}</span>
                  </span>
                  <Link className="text-sm font-medium underline" href={buildOwnerHref(owner.id)}>
                    {s.people.accountOpen}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          <h3 className="text-sm font-semibold">{s.people.accountRecent}</h3>
          {events.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">{s.people.accountNoEvents}</p>
          ) : (
            <ul className="mt-2 grid gap-2 text-sm">
              {events.map((event) => {
                const owner = event.entity_id ? ownersById.get(event.entity_id) : undefined;
                const details = event.details_json as {
                  from_profile_id?: string | null;
                  profile_id?: string;
                  to_profile_id?: string | null;
                } | null;
                // Unlink shows the account that was removed.
                const profile = profilesById.get(
                  details?.to_profile_id ?? details?.profile_id ?? details?.from_profile_id ?? "",
                );

                return (
                  <li className="grid gap-0.5" key={event.id}>
                    <span className="font-medium">
                      {eventLabel(event, labels)} · {owner?.full_name ?? "-"}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {profile?.email ?? "-"} ·{" "}
                      {formatDateTimeIn(locale, event.created_at)}
                      {owner ? (
                        <>
                          {" · "}
                          <Link className="underline" href={buildOwnerHref(owner.id)}>
                            {s.people.accountOpen}
                          </Link>
                        </>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

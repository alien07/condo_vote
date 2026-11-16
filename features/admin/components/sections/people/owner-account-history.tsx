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

const ACCOUNT_ACTIONS = ["owner.profile_linked", "owner.profile_moved", "owner.profile_unlinked"];

/** Full account history in the audit log, filtered to account actions. */
export const ownerAccountAuditHref = `/admin/setup?tab=audit&actions=${ACCOUNT_ACTIONS.join(",")}`;

function isAdminChange(event: OwnerAccountEvent) {
  const source = (event.details_json as { source?: string } | null)?.source;

  return event.action !== "owner.profile_linked" || source === "admin";
}

function eventLabel(
  event: OwnerAccountEvent,
  labels: { auto: string; linked: string; moved: string; unlinked: string },
) {
  if (event.action === "owner.profile_moved") {
    return labels.moved;
  }

  if (event.action === "owner.profile_unlinked") {
    return labels.unlinked;
  }

  return isAdminChange(event) ? labels.linked : labels.auto;
}

/**
 * Account history for the drawer (D024, moved off the page 2026-11-17):
 * changes by admins first; automatic links folded under one line, since on
 * a sign-in day there are many and most need no action.
 */
export function OwnerAccountHistory({
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
  const labels = {
    auto: s.people.accountEventAuto,
    linked: s.people.accountEventLinked,
    moved: s.people.accountEventMoved,
    unlinked: s.people.accountEventUnlinked,
  };
  const adminEvents = events.filter(isAdminChange);
  const autoEvents = events.filter((event) => !isAdminChange(event));

  const renderEvent = (event: OwnerAccountEvent) => {
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
      <li className="grid gap-0.5 border-b border-[var(--border)] py-2 last:border-b-0" key={event.id}>
        <span className="font-medium">
          {eventLabel(event, labels)} · {owner?.full_name ?? "-"}
        </span>
        <span className="text-xs text-[var(--muted)]">
          {profile?.email ?? "-"} · {formatDateTimeIn(locale, event.created_at)}
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
  };

  if (events.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{s.people.accountNoEvents}</p>;
  }

  return (
    <div className="grid gap-5 text-sm">
      <p className="text-[var(--muted)]">{s.people.accountReviewIntro}</p>

      <section>
        <h3 className="font-semibold">{s.people.accountAdminChanges}</h3>
        {adminEvents.length === 0 ? (
          <p className="mt-2 text-[var(--muted)]">{s.people.accountNoAdminChanges}</p>
        ) : (
          <ul className="mt-1">{adminEvents.slice(0, 10).map(renderEvent)}</ul>
        )}
      </section>

      {autoEvents.length > 0 ? (
        <details className="rounded-md border border-[var(--border)] px-3 py-2">
          <summary className="cursor-pointer font-semibold">
            {fill(s.people.accountAutoCount, { count: autoEvents.length })}
          </summary>
          <ul className="mt-1">{autoEvents.map(renderEvent)}</ul>
        </details>
      ) : null}

      <Link className="font-medium text-[var(--primary)] underline" href={ownerAccountAuditHref}>
        {s.people.accountAuditLink}
      </Link>
    </div>
  );
}

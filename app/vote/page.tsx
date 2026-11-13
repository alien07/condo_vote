import Link from "next/link";
import { Vote } from "lucide-react";
import { getVotingDashboardData } from "@/features/voting/data";
import { groupVoteRows } from "@/features/voting/grouping";
import { VoteRowCard } from "@/features/voting/components/vote-row-card";
import { getI18n } from "@/lib/i18n/server";
import { requireVoteAccess } from "@/lib/auth/access";

/** Closed meetings shown before "Show all" (demo feedback item 7). */
const CLOSED_PREVIEW = 3;

type VotePageProps = {
  searchParams: Promise<{ room?: string; closed?: string }>;
};

export default async function VotePage({ searchParams }: VotePageProps) {
  const access = await requireVoteAccess();
  const { eligibleRows, ballotsByMeetingRoom } = await getVotingDashboardData();
  const { locale, t: dict } = await getI18n();
  const t = dict.vote;
  const { room: roomFilter, closed } = await searchParams;
  const showAllClosed = closed === "all";

  // Room chips only for people with more than one room; proxy rooms marked.
  const rooms = [
    ...new Map(
      eligibleRows.map((row) => [
        row.room_id,
        { id: row.room_id, number: row.rooms?.room_number ?? "-", proxy: row.voter_type === "proxy" },
      ]),
    ).values(),
  ].sort((a, b) => a.number.localeCompare(b.number, "en", { numeric: true }));
  const activeRoom = rooms.some((room) => room.id === roomFilter) ? roomFilter : undefined;
  const visibleRows = activeRoom
    ? eligibleRows.filter((row) => row.room_id === activeRoom)
    : eligibleRows;
  const groups = groupVoteRows(visibleRows);
  const href = (params: { room?: string; closed?: string }) => {
    const query = new URLSearchParams();

    if (params.room) {
      query.set("room", params.room);
    }

    if (params.closed) {
      query.set("closed", params.closed);
    }

    const text = query.toString();
    return text ? `/vote?${text}` : "/vote";
  };
  const groupTitle = { open: t.groupOpen, upcoming: t.groupUpcoming, closed: t.groupClosed };

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <Vote className="text-[var(--primary)]" size={26} />
          <div>
            <h1 className="text-2xl font-semibold">{t.title}</h1>
            <p className="text-sm text-[var(--muted)]">
              {t.intro}
            </p>
          </div>
        </div>

        {access.delegatedRooms.length > 0 ? (
          <section
            className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"
            data-testid="delegated-rooms"
          >
            <h2 className="font-semibold">{t.delegatedTitle}</h2>
            <ul className="mt-2 grid gap-1 text-[var(--muted)]">
              {access.delegatedRooms.map((room) => (
                <li key={`${room.meeting_title}:${room.room_number}`}>
                  {t.delegated(room.room_number, room.proxy_name, room.meeting_title)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {eligibleRows.length === 0 ? (
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm">
            <h2 className="font-semibold">{t.emptyTitle}</h2>
            <p className="mt-1 text-[var(--muted)]">
              {t.emptyText}
            </p>
            <Link
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 font-medium"
              href="/summary"
            >
              {t.openSummary}
            </Link>
          </section>
        ) : (
          <div className="grid gap-6">
            {rooms.length > 1 ? (
              <nav aria-label={t.roomFilter} className="flex flex-wrap gap-2 text-sm">
                {[{ id: undefined, number: t.allRooms, proxy: false }, ...rooms].map((room) => {
                  const active = room.id === activeRoom;

                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 ${
                        active
                          ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "border-[var(--border)] bg-[var(--surface)]"
                      }`}
                      href={href({ room: room.id, closed })}
                      key={room.id ?? "all"}
                    >
                      {room.number}
                      {room.proxy ? ` · ${t.proxy}` : null}
                    </Link>
                  );
                })}
              </nav>
            ) : null}

            {groups.map((group) => {
              const limited = group.key === "closed" && !showAllClosed;
              const meetings = limited ? group.meetings.slice(0, CLOSED_PREVIEW) : group.meetings;
              const hidden = group.meetings.length - meetings.length;

              return (
                <section aria-labelledby={`vote-group-${group.key}`} className="grid gap-3" key={group.key}>
                  <h2 className="text-base font-semibold" id={`vote-group-${group.key}`}>
                    {groupTitle[group.key]}
                  </h2>
                  {meetings.flatMap((meeting) =>
                    meeting.rows.map((row) => (
                      <VoteRowCard
                        ballot={ballotsByMeetingRoom.get(`${row.meeting_id}:${row.room_id}`)}
                        key={row.id}
                        locale={locale}
                        row={row}
                        t={t}
                      />
                    )),
                  )}
                  {hidden > 0 ? (
                    <Link
                      className="inline-flex min-h-11 w-fit items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                      href={href({ room: activeRoom, closed: "all" })}
                    >
                      {t.showAllClosed(group.meetings.length)}
                    </Link>
                  ) : null}
                  {group.key === "closed" && showAllClosed && group.meetings.length > CLOSED_PREVIEW ? (
                    <Link
                      className="inline-flex min-h-11 w-fit items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                      href={href({ room: activeRoom })}
                    >
                      {t.showLatestClosed}
                    </Link>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

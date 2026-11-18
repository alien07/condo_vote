// Which meetings take a new proxy (2026-11-19). A proxy works only while
// it can still change who votes: a draft (the voter list is built when it
// is published) or a published meeting still open for voting (the room's
// voter changes at once, D011). After voting closes it does nothing.

export type ProxyMeetingLike = { status: string; ends_at: string };

export function takesNewProxy(meeting: ProxyMeetingLike, now = new Date()) {
  return (
    meeting.status === "draft" ||
    (meeting.status === "published" && new Date(meeting.ends_at).getTime() > now.getTime())
  );
}

export const PROXY_MEETING_CLOSED =
  "A proxy can only be added to a draft meeting or one still open for voting.";

// Option builders for SearchSelect that server components can call too
// (features/ui/search-select.tsx is a client module, so its own builders
// run only in client components).
import type { SearchSelectOption } from "@/features/ui/search-select";

type MeetingLike = {
  id: string;
  title: string;
  meeting_number?: string | null;
  fiscal_year?: number | string | null;
};

/** Meetings by title (2026-11-19). The value is the meeting id, never the
 * title: titles can change or repeat. The meeting number and fiscal year
 * are searchable; the caller says what the hint shows (closing time,
 * status), because each form cares about something different. */
export function meetingSearchOptions<T extends MeetingLike>(
  meetings: T[],
  hint?: (meeting: T) => string | undefined,
): SearchSelectOption[] {
  return meetings.map((meeting) => ({
    value: meeting.id,
    label: meeting.title,
    hint: hint?.(meeting),
    keywords:
      [meeting.meeting_number, meeting.fiscal_year].filter(Boolean).join(" ") || undefined,
  }));
}

"use client";

import { useRouter } from "next/navigation";
import { SearchSelect, type SearchSelectOption } from "@/features/ui/search-select";
import { useStaffText } from "@/lib/i18n/staff/client";

/** Picks which meeting's agenda the Agenda tab shows (2026-11-18). */
export function AgendaMeetingPicker({
  options,
  value,
}: {
  options: SearchSelectOption[];
  value: string;
}) {
  const router = useRouter();
  const { s } = useStaffText();

  return (
    <label className="grid gap-1 text-sm font-medium">
      {s.meetings.agendaOfMeeting}
      <SearchSelect
        defaultValue={value}
        name="meeting"
        onChange={(meetingId) =>
          router.push(`/admin/meetings?tab=questions&meeting=${encodeURIComponent(meetingId)}`)
        }
        options={options}
        text={{
          clear: s.common.searchClear,
          more: s.common.searchMore,
          noResults: s.common.searchNoResults,
          placeholder: s.meetings.agendaPickMeeting,
        }}
      />
    </label>
  );
}

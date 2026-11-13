import type { CommitteePerson } from "@/features/results/committee-service";

export type ApproverEntry = {
  profileId: string;
  name: string | null;
  kind: "approve" | "object";
  at: string;
  note: string | null;
};

type Text = {
  approversTitle: string;
  notAnswered: string;
  objected: string;
};

/** Who approved, who objected and who has not answered, for the one "i" tip
 * next to an approval count (demo feedback item 11). Spans only: it sits
 * inside the tip, which is inline. */
export function ApproverList({
  entries,
  members,
  formatTime,
  text,
}: {
  entries: ApproverEntry[];
  members: CommitteePerson[];
  formatTime: (value: string) => string;
  text: Text;
}) {
  const answered = new Set(entries.map((entry) => entry.profileId));
  const waiting = members.filter((member) => !answered.has(member.profile_id));

  return (
    <span className="block">
      <span className="block font-semibold">{text.approversTitle}</span>
      {entries.map((entry) => {
        const member = members.find((person) => person.profile_id === entry.profileId);

        return (
          <span className="mt-1 block" data-approver key={entry.profileId}>
            {entry.kind === "object" ? `✗ ${text.objected}: ` : "✓ "}
            {entry.name ?? "-"}
            {member?.position ? ` (${member.position})` : null}
            {` · ${formatTime(entry.at)}`}
            {entry.note ? <span className="block opacity-90">“{entry.note}”</span> : null}
          </span>
        );
      })}
      {waiting.map((member) => (
        <span className="mt-1 block opacity-80" key={member.profile_id}>
          {`○ ${member.name}`}
          {member.position ? ` (${member.position})` : null}
          {` · ${text.notAnswered}`}
        </span>
      ))}
    </span>
  );
}

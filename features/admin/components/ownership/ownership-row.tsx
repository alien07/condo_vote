import { useStaffText } from "@/lib/i18n/staff/client";
import { fill } from "@/lib/i18n/template";
import { useEffect, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { cancelRoomOwnerLinkWithState } from "@/features/admin/actions";
import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";
import {
  type RoomOwnerLink,
  initialState,
  mergeParams,
  ownershipDisplayStatus,
  ActionMessage,
} from "@/features/admin/components/ownership/ownership-helpers";

export function OwnershipRow({
  actionHref,
  focused,
  link,
  selected,
}: {
  actionHref: (updates: Record<string, string | null | undefined>) => string;
  focused: boolean;
  link: RoomOwnerLink;
  selected: boolean;
}) {
  const { s } = useStaffText();
  const [cancelState, cancelAction] = useActionState(
    cancelRoomOwnerLinkWithState,
    initialState,
  );
  const searchParams = useSearchParams();
  const status = ownershipDisplayStatus(link);

  useEffect(() => {
    if (!cancelState.success || !cancelState.recordId) {
      return;
    }

    window.location.assign(
      mergeParams(searchParams, {
        feedback: "success",
        focusOwnershipId: cancelState.recordId,
        id: null,
        message: cancelState.success,
        mode: null,
        type: null,
      }),
    );
  }, [cancelState, searchParams]);

  return (
    <>
      <tr
        className={[
          "border-b border-[var(--border)]",
          selected || focused
            ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
            : "",
        ].join(" ")}
        data-ownership-id={link.id}
        tabIndex={-1}
      >
        <td className="py-2 pr-3">{link.rooms?.room_number ?? "-"}</td>
        <td className="py-2 pr-3">{link.owners?.full_name ?? "-"}</td>
        <td className="py-2 pr-3">{link.ownership_role}</td>
        <td className="py-2 pr-3">
          {link.starts_at ?? s.ownership.notSet} - {link.ends_at ?? s.ownership.noEnd}
        </td>
        <td className="py-2 pr-3">
          <span className="rounded-full border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs font-medium">
            {s.ownership.status[status]}
          </span>
        </td>
        <td className="py-2">
          <div className="flex flex-wrap gap-3">
            {status === "active" || status === "scheduled" ? (
              <a
                className="inline-flex min-h-9 items-center rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                href={actionHref({
                  id: link.id,
                  mode: "edit",
                  type: "ownership_dates",
                })}
              >
                {s.ownership.editDatesButton}
              </a>
            ) : null}
            {status === "active" ? (
              <a
                className="inline-flex min-h-9 items-center rounded-md border border-red-200 px-3 py-1 text-sm font-medium text-red-700"
                href={actionHref({
                  id: link.id,
                  mode: "end",
                  type: "ownership_link",
                })}
              >
                {s.ownership.endButton}
              </a>
            ) : null}
            {status === "scheduled" ? (
              <form action={cancelAction}>
                <input name="id" type="hidden" value={link.id} />
                <ConfirmSubmitButton
                  className="inline-flex min-h-9 items-center rounded-md border border-red-200 px-3 py-1 text-sm font-medium text-red-700"
                  confirmMessage={fill(s.ownership.confirmCancel, {
                    room: link.rooms?.room_number ?? "-",
                    owner: link.owners?.full_name ?? "-",
                  })}
                  debugName="admin.ownership.cancel"
                  pendingLabel={s.ownership.cancelling}
                  type="submit"
                >
                  {s.ownership.cancelScheduled}
                </ConfirmSubmitButton>
              </form>
            ) : null}
            {status === "ended" || status === "cancelled" ? (
              <span className="text-sm text-[var(--muted)]">{s.ownership.readOnly}</span>
            ) : null}
          </div>
        </td>
      </tr>
      {cancelState.error || cancelState.success ? (
        <tr className="border-b border-[var(--border)]">
          <td className="py-2" colSpan={6}>
            <ActionMessage state={cancelState} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

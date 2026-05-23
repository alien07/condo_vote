import {
  Building2,
  CalendarDays,
  ShieldCheck,
  UserCheck,
  UserRound,
} from "lucide-react";
import {
  archiveMeeting,
  createMeeting,
  createOwner,
  createProxyAuthorization,
  createRoom,
  deactivateOwner,
  deactivateRoom,
  endRoomOwnerLink,
  linkRoomOwner,
  reviewProxyAuthorization,
  updateProfileApproval,
} from "@/features/admin/actions";
import { getAdminDashboardData } from "@/features/admin/data";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminPage() {
  const { rooms, owners, roomOwners, meetings, proxyAuthorizations, profiles } =
    await getAdminDashboardData();
  const activeRooms = rooms.filter((room) => room.active).length;
  const activeOwners = owners.filter((owner) => owner.active).length;
  const activeRoomOwnerLinks = roomOwners.filter((link) => !link.ends_at).length;
  const activeMeetings = meetings.filter(
    (meeting) => meeting.status !== "archived",
  ).length;
  const pendingProxyAuthorizations = proxyAuthorizations.filter(
    (authorization) => authorization.status === "pending",
  ).length;

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 border-b border-[var(--border)] pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-[var(--primary)]" size={26} />
            <div>
              <h1 className="text-2xl font-semibold">Admin</h1>
              <p className="text-sm text-[var(--muted)]">
                Room, owner, profile, and role-controlled demo workspace.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-sm md:grid-cols-5">
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{activeRooms}</div>
              <div className="text-[var(--muted)]">Active rooms</div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{activeOwners}</div>
              <div className="text-[var(--muted)]">Active owners</div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{activeRoomOwnerLinks}</div>
              <div className="text-[var(--muted)]">Room links</div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{activeMeetings}</div>
              <div className="text-[var(--muted)]">Meetings</div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{pendingProxyAuthorizations}</div>
              <div className="text-[var(--muted)]">Proxy requests</div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{profiles.length}</div>
              <div className="text-[var(--muted)]">Profiles</div>
            </div>
          </div>
        </div>

        <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="text-[var(--primary)]" size={20} />
            <h2 className="text-lg font-semibold">Meetings</h2>
          </div>
          <form action={createMeeting} className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="title"
              placeholder="Meeting title"
              required
            />
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="video_url"
              placeholder="Video URL"
              type="url"
            />
            <label className="text-sm font-medium">
              Starts
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="starts_at"
                required
                type="datetime-local"
              />
            </label>
            <label className="text-sm font-medium">
              Ends
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="ends_at"
                required
                type="datetime-local"
              />
            </label>
            <textarea
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm md:col-span-2"
              name="description"
              placeholder="Description"
              rows={3}
            />
            <button
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] md:col-span-2"
              type="submit"
            >
              Add meeting
            </button>
          </form>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Title</th>
                  <th className="py-2 pr-3 font-medium">Window</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((meeting) => (
                  <tr className="border-b border-[var(--border)]" key={meeting.id}>
                    <td className="py-2 pr-3">{meeting.title}</td>
                    <td className="py-2 pr-3">
                      {formatDateTime(meeting.starts_at)} -{" "}
                      {formatDateTime(meeting.ends_at)}
                    </td>
                    <td className="py-2 pr-3">{meeting.status}</td>
                    <td className="py-2">
                      {meeting.status !== "archived" ? (
                        <form action={archiveMeeting}>
                          <input name="id" type="hidden" value={meeting.id} />
                          <button
                            className="text-sm font-medium text-red-700"
                            type="submit"
                          >
                            Archive
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="text-[var(--primary)]" size={20} />
              <h2 className="text-lg font-semibold">Rooms</h2>
            </div>
            <form action={createRoom} className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="room_number"
                placeholder="Room number"
                required
              />
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="ownership_percent"
                placeholder="Ownership %"
                required
                step="0.000001"
                type="number"
              />
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="building"
                placeholder="Building"
              />
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="floor"
                placeholder="Floor"
              />
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="area_size"
                placeholder="Area size"
                step="0.01"
                type="number"
              />
              <button
                className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                type="submit"
              >
                Add room
              </button>
            </form>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Room</th>
                    <th className="py-2 pr-3 font-medium">Owner %</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr className="border-b border-[var(--border)]" key={room.id}>
                      <td className="py-2 pr-3">{room.room_number}</td>
                      <td className="py-2 pr-3">{room.ownership_percent}</td>
                      <td className="py-2 pr-3">
                        {room.active ? "Active" : "Inactive"}
                      </td>
                      <td className="py-2">
                        {room.active ? (
                          <form action={deactivateRoom}>
                            <input name="id" type="hidden" value={room.id} />
                            <button
                              className="text-sm font-medium text-red-700"
                              type="submit"
                            >
                              Deactivate
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-4 flex items-center gap-2">
              <UserRound className="text-[var(--primary)]" size={20} />
              <h2 className="text-lg font-semibold">Owners</h2>
            </div>
            <form action={createOwner} className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="full_name"
                placeholder="Full name"
                required
              />
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="email"
                placeholder="Email"
                type="email"
              />
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="phone"
                placeholder="Phone"
              />
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="line_id"
                placeholder="LINE ID"
              />
              <button
                className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] md:col-span-2"
                type="submit"
              >
                Add owner
              </button>
            </form>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Email</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {owners.map((owner) => (
                    <tr className="border-b border-[var(--border)]" key={owner.id}>
                      <td className="py-2 pr-3">{owner.full_name}</td>
                      <td className="py-2 pr-3">{owner.email ?? "-"}</td>
                      <td className="py-2 pr-3">
                        {owner.active ? "Active" : "Inactive"}
                      </td>
                      <td className="py-2">
                        {owner.active ? (
                          <form action={deactivateOwner}>
                            <input name="id" type="hidden" value={owner.id} />
                            <button
                              className="text-sm font-medium text-red-700"
                              type="submit"
                            >
                              Deactivate
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="text-[var(--primary)]" size={20} />
            <h2 className="text-lg font-semibold">Room Ownership</h2>
          </div>
          <form action={linkRoomOwner} className="grid gap-3 md:grid-cols-3">
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="room_id"
              required
            >
              <option value="">Room</option>
              {rooms
                .filter((room) => room.active)
                .map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.room_number}
                  </option>
                ))}
            </select>
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="owner_id"
              required
            >
              <option value="">Owner</option>
              {owners
                .filter((owner) => owner.active)
                .map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.full_name}
                  </option>
                ))}
            </select>
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="ownership_role"
              required
            >
              <option value="owner">Owner</option>
              <option value="co_owner">Co-owner</option>
            </select>
            <label className="text-sm font-medium">
              Starts
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="starts_at"
                type="date"
              />
            </label>
            <label className="text-sm font-medium">
              Ends
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="ends_at"
                type="date"
              />
            </label>
            <button
              className="self-end rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              type="submit"
            >
              Link owner to room
            </button>
          </form>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Room</th>
                  <th className="py-2 pr-3 font-medium">Owner</th>
                  <th className="py-2 pr-3 font-medium">Role</th>
                  <th className="py-2 pr-3 font-medium">Dates</th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {roomOwners.map((link) => (
                  <tr className="border-b border-[var(--border)]" key={link.id}>
                    <td className="py-2 pr-3">{link.rooms?.room_number ?? "-"}</td>
                    <td className="py-2 pr-3">{link.owners?.full_name ?? "-"}</td>
                    <td className="py-2 pr-3">{link.ownership_role}</td>
                    <td className="py-2 pr-3">
                      {link.starts_at ?? "Not set"} - {link.ends_at ?? "Current"}
                    </td>
                    <td className="py-2">
                      {!link.ends_at ? (
                        <form action={endRoomOwnerLink} className="flex gap-2">
                          <input name="id" type="hidden" value={link.id} />
                          <input
                            className="w-36 rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                            name="ends_at"
                            type="date"
                          />
                          <button
                            className="text-sm font-medium text-red-700"
                            type="submit"
                          >
                            End
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserCheck className="text-[var(--primary)]" size={20} />
            <h2 className="text-lg font-semibold">Proxy Authorizations</h2>
          </div>
          <form
            action={createProxyAuthorization}
            className="grid gap-3 md:grid-cols-3"
          >
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="meeting_id"
              required
            >
              <option value="">Meeting</option>
              {meetings
                .filter((meeting) => meeting.status !== "archived")
                .map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {meeting.title}
                  </option>
                ))}
            </select>
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="room_id"
              required
            >
              <option value="">Room</option>
              {rooms
                .filter((room) => room.active)
                .map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.room_number}
                  </option>
                ))}
            </select>
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="owner_id"
            >
              <option value="">Owner optional</option>
              {owners
                .filter((owner) => owner.active)
                .map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.full_name}
                  </option>
                ))}
            </select>
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="proxy_profile_id"
              required
            >
              <option value="">Proxy profile</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name} ({profile.email})
                </option>
              ))}
            </select>
            <label className="text-sm font-medium">
              Valid from
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="valid_from"
                type="date"
              />
            </label>
            <label className="text-sm font-medium">
              Valid until
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="valid_until"
                type="date"
              />
            </label>
            <button
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] md:col-span-3"
              type="submit"
            >
              Add proxy authorization
            </button>
          </form>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Meeting</th>
                  <th className="py-2 pr-3 font-medium">Room</th>
                  <th className="py-2 pr-3 font-medium">Owner</th>
                  <th className="py-2 pr-3 font-medium">Proxy</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {proxyAuthorizations.map((authorization) => (
                  <tr
                    className="border-b border-[var(--border)]"
                    key={authorization.id}
                  >
                    <td className="py-2 pr-3">
                      {authorization.meetings?.title ?? "-"}
                    </td>
                    <td className="py-2 pr-3">
                      {authorization.rooms?.room_number ?? "-"}
                    </td>
                    <td className="py-2 pr-3">
                      {authorization.owners?.full_name ?? "-"}
                    </td>
                    <td className="py-2 pr-3">
                      {authorization.profiles?.full_name ?? "-"}
                    </td>
                    <td className="py-2 pr-3">{authorization.status}</td>
                    <td className="py-2">
                      <form
                        action={reviewProxyAuthorization}
                        className="flex flex-wrap gap-2"
                      >
                        <input name="id" type="hidden" value={authorization.id} />
                        <select
                          className="rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                          defaultValue={authorization.status}
                          name="status"
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                          <option value="revoked">Revoked</option>
                        </select>
                        <button
                          className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                          type="submit"
                        >
                          Review
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold">Registered Profiles</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 pr-3 font-medium">Default status</th>
                  <th className="py-2 pr-3 font-medium">Approval</th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr className="border-b border-[var(--border)]" key={profile.id}>
                    <td className="py-2 pr-3">{profile.full_name}</td>
                    <td className="py-2 pr-3">{profile.email}</td>
                    <td className="py-2 pr-3">{profile.default_status}</td>
                    <td className="py-2 pr-3">{profile.approval_status}</td>
                    <td className="py-2">
                      <form
                        action={updateProfileApproval}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input name="id" type="hidden" value={profile.id} />
                        <select
                          className="rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                          defaultValue={profile.default_status}
                          name="default_status"
                        >
                          <option value="owner">Owner</option>
                          <option value="resident">Resident</option>
                          <option value="proxy">Proxy</option>
                        </select>
                        <select
                          className="rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                          defaultValue={profile.approval_status}
                          name="approval_status"
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                        <button
                          className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                          type="submit"
                        >
                          Save
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            {profiles.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                No profiles have logged in yet.
              </p>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}

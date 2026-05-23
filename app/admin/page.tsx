import { Building2, ShieldCheck, UserRound } from "lucide-react";
import {
  createOwner,
  createRoom,
  deactivateOwner,
  deactivateRoom,
} from "@/features/admin/actions";
import { getAdminDashboardData } from "@/features/admin/data";

export default async function AdminPage() {
  const { rooms, owners, profiles } = await getAdminDashboardData();
  const activeRooms = rooms.filter((room) => room.active).length;
  const activeOwners = owners.filter((owner) => owner.active).length;

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
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{activeRooms}</div>
              <div className="text-[var(--muted)]">Active rooms</div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{activeOwners}</div>
              <div className="text-[var(--muted)]">Active owners</div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{profiles.length}</div>
              <div className="text-[var(--muted)]">Profiles</div>
            </div>
          </div>
        </div>

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
          <h2 className="text-lg font-semibold">Registered Profiles</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 pr-3 font-medium">Default status</th>
                  <th className="py-2 font-medium">Approval</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr className="border-b border-[var(--border)]" key={profile.id}>
                    <td className="py-2 pr-3">{profile.full_name}</td>
                    <td className="py-2 pr-3">{profile.email}</td>
                    <td className="py-2 pr-3">{profile.default_status}</td>
                    <td className="py-2">{profile.approval_status}</td>
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

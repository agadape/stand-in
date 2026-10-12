import type { Metadata } from "next";
import Link from "next/link";
import { CreateRoom } from "@/components/room-gate";
import { Pill } from "@/components/ui";
import { listRooms } from "@/lib/met";

export const metadata: Metadata = { title: "Rooms" };
export const dynamic = "force-dynamic";

/** Every room on the contract, newest first. */
export default async function RoomsPage() {
  const rooms = await listRooms();
  return (
    <div className="narrow space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Rooms</h1>
        <p className="text-muted">
          A room lets you in only if enough of its members have met you. No invite link, no email: the contract
          counts the people you have actually stood next to.
        </p>
      </div>

      {rooms.length === 0 ? (
        <p className="text-sm text-muted">No rooms yet. Open the first one.</p>
      ) : (
        <ul className="space-y-2">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link href={`/r/${room.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{room.name}</p>
                  <p className="text-xs text-muted">
                    Met by {room.threshold} {room.threshold === 1 ? "member" : "members"}
                    {room.inPersonOnly ? ", in person" : ""}
                  </p>
                </div>
                <Pill>
                  {room.members.length} {room.members.length === 1 ? "member" : "members"}
                </Pill>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CreateRoom />
    </div>
  );
}

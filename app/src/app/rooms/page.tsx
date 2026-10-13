import type { Metadata } from "next";
import Link from "next/link";
import { CreateRoom } from "@/components/room-gate";
import { Pet } from "@/components/pet";
import { EmptyState, PageHeader, Pill, SectionTitle } from "@/components/ui";
import { listRooms } from "@/lib/met";

export const metadata: Metadata = { title: "Rooms" };
export const dynamic = "force-dynamic";

/** Every room on the contract, newest first. */
export default async function RoomsPage() {
  const rooms = await listRooms();
  return (
    <div className="narrow space-y-6">
      <PageHeader tone="blue" eyebrow="Rooms" title="Get in by who you&apos;ve met" art={<Pet mood="suspicious" hue={200} />}>
        A room lets you in only if enough of its members have met you. No invite link, no email: the contract counts
        the people you have actually stood next to.
      </PageHeader>

      {rooms.length === 0 ? (
        <EmptyState art={<Pet mood="idle" hue={200} />} title="No rooms yet">
          Open the first one below.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          <li>
            <SectionTitle icon="🚪">Open rooms · {rooms.length}</SectionTitle>
          </li>
          {rooms.map((room) => (
            <li key={room.id}>
              <Link href={`/r/${room.id}`} className="tile">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#cdeeff] text-lg">
                  🚪
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">{room.name}</p>
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

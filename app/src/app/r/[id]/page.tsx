import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RoomGate } from "@/components/room-gate";
import { Address, Card } from "@/components/ui";
import { explorerAddress, metAddress } from "@/lib/chain";
import { getRoom, petsByAddress } from "@/lib/met";

type Props = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

async function load(params: Props["params"]) {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? getRoom(id) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const room = await load(params);
  return { title: room ? room.name : "Not found" };
}

/** One room: its rule, who is in, and the gate. */
export default async function RoomPage({ params }: Props) {
  const room = await load(params);
  if (!room) notFound();
  const pets = await petsByAddress(room.members);

  return (
    <div className="narrow space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-strong">Met-gated room</p>
        <h1 className="text-4xl font-semibold tracking-tight">{room.name}</h1>
        <p className="text-muted">
          You can join if at least {room.threshold} {room.threshold === 1 ? "member has" : "members have"} met you
          {room.inPersonOnly ? " in person, by scanning a fresh code." : ", in person or by link."}
          {room.members.length < room.threshold && " While the room is smaller than that, every member must have."}
        </p>
      </div>

      <RoomGate roomId={room.id} roomName={room.name} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Members · {room.members.length}</h2>
        <ul className="space-y-2">
          {room.members.map((address) => {
            const pet = pets.get(address.toLowerCase());
            return (
              <li key={address} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                {pet ? (
                  <Link href={`/t/${pet.slug}`} className="font-medium">
                    {pet.name}
                  </Link>
                ) : (
                  <span className="text-muted">A pet from elsewhere</span>
                )}
                <Address value={address} />
              </li>
            );
          })}
        </ul>
      </section>

      <Card className="text-sm text-muted">
        The rule and the member list live in the{" "}
        <a href={explorerAddress(metAddress())} target="_blank" rel="noreferrer" className="text-foreground underline decoration-dotted">
          ProofOfMet contract
        </a>
        . Any app can ask it the same question with <span className="font-mono text-xs">canJoin(roomId, pet)</span>.
      </Card>
    </div>
  );
}

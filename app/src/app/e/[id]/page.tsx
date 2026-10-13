import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JoinGathering } from "@/components/gathering";
import { Pet } from "@/components/pet";
import { PageHeader } from "@/components/ui";
import { WallGraph } from "@/components/wall-graph";
import { wall } from "@/lib/wall";

type Props = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

async function load(params: Props["params"]) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const data = await wall(id);
  return data.gathering ? { id, data, gathering: data.gathering } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load(params);
  return { title: found ? found.gathering.name : "Not found" };
}

const clock = (seconds: number) =>
  new Date(seconds * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

/** One gathering: its own live wall, and the way in for people who are there. */
export default async function GatheringPage({ params }: Props) {
  const found = await load(params);
  if (!found) notFound();
  const { id, data, gathering } = found;
  const open = gathering.open;

  return (
    <div className="space-y-6">
      <PageHeader tone={open ? "green" : "gold"} eyebrow={`Gathering · ${open ? "on now" : "ended"}`} title={gathering.name} art={<Pet mood={open ? "victory" : "idle"} kind="bee" />}>
        {clock(gathering.startsAt)} to {clock(gathering.endsAt)} UTC. Meetings made with a code shown for this gathering
        are stamped with it on-chain.
      </PageHeader>

      <JoinGathering gatheringId={id} open={open} />
      <WallGraph initial={data} gatheringId={id} />
    </div>
  );
}

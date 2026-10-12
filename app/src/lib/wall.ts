import { getGathering, meetings, petsByAddress } from "./met";

/**
 * The meeting graph for the live wall: pets as nodes, meetings as edges, read from the
 * contract on every request. Names come from our database; a pet we don't know (someone
 * else writing to the same contract) shows as a short address.
 */
export async function wall(gatheringId: number) {
  const [meets, gathering] = await Promise.all([meetings(gatheringId), gatheringId ? getGathering(gatheringId) : null]);
  const addresses = [...new Set(meets.flatMap((m) => [m.a, m.b]))];
  const pets = await petsByAddress(addresses);
  const nodes = addresses.map((address) => {
    const pet = pets.get(address.toLowerCase());
    return { address, name: pet?.name ?? `${address.slice(0, 6)}…`, slug: pet?.slug ?? null };
  });
  return {
    gathering: gathering && { id: gathering.id, name: gathering.name, startsAt: gathering.startsAt, endsAt: gathering.endsAt },
    nodes,
    edges: meets.map((m) => ({ a: m.a, b: m.b, at: m.at, inPerson: m.inPerson })),
    counts: { meets: meets.length, pets: nodes.length, inPerson: meets.filter((m) => m.inPerson).length },
  };
}

export type Wall = Awaited<ReturnType<typeof wall>>;

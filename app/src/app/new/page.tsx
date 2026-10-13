import type { Metadata } from "next";
import { CreateTwin } from "@/components/create-twin";
import { env } from "@/lib/env";
import { judgeProvider, type Provider } from "@/lib/llm";

export const metadata: Metadata = { title: "Make your pet" };

export default async function NewTwinPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // Named in the privacy note, which has to be true for the judge this server runs. The
  // default judge counts habits and uses no model; the older one sends the texts to a
  // provider. Unknown is fine: the note then just says "an AI model".
  let judge: Provider | "stylometry" | null = null;
  try {
    judge = env().JUDGE === "stylometry" ? "stylometry" : judgeProvider();
  } catch {}
  // Someone who scanned a code without having a pet comes back to that meeting afterwards.
  const { next } = await searchParams;
  const backTo = next && /^\/t\/[a-z0-9-]+\/meet$/.test(next) ? next : null;
  return <CreateTwin judge={judge} next={backTo} />;
}

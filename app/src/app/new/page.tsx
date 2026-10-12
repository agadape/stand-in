import type { Metadata } from "next";
import { CreateTwin } from "@/components/create-twin";
import { judgeProvider, type Provider } from "@/lib/llm";

export const metadata: Metadata = { title: "Make your twin" };

export default async function NewTwinPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // Named in the privacy note. Unknown is fine: the note then just says "an AI model".
  let judge: Provider | null = null;
  try {
    judge = judgeProvider();
  } catch {}
  // Someone who scanned a code without having a pet comes back to that meeting afterwards.
  const { next } = await searchParams;
  const backTo = next && /^\/t\/[a-z0-9-]+\/meet$/.test(next) ? next : null;
  return <CreateTwin judge={judge} next={backTo} />;
}

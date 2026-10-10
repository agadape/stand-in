import type { Metadata } from "next";
import { CreateTwin } from "@/components/create-twin";
import { judgeProvider, type Provider } from "@/lib/llm";

export const metadata: Metadata = { title: "Make your twin" };

export default function NewTwinPage() {
  // Named in the privacy note. Unknown is fine: the note then just says "an AI model".
  let judge: Provider | null = null;
  try {
    judge = judgeProvider();
  } catch {}
  return <CreateTwin judge={judge} />;
}

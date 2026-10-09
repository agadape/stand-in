import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Verdict } from "@/components/verdict";
import { attemptRecord } from "@/lib/twins";

type Props = { params: Promise<{ slug: string; id: string }> };

async function load(params: Props["params"]) {
  const { slug, id } = await params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric)) return null;
  const record = await attemptRecord(numeric);
  return record && record.twin.slug === slug ? record : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const record = await load(params);
  if (!record) return { title: "Not found" };
  const title =
    record.mode === "owner"
      ? `${record.twin.name} set the bar at ${(record.scoreBps / 100).toFixed(1)}%`
      : `${record.displayName} ${record.passed ? "passed as" : "tried to be"} ${record.twin.name}`;
  return { title, description: `"${record.llm.verdictLine}"` };
}

/** A shareable, verifiable record of one attempt. */
export default async function AttemptPage({ params }: Props) {
  const record = await load(params);
  if (!record) notFound();

  return (
    <Verdict
      result={{
        id: record.id,
        mode: record.mode,
        scoreBps: record.scoreBps,
        ownerScoreBps: record.twin.ownerScoreBps,
        passed: record.passed,
        paidWei: record.paidWei,
        llm: record.llm,
        styleNotes: record.styleNotes,
        styleSimilarity: record.similarity,
        verdictHash: record.verdictHash,
        judgeModel: record.judgeModel,
        txUrl: record.txUrl,
      }}
      twinName={record.twin.name}
      slug={record.twin.slug}
      scenarios={record.scenarios}
      answers={record.answers}
      displayName={record.displayName}
    />
  );
}

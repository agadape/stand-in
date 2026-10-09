"use client";

import { useState } from "react";
import { createPublicClient, http, keccak256, parseEventLogs, stringToHex, type Hex } from "viem";
import { api } from "@/lib/api";
import { chainById } from "@/lib/chains";
import { standInAbi } from "@/lib/standin-abi";
import { Button, Card } from "./ui";

type Outcome =
  | { state: "idle" }
  | { state: "working"; step: string }
  | { state: "done"; recomputed: Hex; onchain: Hex; match: boolean; block: bigint; explorerTx: string }
  | { state: "failed"; message: string };

const chain = chainById(Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143));
const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL ?? chain.rpcUrls.default.http[0];

/**
 * Proves, in the player's own browser, that the verdict they're looking at is the one
 * the twin's wallet recorded on Monad: refetch the stored verdict, recompute its keccak
 * hash with the same fields the server hashed, read the hash out of the transaction's
 * event log straight from the RPC, and compare. No trust in this app's server needed.
 */
export function VerifyVerdict({ attemptId }: { attemptId: number }) {
  const [outcome, setOutcome] = useState<Outcome>({ state: "idle" });

  async function verify() {
    try {
      setOutcome({ state: "working", step: "Fetching the stored verdict…" });
      const { attempt } = await api.getAttempt(attemptId);

      // Must mirror judge.ts exactly: same fields, same order.
      const recomputed = keccak256(
        stringToHex(
          JSON.stringify({
            scenarios: attempt.scenarioIds,
            answers: attempt.answers,
            llm: attempt.llm,
            similarity: attempt.similarity,
            scoreBps: attempt.scoreBps,
          }),
        ),
      );

      setOutcome({ state: "working", step: "Reading the transaction from Monad…" });
      const client = createPublicClient({ chain, transport: http(rpcUrl) });
      const receipt = await client.getTransactionReceipt({ hash: attempt.txHash as Hex });
      const eventName = attempt.mode === "owner" ? "OwnerProven" : "Attempt";
      const [log] = parseEventLogs({ abi: standInAbi, logs: receipt.logs, eventName });
      if (!log) throw new Error(`No ${eventName} event in that transaction`);
      const onchain = log.args.verdictHash;

      setOutcome({
        state: "done",
        recomputed,
        onchain,
        match: recomputed.toLowerCase() === onchain.toLowerCase(),
        block: receipt.blockNumber,
        explorerTx: attempt.txUrl,
      });
    } catch (error) {
      setOutcome({ state: "failed", message: error instanceof Error ? error.message : "Verification failed" });
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">Verify this verdict</h2>
        <p className="mt-1 text-sm text-muted">
          Recomputes the verdict&apos;s hash in your browser and compares it with the one the twin&apos;s wallet
          wrote on Monad. If they match, nobody edited the verdict after the fact.
        </p>
      </div>

      {outcome.state === "done" ? (
        <div className={`space-y-2 rounded-2xl px-4 py-3 text-sm ${outcome.match ? "bg-ok/15" : "bg-bad/15"}`}>
          <p className={`font-semibold ${outcome.match ? "text-ok" : "text-bad"}`}>
            {outcome.match ? "Match. This verdict is the one on-chain." : "Mismatch. The stored verdict differs from the chain."}
          </p>
          <p className="break-all font-mono text-xs text-muted">recomputed {outcome.recomputed}</p>
          <p className="break-all font-mono text-xs text-muted">on-chain {outcome.onchain}</p>
          <p className="text-xs text-muted">
            Block {outcome.block.toString()} ·{" "}
            <a href={outcome.explorerTx} target="_blank" rel="noreferrer" className="underline decoration-dotted">
              transaction
            </a>
          </p>
        </div>
      ) : outcome.state === "failed" ? (
        <p className="rounded-2xl bg-bad/10 px-4 py-3 text-sm text-bad">{outcome.message}</p>
      ) : null}

      <Button variant="secondary" onClick={verify} loading={outcome.state === "working"}>
        {outcome.state === "working" ? outcome.step : outcome.state === "done" ? "Verify again" : "Verify on Monad"}
      </Button>
    </Card>
  );
}

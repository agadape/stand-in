import { parseEther, parseEventLogs, type Address, type Hex } from "viem";
import { publicClient, standInAddress } from "./chain";
import { env } from "./env";
import { standInAbi } from "./standin-abi";
import { ensureGas, funderWallet, twinAccount, twinWallet } from "./twin-wallet";

/** The twin registers itself on-chain and names its owner. */
export async function registerTwin(slug: string, owner: Address, personaHash: Hex) {
  const account = twinAccount(slug);
  await ensureGas(account.address);

  const hash = await twinWallet(slug).writeContract({
    address: standInAddress(),
    abi: standInAbi,
    functionName: "createTwin",
    args: [owner, personaHash],
  });
  const receipt = await publicClient().waitForTransactionReceipt({ hash });
  const [created] = parseEventLogs({ abi: standInAbi, logs: receipt.logs, eventName: "TwinCreated" });
  if (!created) throw new Error("TwinCreated event missing from receipt");

  return { twinAddress: account.address, chainTwinId: Number(created.args.twinId), txHash: hash };
}

export async function postOwnerProof(slug: string, chainTwinId: number, scoreBps: number, verdictHash: Hex) {
  await ensureGas(twinAccount(slug).address);
  const hash = await twinWallet(slug).writeContract({
    address: standInAddress(),
    abi: standInAbi,
    functionName: "proveOwner",
    args: [BigInt(chainTwinId), scoreBps, verdictHash],
  });
  await publicClient().waitForTransactionReceipt({ hash });
  return hash;
}

/** Records a challenger's score. If it beats the owner, the contract pays the pot in the same tx. */
export async function postVerdict(
  slug: string,
  chainTwinId: number,
  challenger: Address,
  scoreBps: number,
  verdictHash: Hex,
) {
  await ensureGas(twinAccount(slug).address);
  const hash = await twinWallet(slug).writeContract({
    address: standInAddress(),
    abi: standInAbi,
    functionName: "submitVerdict",
    args: [BigInt(chainTwinId), challenger, scoreBps, verdictHash],
  });
  const receipt = await publicClient().waitForTransactionReceipt({ hash });
  const [paid] = parseEventLogs({ abi: standInAbi, logs: receipt.logs, eventName: "Paid" });
  return { txHash: hash, paidWei: paid ? paid.args.amount : 0n };
}

/** Demo money: the funder wallet sweetens a twin's pot so judges can see a payout. */
export async function fundDemoPot(chainTwinId: number) {
  const hash = await funderWallet().writeContract({
    address: standInAddress(),
    abi: standInAbi,
    functionName: "fund",
    args: [BigInt(chainTwinId)],
    value: parseEther(String(env().DEMO_POT_MON)),
  });
  await publicClient().waitForTransactionReceipt({ hash });
  return hash;
}

export async function readTwin(chainTwinId: number) {
  return publicClient().readContract({
    address: standInAddress(),
    abi: standInAbi,
    functionName: "getTwin",
    args: [BigInt(chainTwinId)],
  });
}

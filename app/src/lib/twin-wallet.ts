import { concatHex, formatEther, keccak256, parseEther, stringToHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publicClient, walletFor } from "./chain";
import { env } from "./env";

/**
 * A twin's wallet is derived from the server seed and the twin's slug, so it can be
 * recreated from the slug alone and never needs to be stored. In the next version the
 * owner's passkey (Mera PRF, a salt per twin) derives this key instead of the server.
 */
export function twinPrivateKey(slug: string): Hex {
  return keccak256(concatHex([env().TWIN_KEY_SEED as Hex, stringToHex(`standin:twin:${slug}`)]));
}

export function twinAccount(slug: string) {
  return privateKeyToAccount(twinPrivateKey(slug));
}

export function twinWallet(slug: string) {
  return walletFor(twinPrivateKey(slug));
}

export function funderWallet() {
  return walletFor(env().FUNDER_PRIVATE_KEY as Hex);
}

/**
 * Monad's consensus checks a sender's balance against execution state k=3 blocks behind
 * the tip (docs: developer-essentials/reserve-balance), so a wallet funded a moment ago
 * is rejected as "insufficient balance" even though eth_getBalance already shows the
 * money. Two seconds is ~5 blocks of headroom.
 */
const SETTLE_MS = 2000;

/** Tops the twin's wallet up with gas when it runs low. Returns the top-up tx hash, if any. */
export async function ensureGas(address: Address): Promise<Hex | null> {
  const client = publicClient();
  const min = parseEther(String(env().TWIN_GAS_MIN_MON));
  if ((await client.getBalance({ address })) >= min) return null;

  const hash = await funderWallet().sendTransaction({
    to: address,
    value: parseEther(String(env().TWIN_GAS_TOPUP_MON)),
  });
  await client.waitForTransactionReceipt({ hash });
  await waitForBalance(address, min);
  await sleep(SETTLE_MS);
  return hash;
}

async function waitForBalance(address: Address, min: bigint, timeoutMs = 15_000) {
  const client = publicClient();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await client.getBalance({ address })) >= min) return;
    await sleep(500);
  }
  throw new Error(`Twin wallet ${address} still shows no gas after its top-up`);
}

/**
 * Retries a send rejected for a balance or nonce the node hasn't caught up with. The
 * sender receives the attempt number and must vary the fee with it: an identical
 * re-signed transaction has the same hash and the node just repeats its first answer.
 */
export async function withSendRetry<T>(send: (attempt: number) => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await send(attempt);
    } catch (error) {
      lastError = error;
      if (!/insufficient balance|insufficient funds|nonce too low|already known|replacement transaction/i.test(describe(error))) {
        throw error;
      }
      await sleep(SETTLE_MS * (attempt + 1));
    }
  }
  throw lastError;
}

function describe(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const details = (error as { details?: unknown }).details;
  return `${error.message} ${typeof details === "string" ? details : ""}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mon(wei: bigint) {
  return formatEther(wei);
}

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

/** Tops the twin's wallet up with gas when it runs low. Returns the top-up tx hash, if any. */
export async function ensureGas(address: Address): Promise<Hex | null> {
  const client = publicClient();
  const balance = await client.getBalance({ address });
  if (balance >= parseEther(String(env().TWIN_GAS_MIN_MON))) return null;

  const hash = await funderWallet().sendTransaction({
    to: address,
    value: parseEther(String(env().TWIN_GAS_TOPUP_MON)),
  });
  await client.waitForTransactionReceipt({ hash });
  return hash;
}

export function mon(wei: bigint) {
  return formatEther(wei);
}

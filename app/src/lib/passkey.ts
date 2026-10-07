"use client";

import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  getEvmAddress,
  getPasskeyPrfOutput,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import type { Address, Hex, LocalAccount } from "viem";
import { ownerMessage } from "./auth";

/**
 * A passkey is the whole account. Mera's PRF output (32 bytes the authenticator derives
 * from the credential and the relying-party id) seeds an ordinary EVM account, so the
 * same Face ID or fingerprint reproduces the same address on every device, and nothing
 * is stored anywhere. Players never need gas: the twin's wallet sends every transaction
 * and pays challengers directly.
 */
export type PasskeyAccount = {
  address: Address;
  account: LocalAccount;
  /** Zeroes the in-memory key. Call when the player is done signing. */
  end: () => void;
};

const APP_NAME = "Stand-In";
const PATH = "m/44'/60'/0'/0/0";

function rpId() {
  return window.location.hostname;
}

function deriveAccount(prfOutput: Uint8Array): PasskeyAccount {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive(PATH);
  if (!node.privateKey) throw new Error("Passkey produced no key");
  const session = createSecp256k1SigningSession({ privateKey: node.privateKey });
  return {
    address: getEvmAddress(session.publicKey) as Address,
    account: toViemAccount(session),
    end: () => session.end(),
  };
}

/** First visit: one passkey ceremony creates the credential and the account. */
export async function createPasskeyAccount(displayName: string): Promise<PasskeyAccount> {
  const { prfOutput } = await createPasskeyWithPrfOutput({
    rp: { id: rpId(), name: APP_NAME },
    user: { name: displayName, displayName },
  });
  return deriveAccount(prfOutput);
}

/** Later visits: one assertion ceremony reproduces the same account. */
export async function signInWithPasskey(): Promise<PasskeyAccount> {
  const { prfOutput } = await getPasskeyPrfOutput({ rpId: rpId() });
  return deriveAccount(prfOutput);
}

/** Owners prove they control the twin's owner address by signing a short, dated message. */
export async function signOwnerProof(
  passkey: PasskeyAccount,
  slug: string,
  action: "prove" | "fund",
): Promise<{ issuedAt: number; signature: Hex }> {
  const issuedAt = Date.now();
  const signature = await passkey.account.signMessage({ message: ownerMessage(slug, action, issuedAt) });
  return { issuedAt, signature };
}

export function passkeysSupported() {
  return typeof window !== "undefined" && "PublicKeyCredential" in window && window.isSecureContext;
}

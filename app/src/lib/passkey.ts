"use client";

import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  getEvmAddress,
  getPasskeyPrfOutput,
  isMeraError,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import type { Address, Hex, LocalAccount } from "viem";
import { ownerMessage, type OwnerAction } from "./auth";

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

/**
 * Which passkey this device last used here: its id and how to reach it. Not a secret (a
 * site learns a credential's id every time it is used); it lets the next prompt ask for
 * that passkey by name, which is steadier than asking the device to offer whatever it has.
 */
const REMEMBERED = "standin:passkey";
type Remembered = { credentialId: string; transports?: string[] };

function remembered(): Remembered | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(REMEMBERED) ?? "null") as Remembered | null;
    return raw && typeof raw.credentialId === "string" && raw.credentialId ? raw : null;
  } catch {
    return null;
  }
}

function remember(value: Remembered | null) {
  try {
    if (value) window.localStorage.setItem(REMEMBERED, JSON.stringify(value));
    else window.localStorage.removeItem(REMEMBERED);
  } catch {
    // Blocked storage: the next prompt just offers every passkey, as before.
  }
}

/**
 * Forget which passkey this device last used. Called when that passkey turned out not to
 * own the pet in question, so the next prompt offers every passkey instead of the wrong one.
 */
export function forgetPasskey() {
  remember(null);
}

/**
 * Why a passkey prompt failed, in words someone can act on. The library reports every
 * browser failure as "Passkey assertion failed" and keeps the reason in `cause`; this
 * brings the reason back, and ends with the browser's own name for it so a failure
 * pasted to the team says what happened.
 */
function passkeyError(error: unknown, doing: "create" | "use"): Error {
  const cause = isMeraError(error) ? (error.cause ?? error) : error;
  const name = cause instanceof Error ? cause.name : "";
  const detail = cause instanceof Error ? `${cause.name}: ${cause.message}`.slice(0, 180) : String(cause).slice(0, 180);
  const code = isMeraError(error) ? error.code : "";
  let say: string;
  if (code === "PRF_UNAVAILABLE") {
    say = "This passkey can't do what Stand-In needs from it. Use a passkey kept in iCloud Keychain, Google Password Manager, 1Password or Windows Hello.";
  } else if (name === "NotAllowedError") {
    say =
      doing === "create"
        ? "The passkey prompt was closed or timed out before it finished. Try again."
        : "The passkey prompt was closed or timed out, or this device has no Stand-In passkey to offer. Try again, and choose the passkey you made your pet with. If you made your pet on another device, use that one.";
  } else if (name === "SecurityError") {
    say = "This passkey belongs to a different address than the one in your browser's address bar. Open Stand-In at the address where you made your pet.";
  } else if (name === "InvalidStateError" || name === "AbortError") {
    say = "Another passkey prompt was already open. Close it and try again.";
  } else if (name === "NotSupportedError") {
    say = "This browser can't use passkeys the way Stand-In needs. Try Safari on iOS 18 or later, Chrome on Android, or a desktop browser with a password manager.";
  } else {
    say = doing === "create" ? "Couldn't make the passkey." : "Couldn't use the passkey.";
  }
  return new Error(`${say} (${detail})`, { cause: error });
}

/** First visit: one passkey ceremony creates the credential and the account. */
export async function createPasskeyAccount(displayName: string): Promise<PasskeyAccount> {
  try {
    const { prfOutput, credentialId, transports } = await createPasskeyWithPrfOutput({
      rp: { id: rpId(), name: APP_NAME },
      user: { name: displayName, displayName },
    });
    remember({ credentialId, ...(transports ? { transports: [...transports] } : {}) });
    return deriveAccount(prfOutput);
  } catch (error) {
    throw passkeyError(error, "create");
  }
}

/** Later visits: one assertion ceremony reproduces the same account. */
export async function signInWithPasskey(): Promise<PasskeyAccount> {
  const known = remembered();
  try {
    const { prfOutput, credentialId } = await getPasskeyPrfOutput({ rpId: rpId(), ...(known ? { credential: known } : {}) });
    // Keep how to reach it if it is the same passkey; a different one starts fresh.
    remember(known?.credentialId === credentialId ? known : { credentialId });
    return deriveAccount(prfOutput);
  } catch (error) {
    // If asking for the remembered passkey is what failed, forget it: the next try lets
    // the device offer every passkey it has for this site.
    if (known) remember(null);
    throw passkeyError(error, "use");
  }
}

/** Owners prove they control the twin's owner address by signing a short, dated message. */
export async function signOwnerProof(
  passkey: PasskeyAccount,
  slug: string,
  action: OwnerAction,
): Promise<{ issuedAt: number; signature: Hex }> {
  const issuedAt = Date.now();
  const signature = await passkey.account.signMessage({ message: ownerMessage(slug, action, issuedAt) });
  return { issuedAt, signature };
}

export function passkeysSupported() {
  return typeof window !== "undefined" && "PublicKeyCredential" in window && window.isSecureContext;
}

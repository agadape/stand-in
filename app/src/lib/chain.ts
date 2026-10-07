import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chainById } from "./chains";
import { env } from "./env";

export { monadMainnet, monadTestnet } from "./chains";

export function chain() {
  return chainById(env().MONAD_CHAIN_ID);
}

export function publicClient() {
  return createPublicClient({ chain: chain(), transport: http(env().MONAD_RPC_URL) });
}

export function walletFor(privateKey: Hex) {
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: chain(),
    transport: http(env().MONAD_RPC_URL),
  });
}

export function standInAddress(): Address {
  return env().STANDIN_ADDRESS as Address;
}

export function explorerTx(hash: Hex) {
  return `${env().NEXT_PUBLIC_EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddress(address: Address) {
  return `${env().NEXT_PUBLIC_EXPLORER_URL}/address/${address}`;
}

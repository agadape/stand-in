import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "./env";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://testnet-rpc.monad.xyz"],
      webSocket: ["wss://testnet-rpc.monad.xyz"],
    },
  },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://testnet.monadvision.com" },
  },
  testnet: true,
});

export const monadMainnet = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.monad.xyz"], webSocket: ["wss://rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://monadvision.com" },
  },
});

export function chain() {
  return env().MONAD_CHAIN_ID === monadMainnet.id ? monadMainnet : monadTestnet;
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

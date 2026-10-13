import { parseEther, stringToHex, type Address, type Hex } from "viem";
import { publicClient } from "./chain";
import type { Twin } from "./db/schema";
import { env } from "./env";
import { ensureGas, funderWallet, tip, twinWallet, withSendRetry } from "./twin-wallet";
import type { WeatherKind } from "./weather";

/** Where weather fees go: the treasury if one is set, otherwise back to the funder wallet. */
export function treasury(): { address: Address; isFunder: boolean } {
  const set = env().TREASURY_ADDRESS as Address | undefined;
  return set ? { address: set, isFunder: false } : { address: funderWallet().account.address, isFunder: true };
}

/** The payment was sent but its receipt never arrived, so whether it was charged is unknown. */
export class PaymentUnconfirmed extends Error {
  constructor(public readonly hash: Hex) {
    super("The weather payment was sent but has not confirmed");
  }
}

/**
 * The pet's own wallet pays for the weather: a plain transfer to the treasury whose data
 * names what was bought, so the receipt can be read on the explorer. Same shape as
 * recordMeet in met.ts. Returns the hash once the transfer has been mined and succeeded.
 * Throws PaymentUnconfirmed if it was sent but not seen to land, and a plain error if
 * nothing was sent at all.
 */
export async function payForWeather(pet: Twin, kind: WeatherKind) {
  const from = pet.twinAddress as Address;
  const to = treasury().address;
  const value = parseEther(String(env().WORLD_WEATHER_FEE_MON));
  const data = stringToHex(`standin:weather:${kind}`);

  await ensureGas(from);
  // Monad charges for the gas limit, so ask what the transfer needs and add a tenth.
  const gas = await publicClient()
    .estimateGas({ account: from, to, value, data })
    .then((estimate) => (estimate * 110n) / 100n)
    .catch(() => 60_000n);
  const hash = await withSendRetry((attempt) => twinWallet(pet.slug).sendTransaction({ to, value, data, gas, ...tip(attempt) }));
  // From here a transaction exists. If we cannot see it land, we do not know that nothing was charged.
  const receipt = await publicClient()
    .waitForTransactionReceipt({ hash })
    .catch(() => {
      throw new PaymentUnconfirmed(hash);
    });
  if (receipt.status !== "success") throw new Error("The weather payment reverted");
  return hash;
}

import type { Metadata } from "next";
import { PasskeyCheck } from "@/components/passkey-check";

export const metadata: Metadata = { title: "Passkey check", robots: { index: false } };

/** A page for finding out why a passkey prompt fails on one particular device. */
export default function PasskeyCheckPage() {
  return <PasskeyCheck />;
}

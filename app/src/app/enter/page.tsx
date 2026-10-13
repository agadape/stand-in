import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Pet } from "@/components/pet";
import { RestorePet } from "@/components/soul-vault";
import { Card, LinkButton } from "@/components/ui";
import { sessionPet } from "@/lib/session-cookie";

export const metadata: Metadata = { title: "Enter the world" };
export const dynamic = "force-dynamic";

/** The door. The world is for people with a pet; this is where everyone else is sent. */
export default async function EnterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const to = next === "/world" ? next : "/world";
  if (await sessionPet()) redirect(to);
  return (
    <div className="narrow space-y-6 pt-6 text-center">
      <Pet mood="suspicious" className="mx-auto w-40" label="A pet eyeing you at the door" />
      <div className="space-y-2">
        <h1 className="text-4xl tracking-tight">The world is for residents</h1>
        <p className="text-muted">
          Only someone with a pet can go in. Make one, or prove an existing one is yours with its passkey.
        </p>
      </div>
      <Card className="space-y-3">
        <LinkButton href="/new">Make your pet</LinkButton>
        <RestorePet label="I already have a pet: sign in" />
        <p className="text-xs text-muted">
          No wallet app and no password. Your passkey (Face ID, fingerprint or your device&apos;s lock) is the account.
        </p>
      </Card>
    </div>
  );
}

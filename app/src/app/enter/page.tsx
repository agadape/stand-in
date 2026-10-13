import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Pet } from "@/components/pet";
import { RestorePet } from "@/components/soul-vault";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { safeNext, sessionPet } from "@/lib/session-cookie";

export const metadata: Metadata = { title: "Enter the world" };
export const dynamic = "force-dynamic";

/** The door. The world, rooms and the wall are for people with a pet; this is where everyone else is sent. */
export default async function EnterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const to = safeNext(next);
  if (await sessionPet()) redirect(to);
  return (
    <div className="narrow space-y-6 pt-2">
      <PageHeader tone="dusk" eyebrow="The door" title="The world is for residents" art={<Pet mood="suspicious" />}>
        Only someone with a pet can go in. Make one, or prove an existing one is yours with its passkey.
      </PageHeader>
      <Card className="space-y-3 text-center">
        <LinkButton href="/new">Make your pet</LinkButton>
        <RestorePet label="I already have a pet: sign in" next={to} />
        <p className="text-xs text-muted">
          No wallet app and no password. Your passkey (Face ID, fingerprint or your device&apos;s lock) is the account.
        </p>
      </Card>
    </div>
  );
}

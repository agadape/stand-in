import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";

/**
 * The pets an address owns: slug and name, both public already. This is what lets a
 * browser with nothing stored find its pet again from the passkey alone: the passkey
 * gives the address, and the address gives the pet.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return NextResponse.json({ error: "Not an address" }, { status: 400 });
  const rows = await db()
    .select({ slug: schema.twins.slug, name: schema.twins.name, ownerAddress: schema.twins.ownerAddress })
    .from(schema.twins)
    .where(eq(sql`lower(${schema.twins.ownerAddress})`, address.toLowerCase()))
    .all();
  return NextResponse.json({ pets: rows });
}

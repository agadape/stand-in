import { NextResponse } from "next/server";
import { sessionPetOf } from "@/lib/session-cookie";
import { wall } from "@/lib/wall";

export const dynamic = "force-dynamic";

/** The meeting graph as the live wall draws it. `?g=<id>` narrows it to one gathering. */
export async function GET(request: Request) {
  // The wall is for residents, like the world. (The graph itself is public on the contract;
  // what is kept in here is our pets' names against those addresses.)
  if (!(await sessionPetOf(request))) return NextResponse.json({ error: "Sign in with your pet's passkey to see the wall." }, { status: 401 });
  const g = Number(new URL(request.url).searchParams.get("g") ?? 0);
  return NextResponse.json(await wall(Number.isInteger(g) && g > 0 ? g : 0), { headers: { "cache-control": "no-store" } });
}

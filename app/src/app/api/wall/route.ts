import { NextResponse } from "next/server";
import { wall } from "@/lib/wall";

export const dynamic = "force-dynamic";

/** The meeting graph as the live wall draws it. `?g=<id>` narrows it to one gathering. */
export async function GET(request: Request) {
  const g = Number(new URL(request.url).searchParams.get("g") ?? 0);
  return NextResponse.json(await wall(Number.isInteger(g) && g > 0 ? g : 0), { headers: { "cache-control": "no-store" } });
}

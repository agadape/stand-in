import { NextResponse } from "next/server";
import { attemptRecord } from "@/lib/twins";

/** Public record of one attempt: what the verify button and the attempt page read. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric <= 0) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const record = await attemptRecord(numeric);
  if (!record) return NextResponse.json({ error: "No such attempt" }, { status: 404 });
  return NextResponse.json({ attempt: record });
}

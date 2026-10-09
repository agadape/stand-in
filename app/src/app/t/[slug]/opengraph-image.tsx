import { ImageResponse } from "next/og";
import { publicTwin, twinBySlug } from "@/lib/twins";

export const alt = "Be them. Your AI twin is the judge.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const pct = (bps: number) => `${(bps / 100).toFixed(0)}%`;

/** The card people see when a twin link lands in a chat. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const twin = await twinBySlug(slug);
  const card = twin ? await publicTwin(twin) : null;

  const name = card?.name ?? "Someone";
  const line = !card
    ? "This twin doesn't exist."
    : !card.ownerProven
      ? `${name} hasn't set the bar yet.`
      : card.attempts === 0
        ? `Bar: ${pct(card.ownerScoreBps)}. Nobody has tried yet.`
        : `Bar: ${pct(card.ownerScoreBps)}. ${card.attempts} tried, best impostor ${pct(card.bestScoreBps)}.`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0b0b12",
          color: "#f4f2ff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#a593ff", letterSpacing: 2, textTransform: "uppercase" }}>
          Stand-In · a party game on Monad
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 112, fontWeight: 700, lineHeight: 1 }}>Be {name}.</div>
          <div style={{ display: "flex", fontSize: 40, color: "#9a96b4" }}>{line}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: "#9a96b4" }}>
          <div style={{ display: "flex" }}>Answer three texts as {name}. Their AI twin decides.</div>
          {card && BigInt(card.potWei) > 0n ? (
            <div style={{ display: "flex", color: "#ffcc4d" }}>Pot {(Number(card.potWei) / 1e18).toFixed(2)} MON</div>
          ) : null}
        </div>
      </div>
    ),
    size,
  );
}

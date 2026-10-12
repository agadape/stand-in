import type { Outfit } from "@/lib/cosmetics";

export type Mood = "idle" | "happy" | "suspicious" | "shocked" | "victory";

const INK = "#151515";
const LIME = "#D7FF64";
const LIME_DEEP = "#B4DE3C";
const PAPER = "#F1EEE6";
const RED = "#FF5D50";
const GOLD = "#FFCC4D";

/**
 * The Stand-In pet: one creature, five moods, layered cosmetics. Plain SVG with no state,
 * so it renders on the server too. Motion is CSS only (see globals.css) and stops under
 * prefers-reduced-motion.
 */
export function Pet({
  mood = "idle",
  outfit = {},
  className = "",
  label,
}: {
  mood?: Mood;
  outfit?: Outfit;
  className?: string;
  /** Read out to screen readers; omit when the pet is decoration next to its name. */
  label?: string;
}) {
  const armsUp = mood === "victory";
  return (
    <svg
      viewBox="0 0 200 200"
      className={`pet pet-${mood} ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {outfit.aura === "aura" && (
        <g className="pet-aura" fill={PAPER}>
          {[
            [26, 44, 7],
            [176, 58, 9],
            [18, 130, 5],
            [184, 136, 6],
            [100, 10, 5],
          ].map(([x, y, r]) => (
            <path key={`${x}-${y}`} d={`M${x} ${y - r}L${x + r / 3} ${y - r / 3}L${x + r} ${y}L${x + r / 3} ${y + r / 3}L${x} ${y + r}L${x - r / 3} ${y + r / 3}L${x - r} ${y}L${x - r / 3} ${y - r / 3}Z`} />
          ))}
        </g>
      )}

      <g className="pet-body">
        {/* ears, feet and arms sit behind the body */}
        <circle cx="58" cy="52" r="17" fill={LIME_DEEP} />
        <circle cx="142" cy="52" r="17" fill={LIME_DEEP} />
        <ellipse cx="72" cy="182" rx="20" ry="9" fill={LIME_DEEP} />
        <ellipse cx="128" cy="182" rx="20" ry="9" fill={LIME_DEEP} />
        <ellipse cx={armsUp ? 24 : 28} cy={armsUp ? 84 : 128} rx="11" ry="17" fill={LIME_DEEP} transform={armsUp ? "rotate(-28 24 84)" : "rotate(18 28 128)"} />
        <ellipse cx={armsUp ? 176 : 172} cy={armsUp ? 84 : 128} rx="11" ry="17" fill={LIME_DEEP} transform={armsUp ? "rotate(28 176 84)" : "rotate(-18 172 128)"} />

        <path d="M100 34C148 34 174 72 174 118C174 160 146 184 100 184C54 184 26 160 26 118C26 72 52 34 100 34Z" fill={LIME} />
        <ellipse cx="100" cy="150" rx="40" ry="26" fill={PAPER} opacity="0.35" />
        <circle cx="52" cy="128" r="9" fill={RED} opacity="0.3" />
        <circle cx="148" cy="128" r="9" fill={RED} opacity="0.3" />

        <Face mood={mood} />

        {outfit.face === "glasses" && (
          <g fill="none" stroke={INK} strokeWidth="5">
            <circle cx="72" cy="104" r="24" />
            <circle cx="128" cy="104" r="24" />
            <path d="M96 102Q100 98 104 102" strokeLinecap="round" />
          </g>
        )}

        {outfit.neck === "bowtie" && (
          <g>
            <path d="M100 166L76 154V178Z" fill={RED} />
            <path d="M100 166L124 154V178Z" fill={RED} />
            <circle cx="100" cy="166" r="6" fill={INK} />
          </g>
        )}

        {outfit.head === "partyhat" && (
          <g>
            <path d="M100 0L126 44H74Z" fill={RED} />
            <path d="M89 20L111 20L117 30L83 30Z" fill={PAPER} />
            <circle cx="100" cy="2" r="6" fill={PAPER} />
          </g>
        )}
        {outfit.head === "crown" && (
          <g>
            <path d="M68 44L64 14L84 28L100 8L116 28L136 14L132 44Z" fill={GOLD} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
            <circle cx="100" cy="32" r="4" fill={RED} />
          </g>
        )}
      </g>
    </svg>
  );
}

function Face({ mood }: { mood: Mood }) {
  const closed = mood === "happy" || mood === "victory";
  const big = mood === "shocked";
  return (
    <g>
      {closed ? (
        <g fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round">
          <path d="M58 108Q72 90 86 108" />
          <path d="M114 108Q128 90 142 108" />
        </g>
      ) : (
        <g className="pet-eyes">
          <ellipse cx="72" cy="104" rx="16" ry={big ? 22 : 19} fill="#fff" />
          <ellipse cx="128" cy="104" rx="16" ry={big ? 22 : 19} fill="#fff" />
          <circle cx={mood === "suspicious" ? 79 : 72} cy={mood === "suspicious" ? 108 : 106} r={big ? 5 : 8} fill={INK} />
          <circle cx={mood === "suspicious" ? 135 : 128} cy={mood === "suspicious" ? 108 : 106} r={big ? 5 : 8} fill={INK} />
          {mood === "suspicious" && (
            <g>
              {/* half-closed lids and one raised brow */}
              <path d="M54 84H90V102H54Z" fill={LIME} />
              <path d="M110 84H146V98H110Z" fill={LIME} />
              <path d="M56 102H88" stroke={INK} strokeWidth="5" strokeLinecap="round" />
              <path d="M112 98H144" stroke={INK} strokeWidth="5" strokeLinecap="round" />
              <path d="M112 80L144 72" stroke={INK} strokeWidth="5" strokeLinecap="round" />
            </g>
          )}
        </g>
      )}

      {mood === "idle" && <path d="M88 138Q100 148 112 138" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />}
      {mood === "happy" && <path d="M84 134Q100 156 116 134Z" fill={INK} />}
      {mood === "victory" && (
        <g>
          <path d="M80 132Q100 162 120 132Z" fill={INK} />
          <path d="M92 146Q100 154 108 146Q100 142 92 146Z" fill={RED} />
        </g>
      )}
      {mood === "suspicious" && <path d="M88 144L114 138" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />}
      {mood === "shocked" && <ellipse cx="100" cy="146" rx="9" ry="12" fill={INK} />}
    </g>
  );
}

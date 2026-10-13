import { useId } from "react";
import type { Outfit } from "@/lib/cosmetics";
import { SPECIES, speciesById, speciesOf, type Species } from "@/lib/species";

export type Mood = "idle" | "happy" | "suspicious" | "shocked" | "victory";

const INK = "#2B2350";
const BODY = "var(--pet, #836EF9)";
const DEEP = "var(--pet-deep, #6A56E0)";
const PAPER = "#FFFFFF";
const RED = "#FF4B4B";
const GOLD = "#FFC800";
const CREAM = "#FFF1C2";
const BODY_PATH = "M100 34C148 34 174 72 174 118C174 160 146 184 100 184C54 184 26 160 26 118C26 72 52 34 100 34Z";

/**
 * The Stand-In pet: eighteen species, five moods, layered cosmetics. Plain SVG with no
 * state, so it renders on the server too. Motion is CSS only (see globals.css) and stops
 * under prefers-reduced-motion.
 *
 * Every species shares one body, so the face and anything it wears sit in the same place
 * on all of them. What changes is colour, ears, markings and the odd horn or beak.
 */
export function Pet({
  mood = "idle",
  outfit = {},
  className = "",
  label,
  hue,
  seed,
  kind,
}: {
  mood?: Mood;
  outfit?: Outfit;
  className?: string;
  /** Read out to screen readers; omit when the pet is decoration next to its name. */
  label?: string;
  /** A body colour of its own, for decoration. Overrides the species' colours. */
  hue?: number;
  /** A pet's slug or a resident's name: decides the species. */
  seed?: string;
  /** A species by id, for showing one on purpose. */
  kind?: string;
}) {
  const clip = useId();
  const species: Species = speciesById(kind) ?? (seed ? speciesOf(seed) : SPECIES[0]);
  const armsUp = mood === "victory";
  const has = (extra: Species["extras"][number]) => species.extras.includes(extra);
  const inner = species.inner ?? "#FF9EC4";
  const colours =
    hue !== undefined
      ? { "--pet": `hsl(${hue} 78% 66%)`, "--pet-deep": `hsl(${hue} 62% 52%)` }
      : { "--pet": species.body, "--pet-deep": species.deep };

  return (
    <svg
      viewBox="0 0 200 200"
      className={`pet pet-${mood} ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={colours as React.CSSProperties}
    >
      <defs>
        <clipPath id={clip}>
          <path d={BODY_PATH} />
        </clipPath>
      </defs>

      {outfit.aura === "aura" && (
        <g className="pet-aura" fill={GOLD}>
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
        {/* Things that stick out sit behind the body: ears, horns, gills, feet and arms. */}
        {species.ears === "round" && (
          <g fill={DEEP}>
            <circle cx="58" cy="52" r="17" />
            <circle cx="142" cy="52" r="17" />
          </g>
        )}
        {species.ears === "pointed" && (
          <g>
            <path d="M38 70L46 12L88 46Z" fill={DEEP} />
            <path d="M162 70L154 12L112 46Z" fill={DEEP} />
            <path d="M48 58L52 28L74 48Z" fill={inner} />
            <path d="M152 58L148 28L126 48Z" fill={inner} />
          </g>
        )}
        {species.ears === "long" && (
          <g>
            <ellipse cx="72" cy="36" rx="13" ry="33" fill={DEEP} transform="rotate(-9 72 36)" />
            <ellipse cx="128" cy="36" rx="13" ry="33" fill={DEEP} transform="rotate(9 128 36)" />
            <ellipse cx="72" cy="38" rx="6" ry="24" fill={inner} transform="rotate(-9 72 38)" />
            <ellipse cx="128" cy="38" rx="6" ry="24" fill={inner} transform="rotate(9 128 38)" />
          </g>
        )}
        {species.ears === "big" && (
          <g>
            <circle cx="44" cy="54" r="27" fill={DEEP} />
            <circle cx="156" cy="54" r="27" fill={DEEP} />
            <circle cx="44" cy="54" r="15" fill={inner} />
            <circle cx="156" cy="54" r="15" fill={inner} />
          </g>
        )}
        {species.ears === "floppy" && (
          <g fill={DEEP}>
            <ellipse cx="34" cy="74" rx="15" ry="27" transform="rotate(24 34 74)" />
            <ellipse cx="166" cy="74" rx="15" ry="27" transform="rotate(-24 166 74)" />
          </g>
        )}
        {has("horns") && (
          <g fill={CREAM} stroke={INK} strokeWidth="2.5" strokeLinejoin="round">
            <path d="M62 46L56 12L82 36Z" />
            <path d="M138 46L144 12L118 36Z" />
          </g>
        )}
        {has("antennae") && (
          <g stroke={INK} strokeWidth="4" strokeLinecap="round">
            <path d="M82 40L70 12M118 40L130 12" fill="none" />
            <circle cx="70" cy="10" r="6" fill={species.deep === INK ? GOLD : DEEP} />
            <circle cx="130" cy="10" r="6" fill={species.deep === INK ? GOLD : DEEP} />
          </g>
        )}
        {has("antenna") && (
          <g stroke={INK} strokeWidth="4" strokeLinecap="round">
            <path d="M100 36L100 12" fill="none" />
            <circle cx="100" cy="9" r="7" fill={RED} />
          </g>
        )}
        {has("gills") && (
          <g stroke={species.cheeks ?? "#FF6FA5"} strokeWidth="9" strokeLinecap="round" fill="none">
            <path d="M34 82L8 66M30 100L2 100M34 118L8 134" />
            <path d="M166 82L192 66M170 100L198 100M166 118L192 134" />
          </g>
        )}
        {has("spikes") && <path d="M78 40L86 16L96 36L104 12L112 36L122 18L126 42Z" fill={DEEP} />}
        {has("tuft") && <path d="M88 38Q82 12 98 22Q102 4 110 22Q124 12 114 40Z" fill={species.id === "unicorn" ? "#FF9EC4" : DEEP} />}
        {has("horn") && (
          <g>
            <path d="M90 42L100 2L110 42Z" fill={GOLD} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M94 28L106 22M92 36L108 30" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          </g>
        )}
        {has("bolts") && (
          <g fill={DEEP} stroke={INK} strokeWidth="2.5">
            <rect x="10" y="94" width="18" height="26" rx="4" />
            <rect x="172" y="94" width="18" height="26" rx="4" />
          </g>
        )}

        <ellipse cx="72" cy="182" rx="20" ry="9" fill={DEEP} />
        <ellipse cx="128" cy="182" rx="20" ry="9" fill={DEEP} />
        <ellipse cx={armsUp ? 24 : 28} cy={armsUp ? 84 : 128} rx="11" ry="17" fill={DEEP} transform={armsUp ? "rotate(-28 24 84)" : "rotate(18 28 128)"} />
        <ellipse cx={armsUp ? 176 : 172} cy={armsUp ? 84 : 128} rx="11" ry="17" fill={DEEP} transform={armsUp ? "rotate(28 176 84)" : "rotate(-18 172 128)"} />

        <path d={BODY_PATH} fill={BODY} stroke={INK} strokeOpacity="0.14" strokeWidth="2.5" />

        {/* Markings are clipped to the body, so a stripe never spills past its edge. */}
        <g clipPath={`url(#${clip})`}>
          {has("bib") ? (
            <ellipse cx="100" cy="134" rx="54" ry="60" fill={PAPER} />
          ) : has("muzzle") ? (
            <path d="M40 120Q100 96 160 120L160 190L40 190Z" fill={PAPER} />
          ) : (
            <ellipse cx="100" cy="150" rx="40" ry="26" fill={PAPER} opacity="0.22" />
          )}
          {has("bands") && (
            <g fill={INK}>
              <rect x="20" y="54" width="160" height="14" />
              <rect x="20" y="160" width="160" height="14" />
            </g>
          )}
          {has("stripes") && (
            <g stroke={DEEP} strokeWidth="7" strokeLinecap="round" fill="none">
              <path d="M82 34L86 58M100 30L100 58M118 34L114 58" />
              <path d="M24 108L44 112M24 126L42 126M176 108L156 112M176 126L158 126" />
            </g>
          )}
          {has("spots") && (
            <g fill={DEEP} opacity={species.id === "cow" ? 1 : 0.55}>
              <circle cx="146" cy="66" r="13" />
              <circle cx="50" cy="160" r="11" />
              <circle cx="154" cy="156" r="14" />
              <circle cx="62" cy="58" r="8" />
            </g>
          )}
          {has("patches") && (
            <g fill={INK}>
              <ellipse cx="70" cy="106" rx="23" ry="27" transform="rotate(14 70 106)" />
              <ellipse cx="130" cy="106" rx="23" ry="27" transform="rotate(-14 130 106)" />
            </g>
          )}
        </g>

        <circle cx="52" cy="130" r="9" fill={species.cheeks ?? "#FF9EC4"} opacity="0.7" />
        <circle cx="148" cy="130" r="9" fill={species.cheeks ?? "#FF9EC4"} opacity="0.7" />

        {has("snout") && (
          <g>
            <ellipse cx="100" cy="138" rx="26" ry="18" fill={species.id === "koala" ? INK : "#FFD9E0"} />
            {species.id !== "koala" && (
              <g fill={INK} opacity="0.55">
                <ellipse cx="91" cy="134" rx="3.5" ry="5" />
                <ellipse cx="109" cy="134" rx="3.5" ry="5" />
              </g>
            )}
          </g>
        )}
        {has("whiskers") && (
          <g stroke={INK} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" fill="none">
            <path d="M44 132L16 126M44 140L16 144M156 132L184 126M156 140L184 144" />
          </g>
        )}

        {/* A snout or a beak takes the mouth's place, so only the eyes are drawn over it. */}
        <Face mood={mood} mouth={!has("beak") && !has("snout")} onDark={has("patches")} />

        {has("beak") && <path d="M84 128Q100 120 116 128L100 148Z" fill="#FF9A3A" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />}

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

function Face({ mood, mouth, onDark }: { mood: Mood; mouth: boolean; onDark: boolean }) {
  // Around a panda's eyes the fur is dark, so lines go light and lids go dark there.
  const line = onDark ? PAPER : INK;
  const lid = onDark ? INK : BODY;
  const closed = mood === "happy" || mood === "victory";
  const big = mood === "shocked";
  return (
    <g>
      {closed ? (
        <g fill="none" stroke={line} strokeWidth="6" strokeLinecap="round">
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
              <path d="M54 84H90V102H54Z" fill={lid} />
              <path d="M110 84H146V98H110Z" fill={lid} />
              <path d="M56 102H88" stroke={line} strokeWidth="5" strokeLinecap="round" />
              <path d="M112 98H144" stroke={line} strokeWidth="5" strokeLinecap="round" />
              <path d="M112 80L144 72" stroke={INK} strokeWidth="5" strokeLinecap="round" />
            </g>
          )}
        </g>
      )}

      {mouth && (
        <>
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
        </>
      )}
    </g>
  );
}

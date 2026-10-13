import { useId } from "react";
import type { Outfit } from "@/lib/cosmetics";
import { SPECIES, speciesById, speciesOf, type Shape, type Species } from "@/lib/species";

export type Mood = "idle" | "happy" | "suspicious" | "shocked" | "victory";

const INK = "#2B2350";
const BODY = "var(--pet, #836EF9)";
const DEEP = "var(--pet-deep, #6A56E0)";
const PAPER = "#FFFFFF";
const RED = "#FF4B4B";
const GOLD = "#FFC800";
const CREAM = "#FFF1C2";
const LED = "#7AD7F0";

/**
 * Five silhouettes. Each keeps the face where it is on the others (eyes at y 104, mouth
 * near 138, neck at 166, feet at 182), so a bow tie or a pair of glasses lands in the same
 * place on a squat frog as on a tall penguin. `arm` is where the left arm hangs, and
 * `edge` is how far right the body reaches at tail height.
 */
const SHAPES: Record<Shape, { d: string; arm: number; edge: number }> = {
  round: { d: "M100 34C148 34 174 72 174 118C174 160 146 184 100 184C54 184 26 160 26 118C26 72 52 34 100 34Z", arm: 28, edge: 170 },
  egg: { d: "M100 28C140 28 162 78 162 124C162 162 138 184 100 184C62 184 38 162 38 124C38 78 60 28 100 28Z", arm: 38, edge: 158 },
  squat: { d: "M100 50C158 50 188 88 188 128C188 166 152 184 100 184C48 184 12 166 12 128C12 88 42 50 100 50Z", arm: 16, edge: 182 },
  pear: { d: "M100 34C134 34 152 60 156 92C178 108 184 138 174 160C162 180 132 184 100 184C68 184 38 180 26 160C16 138 22 108 44 92C48 60 66 34 100 34Z", arm: 22, edge: 174 },
  box: { d: "M60 38H140Q170 38 170 68V154Q170 184 140 184H60Q30 184 30 154V68Q30 38 60 38Z", arm: 30, edge: 168 },
};

/**
 * The Stand-In pet: eighteen species, five moods, layered cosmetics. Plain SVG with no
 * state, so it renders on the server too. All motion is CSS (see globals.css): each
 * species has a movement of its own, and everything stops under prefers-reduced-motion.
 *
 * Tails, wings and floating z's are allowed to spill outside the 200 by 200 box, so the
 * box (and every layout built on it) stays the size it always was.
 */
export function Pet({
  mood = "idle",
  outfit = {},
  className = "",
  label,
  hue,
  seed,
  kind,
  still = false,
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
  /** No species movement: for the many small faces in a list, where it would be noise. */
  still?: boolean;
}) {
  const clip = useId();
  const species: Species = speciesById(kind) ?? (seed ? speciesOf(seed) : SPECIES[0]);
  const shape = SHAPES[species.shape];
  const armsUp = mood === "victory";
  const has = (extra: Species["extras"][number]) => species.extras.includes(extra);
  const inner = species.inner ?? "#FF9EC4";
  const eyeY = has("topEyes") ? 56 : 104;
  const arm = shape.arm;
  const reach = shape.edge - 170;
  const flippers = has("flippers");
  const colours =
    hue !== undefined
      ? { "--pet": `hsl(${hue} 78% 66%)`, "--pet-deep": `hsl(${hue} 62% 52%)` }
      : { "--pet": species.body, "--pet-deep": species.deep };

  return (
    <svg
      viewBox="0 0 200 200"
      overflow="visible"
      className={`pet pet-${mood} pet-k-${species.id} ${still ? "" : "pet-live"} ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={colours as React.CSSProperties}
    >
      <defs>
        <clipPath id={clip}>
          <path d={shape.d} />
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

      {/* The species' own movement (a hop, a waddle, a hover) carries everything below. */}
      <g className="pet-move">
        <g className="pet-body">
          {/* ---- Behind the body: wings, tail, ears, horns, feet and arms. ---- */}
          {species.wings === "bee" && (
            <g fill={PAPER} fillOpacity="0.75" stroke={INK} strokeOpacity="0.25" strokeWidth="2">
              <g className="pet-wing-l">
                <ellipse cx="30" cy="62" rx="32" ry="18" transform="rotate(-28 30 62)" />
              </g>
              <g className="pet-wing-r">
                <ellipse cx="170" cy="62" rx="32" ry="18" transform="rotate(28 170 62)" />
              </g>
            </g>
          )}
          {species.wings === "bat" && (
            <g fill={DEEP}>
              <path className="pet-wing-l" d="M46 106L-6 56L10 98L-12 104L12 114L-6 134L46 128Z" />
              <path className="pet-wing-r" d="M154 106L206 56L190 98L212 104L188 114L206 134L154 128Z" />
            </g>
          )}

          <g transform={`translate(${reach} 0)`}>
            <g className="pet-tail">
              {species.tail === "nub" && <circle cx="170" cy="162" r="10" fill={DEEP} />}
              {species.tail === "curl" && <path d="M162 156C196 158 212 128 198 108C188 94 174 104 184 114" fill="none" stroke={DEEP} strokeWidth="13" strokeLinecap="round" />}
              {species.tail === "bushy" && (
                <g>
                  <ellipse cx="196" cy="128" rx="18" ry="38" fill={DEEP} transform="rotate(28 196 128)" />
                  <ellipse cx="210" cy="102" rx="11" ry="16" fill={PAPER} transform="rotate(28 210 102)" />
                </g>
              )}
              {species.tail === "thin" && <path d="M164 162C196 172 216 150 206 130C200 116 214 108 220 118" fill="none" stroke={inner} strokeWidth="5.5" strokeLinecap="round" />}
              {species.tail === "pom" && <circle cx="170" cy="164" r="13" fill={PAPER} stroke={INK} strokeOpacity="0.14" strokeWidth="2" />}
              {species.tail === "fin" && <path d="M162 150C200 138 220 160 206 188C194 172 178 174 162 170Z" fill={DEEP} />}
              {species.tail === "spike" && <path d="M162 152C194 158 206 142 212 120L224 136L210 140C204 164 184 174 162 170Z" fill={DEEP} />}
              {species.tail === "curly" && <path d="M168 152c16-4 24 10 12 18c-10 6-18-8-6-12c10-3 16 6 10 12" fill="none" stroke={DEEP} strokeWidth="6" strokeLinecap="round" />}
              {species.tail === "tuft" && (
                <g>
                  <path d="M166 150C190 150 202 166 200 182" fill="none" stroke={DEEP} strokeWidth="5" strokeLinecap="round" />
                  <ellipse cx="200" cy="188" rx="8" ry="11" fill={DEEP} />
                </g>
              )}
              {species.tail === "rainbow" && (
                <g fill="none" strokeWidth="8" strokeLinecap="round">
                  <path d="M162 150C198 144 214 170 200 194" stroke="#FF9EC4" />
                  <path d="M162 158C190 154 202 174 192 194" stroke="#FFD84D" />
                  <path d="M162 166C182 164 190 178 184 194" stroke="#8AD8FF" />
                </g>
              )}
              {species.tail === "stinger" && <path d="M166 148L200 160L166 172Z" fill={INK} />}
            </g>
          </g>

          {has("topEyes") && (
            <g fill={BODY} stroke={INK} strokeOpacity="0.14" strokeWidth="2.5">
              <circle cx="68" cy="54" r="27" />
              <circle cx="132" cy="54" r="27" />
            </g>
          )}
          {species.ears === "round" && (
            <g fill={DEEP}>
              <circle className="pet-ear-l" cx="58" cy="52" r="17" />
              <circle className="pet-ear-r" cx="142" cy="52" r="17" />
            </g>
          )}
          {species.ears === "pointed" && (
            <g>
              <g className="pet-ear-l">
                <path d="M38 70L46 12L88 46Z" fill={DEEP} />
                <path d="M48 58L52 28L74 48Z" fill={inner} />
              </g>
              <g className="pet-ear-r">
                <path d="M162 70L154 12L112 46Z" fill={DEEP} />
                <path d="M152 58L148 28L126 48Z" fill={inner} />
              </g>
            </g>
          )}
          {species.ears === "long" && (
            <g>
              <g className="pet-ear-l">
                <ellipse cx="76" cy="20" rx="13" ry="36" fill={DEEP} transform="rotate(-8 76 20)" />
                <ellipse cx="76" cy="22" rx="6" ry="26" fill={inner} transform="rotate(-8 76 22)" />
              </g>
              <g className="pet-ear-r">
                <ellipse cx="124" cy="20" rx="13" ry="36" fill={DEEP} transform="rotate(8 124 20)" />
                <ellipse cx="124" cy="22" rx="6" ry="26" fill={inner} transform="rotate(8 124 22)" />
              </g>
            </g>
          )}
          {species.ears === "big" && (
            <g>
              <g className="pet-ear-l">
                <circle cx="44" cy="54" r="27" fill={DEEP} />
                <circle cx="44" cy="54" r="15" fill={inner} />
              </g>
              <g className="pet-ear-r">
                <circle cx="156" cy="54" r="27" fill={DEEP} />
                <circle cx="156" cy="54" r="15" fill={inner} />
              </g>
            </g>
          )}
          {species.ears === "floppy" && (
            <g fill={DEEP}>
              <g className="pet-ear-l">
                <ellipse cx={arm + 6} cy="76" rx="15" ry="27" transform={`rotate(24 ${arm + 6} 76)`} />
              </g>
              <g className="pet-ear-r">
                <ellipse cx={194 - arm} cy="76" rx="15" ry="27" transform={`rotate(-24 ${194 - arm} 76)`} />
              </g>
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
              <g className="pet-ant-l">
                <path d="M84 36L70 6" fill="none" />
                <circle cx="70" cy="4" r="7" fill={species.deep === INK ? GOLD : DEEP} />
              </g>
              <g className="pet-ant-r">
                <path d="M116 36L130 6" fill="none" />
                <circle cx="130" cy="4" r="7" fill={species.deep === INK ? GOLD : DEEP} />
              </g>
            </g>
          )}
          {has("antenna") && (
            <g stroke={INK} strokeWidth="4" strokeLinecap="round">
              <path d="M100 40L100 14" fill="none" />
              <circle className="pet-ant-tip" cx="100" cy="10" r="8" fill={RED} />
            </g>
          )}
          {has("gills") && (
            <g stroke={species.cheeks ?? "#FF6FA5"} strokeWidth="10" strokeLinecap="round" fill="none">
              <path className="pet-gills-l" d={`M${arm + 14} 92L${arm - 14} 74M${arm + 8} 112L${arm - 20} 112M${arm + 14} 132L${arm - 12} 150`} />
              <path className="pet-gills-r" d={`M${186 - arm} 92L${214 - arm} 74M${192 - arm} 112L${220 - arm} 112M${186 - arm} 132L${212 - arm} 150`} />
            </g>
          )}
          {has("spikes") && <path d="M78 40L86 14L96 36L104 10L112 36L122 16L126 42Z" fill={DEEP} />}
          {has("tuft") && <path className="pet-tuft" d="M88 38Q82 10 98 20Q102 2 110 20Q124 10 114 40Z" fill={DEEP} />}
          {has("mane") && (
            <g className="pet-mane">
              <path d="M62 78Q46 40 78 34Q84 12 104 22Q126 14 128 40Q108 34 98 46Q80 44 62 78Z" fill="#FF9EC4" />
              <path d="M70 60Q64 40 84 38Q92 26 104 32Q94 36 88 46Q78 46 70 60Z" fill="#8AD8FF" />
            </g>
          )}
          {has("horn") && (
            <g>
              <path d="M90 42L100 0L110 42Z" fill={GOLD} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M94 28L106 22M92 36L108 30" stroke={INK} strokeWidth="2" strokeLinecap="round" />
            </g>
          )}
          {has("bolts") && (
            <g fill={DEEP} stroke={INK} strokeWidth="2.5">
              <rect className="pet-bolt-l" x="12" y="96" width="18" height="26" rx="4" />
              <rect className="pet-bolt-r" x="170" y="96" width="18" height="26" rx="4" />
            </g>
          )}

          <ellipse cx="72" cy="182" rx="20" ry="9" fill={DEEP} />
          <ellipse cx="128" cy="182" rx="20" ry="9" fill={DEEP} />
          <g className="pet-arm-l">
          <ellipse
            cx={armsUp ? arm - 4 : arm}
            cy={armsUp ? 84 : 128}
            rx={flippers ? 10 : 11}
            ry={flippers ? 25 : 17}
            fill={DEEP}
            transform={armsUp ? `rotate(-28 ${arm - 4} 84)` : `rotate(18 ${arm} 128)`}
          />
          </g>
          <g className="pet-arm-r">
          <ellipse
            cx={armsUp ? 204 - arm : 200 - arm}
            cy={armsUp ? 84 : 128}
            rx={flippers ? 10 : 11}
            ry={flippers ? 25 : 17}
            fill={DEEP}
            transform={armsUp ? `rotate(28 ${204 - arm} 84)` : `rotate(-18 ${200 - arm} 128)`}
          />
          </g>

          {/* ---- The body, with a faint outline so a white pet still has an edge. ---- */}
          <path d={shape.d} fill={BODY} stroke={INK} strokeOpacity="0.14" strokeWidth="2.5" />

          {/* Markings are clipped to the body, so a stripe never spills past its edge. */}
          <g clipPath={`url(#${clip})`}>
            {has("bib") ? (
              <ellipse cx="100" cy="134" rx="50" ry="60" fill={PAPER} />
            ) : has("muzzle") ? (
              <ellipse cx="100" cy="156" rx="56" ry="46" fill={PAPER} />
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
                <circle cx="150" cy="70" r="13" />
                <circle cx="46" cy="160" r="11" />
                <circle cx="156" cy="158" r="14" />
                <circle cx="56" cy="74" r="8" />
              </g>
            )}
            {has("patches") && (
              <g fill={INK}>
                <ellipse cx="70" cy="106" rx="23" ry="27" transform="rotate(14 70 106)" />
                <ellipse cx="130" cy="106" rx="23" ry="27" transform="rotate(-14 130 106)" />
              </g>
            )}
            {has("visor") && <rect x="40" y="78" width="120" height="52" rx="18" fill={INK} />}
          </g>

          <circle cx="52" cy="134" r="9" fill={species.cheeks ?? "#FF9EC4"} opacity="0.7" />
          <circle cx="148" cy="134" r="9" fill={species.cheeks ?? "#FF9EC4"} opacity="0.7" />

          {has("snout") && (
            <g className="pet-snout">
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
              <path className="pet-whisk-l" d="M44 132L14 126M44 140L14 146" />
              <path className="pet-whisk-r" d="M156 132L186 126M156 140L186 146" />
            </g>
          )}
          {has("thirdEye") && (
            <g className="pet-eye3">
              <ellipse cx="100" cy="66" rx="11" ry="12" fill="#fff" />
              <circle cx="100" cy="67" r="5.5" fill={INK} />
            </g>
          )}

          {/* A snout or a beak takes the mouth's place, so only the eyes are drawn over it. */}
          <Face mood={mood} mouth={!has("beak") && !has("snout")} onDark={has("patches")} led={has("visor")} eyeY={eyeY} />

          {has("teeth") && (
            <g fill={PAPER} stroke={INK} strokeWidth="2">
              <rect x="92" y="144" width="8" height="11" rx="2" />
              <rect x="100" y="144" width="8" height="11" rx="2" />
            </g>
          )}
          {has("beak") && <path d="M84 128Q100 120 116 128L100 148Z" fill="#FF9A3A" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />}
          {has("smoke") && (
            <g fill="#9aa3b5">
              <circle className="pet-smoke" cx="128" cy="130" r="6" />
              <circle className="pet-smoke pet-late" cx="128" cy="130" r="6" />
            </g>
          )}

          {outfit.face === "glasses" && (
            <g fill="none" stroke={has("visor") ? GOLD : INK} strokeWidth="5" transform={`translate(0 ${eyeY - 104})`}>
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

        {/* Things that float off a pet: a koala's snores, a unicorn's sparkles. */}
        {has("zzz") && (
          <g fill={INK} fontWeight="900" fontFamily="var(--font-nunito), system-ui, sans-serif" opacity="0.75">
            <text className="pet-zzz" x="156" y="40" fontSize="26">
              z
            </text>
            <text className="pet-zzz pet-late" x="176" y="24" fontSize="18">
              z
            </text>
          </g>
        )}
        {has("sparkles") && (
          <g fill={GOLD}>
            {[
              [24, 60, 9, ""],
              [182, 44, 7, "pet-late"],
              [170, 112, 6, "pet-later"],
            ].map(([x, y, r, late]) => {
              const [cx, cy, s] = [Number(x), Number(y), Number(r)];
              return <path key={`${cx}-${cy}`} className={`pet-spark ${late}`} d={`M${cx} ${cy - s}L${cx + s / 3} ${cy - s / 3}L${cx + s} ${cy}L${cx + s / 3} ${cy + s / 3}L${cx} ${cy + s}L${cx - s / 3} ${cy + s / 3}L${cx - s} ${cy}L${cx - s / 3} ${cy - s / 3}Z`} />;
            })}
          </g>
        )}
      </g>
    </svg>
  );
}

function Face({ mood, mouth, onDark, led, eyeY }: { mood: Mood; mouth: boolean; onDark: boolean; led: boolean; eyeY: number }) {
  // Around a panda's eyes the fur is dark, so lines go light and lids go dark there.
  const line = led ? LED : onDark ? PAPER : INK;
  const lid = onDark ? INK : BODY;
  const closed = mood === "happy" || mood === "victory";
  const big = mood === "shocked";
  return (
    <g>
      <g transform={`translate(0 ${eyeY - 104})`}>
        {closed ? (
          <g fill="none" stroke={line} strokeWidth="6" strokeLinecap="round">
            <path d="M58 108Q72 90 86 108" />
            <path d="M114 108Q128 90 142 108" />
          </g>
        ) : led ? (
          // A robot's eyes are lights on a dark screen: squares, bars when it doubts you.
          <g className="pet-eyes pet-led" fill={LED}>
            {mood === "suspicious" ? (
              <>
                <rect x="60" y="102" width="24" height="7" rx="2" />
                <rect x="116" y="98" width="24" height="7" rx="2" transform="rotate(-10 128 101)" />
              </>
            ) : (
              <>
                <rect x={big ? 58 : 62} y={big ? 90 : 94} width={big ? 28 : 20} height={big ? 28 : 20} rx="5" />
                <rect x={big ? 114 : 118} y={big ? 90 : 94} width={big ? 28 : 20} height={big ? 28 : 20} rx="5" />
              </>
            )}
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
      </g>

      {mouth && (
        <>
          {mood === "idle" && <path d="M88 140Q100 150 112 140" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />}
          {mood === "happy" && <path d="M84 136Q100 158 116 136Z" fill={INK} />}
          {mood === "victory" && (
            <g>
              <path d="M80 134Q100 164 120 134Z" fill={INK} />
              <path d="M92 148Q100 156 108 148Q100 144 92 148Z" fill={RED} />
            </g>
          )}
          {mood === "suspicious" && <path d="M88 146L114 140" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />}
          {mood === "shocked" && <ellipse cx="100" cy="148" rx="9" ry="12" fill={INK} />}
        </>
      )}
    </g>
  );
}

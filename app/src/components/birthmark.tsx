import type { Birthmark as Mark } from "@/lib/pet-dna";

const FRAMES = [
  // circle, diamond, hexagon, shield
  "M50 6A44 44 0 1 1 49.99 6Z",
  "M50 4L96 50L50 96L4 50Z",
  "M50 4L90 27V73L50 96L10 73V27Z",
  "M12 10H88V56C88 78 70 90 50 96C30 90 12 78 12 56Z",
];

/**
 * A pet's birthmark, drawn from the traits its owner's passkey grew. Plain SVG with no
 * state: the same traits always draw the same mark.
 */
export function Birthmark({ mark, className = "", label }: { mark: Mark; className?: string; label?: string }) {
  const ground = `hsl(${mark.hue} 72% 60%)`;
  const deep = `hsl(${mark.hue} 60% 38%)`;
  const ink = `hsl(${mark.hue2} 85% 92%)`;
  const cell = 9;
  const origin = 50 - (cell * 5) / 2;
  const squares: { x: number; y: number }[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if (!((mark.cells >> (row * 3 + col)) & 1)) continue;
      squares.push({ x: col, y: row });
      if (col < 2) squares.push({ x: 4 - col, y: row });
    }
  }
  return (
    <svg viewBox="-8 -8 116 116" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {Array.from({ length: mark.rays }, (_, i) => {
        const a = (i / mark.rays) * Math.PI * 2 - Math.PI / 2;
        return <line key={i} x1={50 + Math.cos(a) * 49} y1={50 + Math.sin(a) * 49} x2={50 + Math.cos(a) * 57} y2={50 + Math.sin(a) * 57} stroke={deep} strokeWidth="4" strokeLinecap="round" />;
      })}
      <path d={FRAMES[mark.shape] ?? FRAMES[0]} fill={ground} stroke={deep} strokeWidth="4" strokeLinejoin="round" />
      {squares.map((s) => (
        <rect key={`${s.x}-${s.y}`} x={origin + s.x * cell + 0.6} y={origin + s.y * cell + 0.6} width={cell - 1.2} height={cell - 1.2} rx="1.6" fill={ink} />
      ))}
    </svg>
  );
}

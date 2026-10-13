// Assertions for the birthmark grown from a passkey namespace. Run with: npx tsx src/lib/pet-dna.check.ts
// Kept dependency-free on purpose; CI runs it next to the type-check.
import assert from "node:assert/strict";
import { NAMESPACES, ns, sha256, toHex } from "./mera-namespaces";
import { birthmarkOf, isBirthmark } from "./pet-dna";

async function main() {
  // A namespace's salt is the SHA-256 of its label: fixed, 32 bytes, different per label.
  const dna = await ns(NAMESPACES.dna);
  const voice = await ns(NAMESPACES.voice);
  assert.equal(dna.length, 32);
  assert.equal(toHex(dna), toHex(await ns("standin/pet-dna/v1")));
  assert.notEqual(toHex(dna), toHex(voice));
  assert.notEqual(toHex(dna), toHex(await ns("mera.prf.salt.v1")));

  // The same 32 bytes always grow the same mark; that is what lets a second device regrow it.
  const seed = Uint8Array.from({ length: 32 }, (_, i) => (i * 37 + 11) % 256);
  const a = await birthmarkOf(seed);
  const b = await birthmarkOf(Uint8Array.from(seed));
  assert.deepEqual(a, b);
  assert.ok(isBirthmark(a));

  // One flipped bit is a different pet.
  const other = Uint8Array.from(seed);
  other[31] ^= 1;
  const c = await birthmarkOf(other);
  assert.notEqual(a.fingerprint, c.fingerprint);

  // Nothing published can be the seed: the fingerprint is short, and no run of seed bytes appears in the mark.
  const published = JSON.stringify(a);
  assert.equal(a.fingerprint.length, 16);
  assert.ok(!published.includes(toHex(seed).slice(0, 16)));

  // Marks are spread out: 300 seeds, 300 fingerprints, and every pattern has cells both on and off.
  const seen = new Set<string>();
  for (let i = 0; i < 300; i++) {
    const m = await birthmarkOf(await sha256(new TextEncoder().encode(`seed ${i}`)));
    seen.add(m.fingerprint);
    const on = m.cells.toString(2).replace(/0/g, "").length;
    assert.ok(on >= 4 && on <= 13, `pattern too empty or too full: ${on}`);
    assert.ok(isBirthmark(m));
  }
  assert.equal(seen.size, 300);

  // Garbage is not a birthmark.
  assert.ok(!isBirthmark({ ...a, hue: 999 }));
  assert.ok(!isBirthmark({ ...a, fingerprint: "nope" }));
  assert.ok(!isBirthmark(null));

  await assert.rejects(birthmarkOf(new Uint8Array(16)));
  console.log("pet-dna checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

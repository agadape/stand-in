import { NextResponse } from "next/server";
import { z } from "zod";
import { OwnerProofBody, provenPet } from "@/lib/owner-route";
import { isBirthmark } from "@/lib/pet-dna";
import { verifyPostcard } from "@/lib/pet-voice";
import { sessionPetOf } from "@/lib/session-cookie";
import { twinBySlug } from "@/lib/twins";
import { publicKeysOf, publishKeys, WorldError } from "@/lib/world";

const hex = (n: number) => z.string().regex(new RegExp(`^[0-9a-f]{${n}}$`));

// Strict: the body says what the pet publishes and nothing else.
const Body = z.strictObject({
  ...OwnerProofBody.shape,
  mark: z.unknown().optional(),
  voiceKey: hex(64).optional(),
  postcard: z.strictObject({ text: z.string().min(1).max(240), signature: hex(128) }).optional(),
});

/**
 * What a pet has published from its passkey's other namespaces: its birthmark, its voice
 * key and its latest signed postcard. All of it is public, so anyone can check a postcard.
 * With no `slug` it answers for the signed-in pet.
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  const pet = slug ? await twinBySlug(slug) : await sessionPetOf(request);
  if (!pet) return NextResponse.json({ error: slug ? "No such pet" : "Sign in, or name a pet." }, { status: slug ? 404 : 401 });
  return NextResponse.json({ slug: pet.slug, ...(await publicKeysOf(pet)) }, { headers: { "cache-control": "no-store" } });
}

/**
 * The owner publishes the public halves. The server never sees a namespace's bytes: a
 * birthmark is traits read from a hash of them, a voice key is a public key, and a
 * postcard is checked against that key before it is kept.
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
  const { mark, voiceKey, postcard, ...proof } = parsed.data;
  if (mark !== undefined && !isBirthmark(mark)) return NextResponse.json({ error: "That isn't a birthmark." }, { status: 400 });
  const pet = await provenPet(proof, "world:mark");
  if (pet instanceof NextResponse) return pet;
  try {
    if (postcard) {
      const key = voiceKey ?? (await publicKeysOf(pet)).voiceKey;
      if (!key || !verifyPostcard(key, pet.slug, postcard.text, postcard.signature)) {
        return NextResponse.json({ error: "That postcard isn't signed by this pet's voice key." }, { status: 400 });
      }
    }
    return NextResponse.json(await publishKeys(pet, { mark: isBirthmark(mark) ? mark : undefined, voiceKey, postcard }));
  } catch (error) {
    if (error instanceof WorldError) return NextResponse.json({ error: error.message, ...error.extra }, { status: error.status });
    throw error;
  }
}

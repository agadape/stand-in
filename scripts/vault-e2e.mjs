// Server side of the soul vault and of "find my pet from my passkey".
//
//   node scripts/vault-e2e.mjs [baseUrl]      (default http://localhost:3000)
//
// A throwaway key stands in for the passkey, and the "ciphertext" is a made-up vault of the
// right shape: what is tested is that the server stores ciphertext only for the owner,
// hands it back, and maps an address to its pet. The encryption itself happens in the
// browser with Mera and a real passkey, which a script cannot drive.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { davePersona } from "./fixtures.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "app/package.json"));
const { privateKeyToAccount, generatePrivateKey } = require("viem/accounts");

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
let failed = 0;
const check = (ok, label, extra = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${extra ? `  (${extra})` : ""}`);
  if (!ok) failed++;
};
async function call(method, path, body) {
  const res = await fetch(`${base}${path}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}
async function signed(slug, action, signer) {
  const issuedAt = Date.now();
  const signature = await signer.signMessage({ message: `Stand-In\nslug: ${slug}\naction: ${action}\nissued: ${issuedAt}` });
  return { slug, address: signer.address, proof: { issuedAt, signature } };
}

const owner = privateKeyToAccount(generatePrivateKey());
const stranger = privateKeyToAccount(generatePrivateKey());
const made = await call("POST", "/api/twins", davePersona(owner.address));
if (made.status !== 200) throw new Error(`create pet -> ${made.status}: ${JSON.stringify(made.json)}`);
const slug = made.json.slug;

const vault = { version: 1, credential: { credentialId: "dGVzdC1jcmVkZW50aWFs", transports: ["internal"] }, prfSalt: "c2FsdHNhbHRzYWx0c2FsdHNhbHRzYWx0c2FsdHNhbHQ", nonce: "bm9uY2Vub25jZW5v", ciphertext: "Y2lwaGVydGV4dC1ieXRlcw" };

check((await call("GET", `/api/twins/${slug}/vault`)).json.vaults?.length === 0, "a new pet has an empty vault");
const forged = await call("PUT", `/api/twins/${slug}/vault`, { ...(await signed(slug, "vault:save:private", stranger)), tier: "private", vault });
check(forged.status === 401, "a stranger cannot write to someone's vault", String(forged.status));
const wrongTier = await call("PUT", `/api/twins/${slug}/vault`, { ...(await signed(slug, "vault:save:private", owner)), tier: "sensitive", vault });
check(wrongTier.status === 401, "a signature for one tier cannot be used on the other", String(wrongTier.status));
const plain = await call("PUT", `/api/twins/${slug}/vault`, { ...(await signed(slug, "vault:save:private", owner)), tier: "private", vault: { ...vault, ciphertext: "this is plain text!" } });
check(plain.status === 400, "something that isn't a vault is refused", String(plain.status));
const saved = await call("PUT", `/api/twins/${slug}/vault`, { ...(await signed(slug, "vault:save:private", owner)), tier: "private", vault });
check(saved.status === 200, "the owner can store a tier's ciphertext", JSON.stringify(saved.json));
const again = await call("PUT", `/api/twins/${slug}/vault`, { ...(await signed(slug, "vault:save:private", owner)), tier: "private", vault: { ...vault, ciphertext: "bmV3ZXItY2lwaGVydGV4dA" } });
const back = (await call("GET", `/api/twins/${slug}/vault`)).json.vaults;
check(again.status === 200 && back.length === 1 && back[0].vault.ciphertext === "bmV3ZXItY2lwaGVydGV4dA", "locking again replaces that tier, one row per tier");
check(back[0].vault.credential.credentialId === vault.credential.credentialId && back[0].vault.prfSalt === vault.prfSalt, "what comes back is what the passkey needs to find the key again");

const mine = await call("GET", `/api/owners/${owner.address}`);
check(mine.status === 200 && mine.json.pets.some((p) => p.slug === slug), "an address finds its pet (the restore path)");
const none = await call("GET", `/api/owners/${stranger.address}`);
check(none.status === 200 && none.json.pets.length === 0, "an address with no pet finds nothing");
check((await call("GET", "/api/owners/not-an-address")).status === 400, "a malformed address is refused");

console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);

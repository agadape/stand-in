/**
 * Per-browser conveniences only. Nothing here is trusted by the server: owner actions
 * always re-prove the owner address with a passkey signature.
 */

export type Owned = { ownerAddress: string; name: string };
export type Player = { displayName: string; address: string };

export const OWNED_KEY = "standin:owned";
const PLAYER_KEY = "standin:player";

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("standin:session"));
  } catch {
    // Private mode or blocked storage: the app still works, it just forgets.
  }
}

export function parseOwned(raw: string | null): Record<string, Owned> {
  try {
    return raw ? (JSON.parse(raw) as Record<string, Owned>) : {};
  } catch {
    return {};
  }
}

export function rememberOwned(slug: string, ownerAddress: string, name: string) {
  const all = read<Record<string, Owned>>(OWNED_KEY) ?? {};
  all[slug] = { ownerAddress, name };
  write(OWNED_KEY, all);
}

export function rememberPlayer(player: Player) {
  write(PLAYER_KEY, player);
}

export function lastPlayer(): Player | null {
  return read<Player>(PLAYER_KEY);
}

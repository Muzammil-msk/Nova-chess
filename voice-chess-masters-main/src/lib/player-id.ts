/**
 * Stable per-browser player identifier so the realtime multiplayer can
 * tell which side of a room the local user is. Persisted in localStorage.
 */
const KEY = "voice-chess.player-id";

export function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

/** Generate a short shareable room code, e.g. "K7QF2P". */
export function generateRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1
  let out = "";
  const arr = new Uint32Array(6);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 6; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
}
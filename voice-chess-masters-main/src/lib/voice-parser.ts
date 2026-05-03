import { Chess, type Move } from "chess.js";

// Map spoken words / homophones to chess notation
const FILE_WORDS: Record<string, string> = {
  a: "a", alpha: "a", apple: "a", ay: "a", eh: "a",
  b: "b", bravo: "b", bee: "b", be: "b",
  c: "c", charlie: "c", see: "c", sea: "c",
  d: "d", delta: "d", dee: "d",
  e: "e", echo: "e", ee: "e",
  f: "f", foxtrot: "f", ef: "f",
  g: "g", golf: "g", gee: "g",
  h: "h", hotel: "h", aitch: "h", h2: "h",
};

const PIECE_WORDS: Record<string, string> = {
  king: "k", kings: "k",
  queen: "q", queens: "q",
  rook: "r", rooks: "r", castle: "r",
  bishop: "b", bishops: "b",
  knight: "n", knights: "n", night: "n", horse: "n",
  pawn: "p", pawns: "p",
};

const NUMBER_WORDS: Record<string, string> = {
  one: "1", won: "1",
  two: "2", to: "2", too: "2",
  three: "3", tree: "3",
  four: "4", for: "4", fore: "4",
  five: "5",
  six: "6", sex: "6",
  seven: "7",
  eight: "8", ate: "8",
};

export type ParseResult =
  | { ok: true; move: Move; sanInput: string }
  | { ok: false; reason: string };

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tries to extract a chess move from natural-language voice input.
 * Examples it understands:
 *  - "knight to f3"
 *  - "pawn e4"
 *  - "e2 to e4"
 *  - "castle kingside" / "castle queenside" / "short castle" / "long castle"
 *  - "queen takes d5"
 */
export function parseVoiceMove(text: string, fen: string): ParseResult {
  const chess = new Chess(fen);
  const cleaned = normalize(text);

  // Castling
  if (/\b(short castle|castle kingside|kingside castle|king side castle|o-?o\b)/i.test(cleaned)) {
    return tryMove(chess, "O-O") ?? notLegal("kingside castle");
  }
  if (/\b(long castle|castle queenside|queenside castle|queen side castle|o-?o-?o\b)/i.test(cleaned)) {
    return tryMove(chess, "O-O-O") ?? notLegal("queenside castle");
  }

  // Tokenize and translate words to chess letters/digits
  const tokens = cleaned.split(" ").filter(Boolean);
  const translated: string[] = [];
  for (const t of tokens) {
    if (PIECE_WORDS[t]) translated.push(`P:${PIECE_WORDS[t]}`);
    else if (FILE_WORDS[t]) translated.push(`F:${FILE_WORDS[t]}`);
    else if (NUMBER_WORDS[t]) translated.push(`N:${NUMBER_WORDS[t]}`);
    else if (/^[a-h][1-8]$/.test(t)) translated.push(`S:${t}`);
    else if (/^[a-h]$/.test(t)) translated.push(`F:${t}`);
    else if (/^[1-8]$/.test(t)) translated.push(`N:${t}`);
    else if (t === "takes" || t === "captures" || t === "x") translated.push("X:x");
    else if (t === "to" || t === "moves") translated.push("T:to");
    else if (t === "promote" || t === "promotes" || t === "promoting") translated.push("PR:");
    else if (t === "check" || t === "mate" || t === "checkmate") {
      // ignore — chess.js will mark these
    }
  }

  // Reconstruct squares from F:+N: pairs
  const squares: string[] = [];
  let pieceLetter: string | null = null;
  let isCapture = false;
  let promotion: string | null = null;

  for (let i = 0; i < translated.length; i++) {
    const tok = translated[i];
    if (tok.startsWith("P:")) pieceLetter = tok.slice(2).toUpperCase();
    else if (tok.startsWith("X:")) isCapture = true;
    else if (tok.startsWith("S:")) squares.push(tok.slice(2));
    else if (tok.startsWith("F:")) {
      const file = tok.slice(2);
      const next = translated[i + 1];
      if (next?.startsWith("N:")) {
        squares.push(file + next.slice(2));
        i++;
      }
    } else if (tok.startsWith("PR:")) {
      // look ahead for piece word
      const next = translated[i + 1];
      if (next?.startsWith("P:")) {
        promotion = next.slice(2);
        i++;
      }
    }
  }

  // Case 1: from-to (e2 to e4)
  if (squares.length >= 2) {
    const from = squares[0];
    const to = squares[1];
    const result = tryVerboseMove(chess, from, to, promotion);
    if (result) return result;
    return notLegal(`${from} to ${to}`);
  }

  // Case 2: piece + destination (knight to f3 / pawn e4)
  if (squares.length === 1) {
    const to = squares[0];
    const piece = pieceLetter ?? "P";
    // Find legal move with that piece type to that destination
    const legal = (chess.moves({ verbose: true }) as Move[]).filter((m) => {
      if (m.to !== to) return false;
      if (m.piece.toUpperCase() !== piece) return false;
      if (isCapture && !m.captured) return false;
      if (promotion && m.promotion !== promotion.toLowerCase()) return false;
      return true;
    });
    if (legal.length === 1) {
      const move = chess.move(legal[0]);
      return move ? { ok: true, move, sanInput: legal[0].san } : notLegal(to);
    }
    if (legal.length > 1) {
      return {
        ok: false,
        reason: `Ambiguous: multiple ${piece === "P" ? "pawns" : "pieces"} can move to ${to}. Try "from-square to ${to}".`,
      };
    }
    return notLegal(`${piece === "P" ? "pawn" : piece} to ${to}`);
  }

  return { ok: false, reason: `Couldn't understand "${text}". Try "knight to f3" or "e2 to e4".` };
}

function tryMove(chess: Chess, san: string): ParseResult | null {
  try {
    const move = chess.move(san);
    return move ? { ok: true, move, sanInput: san } : null;
  } catch {
    return null;
  }
}

function tryVerboseMove(
  chess: Chess,
  from: string,
  to: string,
  promotion: string | null,
): ParseResult | null {
  try {
    const move = chess.move({
      from,
      to,
      promotion: (promotion ?? "q").toLowerCase() as "q" | "r" | "b" | "n",
    });
    return move ? { ok: true, move, sanInput: move.san } : null;
  } catch {
    return null;
  }
}

function notLegal(desc: string): ParseResult {
  return { ok: false, reason: `"${desc}" isn't a legal move right now.` };
}

/** Speak text via the browser TTS, if available. */
export function speak(text: string) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.05;
  utter.pitch = 1;
  synth.speak(utter);
}
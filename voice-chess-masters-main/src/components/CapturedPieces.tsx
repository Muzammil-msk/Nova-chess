import type { Move } from "chess.js";

const PIECE_GLYPH: Record<string, { white: string; black: string }> = {
  p: { white: "♙", black: "♟" },
  n: { white: "♘", black: "♞" },
  b: { white: "♗", black: "♝" },
  r: { white: "♖", black: "♜" },
  q: { white: "♕", black: "♛" },
};

interface CapturedPiecesProps {
  history: Move[];
}

export function CapturedPieces({ history }: CapturedPiecesProps) {
  // Pieces captured BY white (i.e., black pieces taken)
  const capturedByWhite: string[] = [];
  const capturedByBlack: string[] = [];

  for (const m of history) {
    if (!m.captured) continue;
    if (m.color === "w") capturedByWhite.push(m.captured);
    else capturedByBlack.push(m.captured);
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg border border-border bg-card/60 backdrop-blur p-3">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
          You captured
        </div>
        <div className="text-2xl leading-none min-h-7 text-foreground">
          {capturedByWhite.map((p, i) => (
            <span key={i}>{PIECE_GLYPH[p]?.black ?? ""}</span>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card/60 backdrop-blur p-3">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
          AI captured
        </div>
        <div className="text-2xl leading-none min-h-7 text-foreground">
          {capturedByBlack.map((p, i) => (
            <span key={i}>{PIECE_GLYPH[p]?.white ?? ""}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Move, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, RotateCcw, Undo2, Redo2, Cpu, Sparkles, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { findBestMove, type Difficulty } from "@/lib/chess-ai";
import { parseVoiceMove, speak } from "@/lib/voice-parser";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { MoveHistory } from "./MoveHistory";
import { CapturedPieces } from "./CapturedPieces";
import { VoicePanel } from "./VoicePanel";

type GameStatus =
  | { kind: "playing"; turn: "w" | "b"; check: boolean }
  | { kind: "checkmate"; winner: "white" | "black" }
  | { kind: "stalemate" }
  | { kind: "draw"; reason: string };

function deriveStatus(chess: Chess): GameStatus {
  if (chess.isCheckmate()) {
    return { kind: "checkmate", winner: chess.turn() === "w" ? "black" : "white" };
  }
  if (chess.isStalemate()) return { kind: "stalemate" };
  if (chess.isThreefoldRepetition()) return { kind: "draw", reason: "Threefold repetition" };
  if (chess.isInsufficientMaterial()) return { kind: "draw", reason: "Insufficient material" };
  if (chess.isDraw()) return { kind: "draw", reason: "50-move rule" };
  return { kind: "playing", turn: chess.turn(), check: chess.inCheck() };
}

/**
 * Find the king's square for the side currently in check.
 */
function findKingSquare(chess: Chess, color: "w" | "b"): string | null {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (piece && piece.type === "k" && piece.color === color) {
        return String.fromCharCode(97 + f) + (8 - r);
      }
    }
  }
  return null;
}

export function ChessGame() {
  // We keep a ref to the Chess instance and mirror state via a fen + counter.
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState(chessRef.current.fen());
  const [history, setHistory] = useState<Move[]>([]);
  // Stack of undone moves for redo
  const [redoStack, setRedoStack] = useState<Move[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<Set<string>>(new Set());
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [aiThinking, setAiThinking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [voiceFeedbackKind, setVoiceFeedbackKind] = useState<"ok" | "error" | null>(null);

  const status = useMemo(() => deriveStatus(chessRef.current), [fen]);
  const lastMove = history[history.length - 1];

  // Sync helpers
  const refresh = useCallback(() => {
    setFen(chessRef.current.fen());
    setHistory(chessRef.current.history({ verbose: true }) as Move[]);
    setSelected(null);
    setLegalTargets(new Set());
  }, []);

  // Apply a verbose move and clear redo
  const applyMove = useCallback(
    (move: Move | { from: string; to: string; promotion?: string }) => {
      try {
        const result = chessRef.current.move(move as Move);
        if (!result) return null;
        setRedoStack([]);
        refresh();
        return result;
      } catch {
        return null;
      }
    },
    [refresh],
  );

  // ----- AI move -----
  useEffect(() => {
    if (status.kind !== "playing") return;
    if (status.turn !== "b") return; // AI plays black
    setAiThinking(true);
    // Defer so the UI can paint the player's move first
    const id = setTimeout(() => {
      const best = findBestMove(chessRef.current.fen(), difficulty);
      if (best) {
        chessRef.current.move(best);
        setRedoStack([]);
        refresh();
        if (ttsEnabled) speak(`I play ${best.san}`);
      }
      setAiThinking(false);
    }, 250);
    return () => clearTimeout(id);
  }, [fen, status, difficulty, refresh, ttsEnabled]);

  // ----- Click-to-move -----
  const onSquareClick = useCallback(
    ({ square }: { square: string; piece: { pieceType: string } | null }) => {
      if (status.kind !== "playing" || status.turn !== "w") return;

      // If a piece is selected and we click a legal target, move
      if (selected && legalTargets.has(square)) {
        applyMove({ from: selected, to: square, promotion: "q" });
        return;
      }

      // Otherwise try to select a white piece on the clicked square
      const piece = chessRef.current.get(square as Square);
      if (piece && piece.color === "w") {
        const moves = chessRef.current.moves({ square: square as Square, verbose: true }) as Move[];
        setSelected(square);
        setLegalTargets(new Set(moves.map((m) => m.to)));
      } else {
        setSelected(null);
        setLegalTargets(new Set());
      }
    },
    [selected, legalTargets, applyMove, status],
  );

  // ----- Drag-to-move -----
  const onPieceDrop = useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: {
      piece: { pieceType: string };
      sourceSquare: string;
      targetSquare: string | null;
    }) => {
      if (!targetSquare) return false;
      if (status.kind !== "playing" || status.turn !== "w") return false;
      const result = applyMove({ from: sourceSquare, to: targetSquare, promotion: "q" });
      return !!result;
    },
    [applyMove, status],
  );

  // ----- Undo / Redo (undoes a full ply pair when playing AI) -----
  const undo = useCallback(() => {
    // Undo AI move + player move so it's player's turn again
    const undone: Move[] = [];
    const popped1 = chessRef.current.undo();
    if (popped1) undone.push(popped1 as Move);
    // If the most recent undone move was black's, also undo white's previous move
    if (popped1 && (popped1 as Move).color === "b") {
      const popped2 = chessRef.current.undo();
      if (popped2) undone.push(popped2 as Move);
    }
    if (undone.length > 0) {
      setRedoStack((prev) => [...prev, ...undone]);
      refresh();
    }
  }, [refresh]);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      // Replay in reverse order (we pushed undone moves in popped order)
      const toReplay: Move[] = [];
      // Pop up to two moves (player + AI) to maintain pairing
      const m1 = next.pop();
      if (m1) toReplay.push(m1);
      if (m1 && m1.color === "b") {
        const m2 = next.pop();
        if (m2) toReplay.push(m2);
      }
      // toReplay holds them in reverse chronological order; replay oldest first
      for (const m of toReplay.reverse()) {
        try {
          chessRef.current.move({ from: m.from, to: m.to, promotion: m.promotion });
        } catch {
          /* skip */
        }
      }
      refresh();
      return next;
    });
  }, [refresh]);

  const reset = useCallback(() => {
    chessRef.current = new Chess();
    setRedoStack([]);
    refresh();
    setVoiceFeedback(null);
    setLastTranscript("");
  }, [refresh]);

  // ----- Voice -----
  const handleVoiceFinal = useCallback(
    (transcript: string) => {
      setLastTranscript(transcript);
      if (status.kind !== "playing" || status.turn !== "w") {
        setVoiceFeedback("Not your turn.");
        setVoiceFeedbackKind("error");
        return;
      }
      const result = parseVoiceMove(transcript, chessRef.current.fen());
      if (result.ok) {
        // Re-apply on the real instance (parseVoiceMove worked on a clone)
        const applied = chessRef.current.move(result.sanInput);
        if (applied) {
          setRedoStack([]);
          refresh();
          setVoiceFeedback(`Move executed: ${applied.san}`);
          setVoiceFeedbackKind("ok");
          if (ttsEnabled) speak(`Playing ${applied.san}`);
        } else {
          setVoiceFeedback("Move couldn't be applied.");
          setVoiceFeedbackKind("error");
        }
      } else {
        setVoiceFeedback(result.reason);
        setVoiceFeedbackKind("error");
        if (ttsEnabled) speak(result.reason);
      }
    },
    [refresh, status, ttsEnabled],
  );

  const speech = useSpeechRecognition({ onFinal: handleVoiceFinal });

  // Surface mic/permission errors from the recognizer
  useEffect(() => {
    if (speech.error) {
      setVoiceFeedback(speech.error);
      setVoiceFeedbackKind("error");
    }
  }, [speech.error]);

  // ----- Square highlights -----
  const squareStyles = useMemo<Record<string, React.CSSProperties>>(() => {
    const styles: Record<string, React.CSSProperties> = {};

    if (lastMove) {
      styles[lastMove.from] = {
        background: "var(--board-last-move)",
      };
      styles[lastMove.to] = {
        background: "var(--board-last-move)",
      };
    }

    if (selected) {
      styles[selected] = {
        ...styles[selected],
        boxShadow: "inset 0 0 0 3px var(--neon-mint)",
      };
    }

    legalTargets.forEach((sq) => {
      const piece = chessRef.current.get(sq as Square);
      styles[sq] = {
        ...styles[sq],
        background: piece
          ? "radial-gradient(circle, transparent 55%, var(--board-highlight) 56%)"
          : "radial-gradient(circle, var(--board-highlight) 22%, transparent 24%)",
      };
    });

    if (status.kind === "playing" && status.check) {
      const kingSq = findKingSquare(chessRef.current, status.turn);
      if (kingSq) {
        styles[kingSq] = {
          ...styles[kingSq],
          background: "var(--board-check)",
        };
      }
    }

    return styles;
  }, [selected, legalTargets, lastMove, status, fen]);

  // ----- Status banner -----
  const statusBanner = (() => {
    if (status.kind === "checkmate") {
      return {
        title: status.winner === "white" ? "Checkmate — You win!" : "Checkmate — AI wins",
        tone: status.winner === "white" ? "win" : "loss",
      } as const;
    }
    if (status.kind === "stalemate") return { title: "Stalemate", tone: "draw" } as const;
    if (status.kind === "draw") return { title: `Draw — ${status.reason}`, tone: "draw" } as const;
    if (status.check) {
      return {
        title: status.turn === "w" ? "You're in check" : "AI in check",
        tone: "check",
      } as const;
    }
    return {
      title: status.turn === "w" ? "Your move" : "AI thinking…",
      tone: status.turn === "w" ? "you" : "ai",
    } as const;
  })();

  return (
    <div className="min-h-screen px-4 py-6 md:py-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 md:mb-10">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight flex items-center gap-3">
              <span className="size-8 rounded-md bg-gradient-primary grid place-items-center glow">
                <Crown className="size-4 text-primary-foreground" />
              </span>
              <span className="text-neon">Nova</span>
              <span className="text-neon-magenta">Chess</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Speak your moves. Outwit the AI. Or just drag pieces — your call.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/lobby"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card/60 backdrop-blur text-xs uppercase tracking-wider text-foreground hover:text-neon transition-colors"
            >
              <Users className="size-3.5" /> Play a friend
            </Link>
            <div className="flex rounded-lg border border-border bg-card/60 backdrop-blur p-1">
              {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-3 py-1.5 text-xs uppercase tracking-wider rounded-md transition-all ${
                    difficulty === d
                      ? "bg-gradient-primary text-primary-foreground glow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,560px)_1fr] gap-6 items-start">
          {/* Left column: voice + captured */}
          <div className="space-y-4 order-2 lg:order-1">
            <VoicePanel
              supported={speech.supported}
              listening={speech.listening}
              interim={speech.interim}
              lastTranscript={lastTranscript}
              feedback={voiceFeedback}
              feedbackKind={voiceFeedbackKind}
              ttsEnabled={ttsEnabled}
              isInIframe={speech.isInIframe}
              onToggleTts={() => setTtsEnabled((v) => !v)}
              onStart={speech.start}
              onStop={speech.stop}
              onRetry={speech.retry}
              onManualSubmit={handleVoiceFinal}
            />
            <CapturedPieces history={history} />
          </div>

          {/* Center: board */}
          <div className="order-1 lg:order-2">
            <div className="relative">
              {/* Status banner */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={statusBanner.title}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`mb-3 flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 backdrop-blur ${
                    statusBanner.tone === "win"
                      ? "border-primary/50 bg-primary/10 text-primary glow"
                      : statusBanner.tone === "loss"
                        ? "border-destructive/50 bg-destructive/10 text-destructive"
                        : statusBanner.tone === "check"
                          ? "border-accent/50 bg-accent/10 text-accent glow-magenta"
                          : "border-border bg-card/60 text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {statusBanner.tone === "ai" ? (
                      <Cpu className="size-4 animate-pulse" />
                    ) : statusBanner.tone === "win" ? (
                      <Sparkles className="size-4" />
                    ) : null}
                    {statusBanner.title}
                  </div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Move {Math.ceil(history.length / 2) || 1}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Board with neon frame */}
              <div className="rounded-2xl p-2 bg-gradient-to-br from-[var(--neon-mint)]/30 via-transparent to-[var(--neon-magenta)]/30 shadow-elevated">
                <div className="rounded-xl overflow-hidden bg-card p-2">
                  <Chessboard
                    options={{
                      position: fen,
                      onPieceDrop,
                      onSquareClick,
                      boardOrientation: "white",
                      animationDurationInMs: 220,
                      darkSquareStyle: { backgroundColor: "oklch(0.22 0.03 260)" },
                      lightSquareStyle: { backgroundColor: "oklch(0.32 0.04 260)" },
                      squareStyles,
                      darkSquareNotationStyle: { color: "oklch(0.7 0.03 260)" },
                      lightSquareNotationStyle: { color: "oklch(0.5 0.03 260)" },
                      allowDragging: status.kind === "playing" && status.turn === "w",
                      id: "main-board",
                    }}
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={undo}
                  disabled={history.length === 0 || aiThinking}
                >
                  <Undo2 className="size-4 mr-1.5" /> Undo
                </Button>
                <Button
                  variant="outline"
                  onClick={redo}
                  disabled={redoStack.length === 0 || aiThinking}
                >
                  <Redo2 className="size-4 mr-1.5" /> Redo
                </Button>
                <Button variant="outline" onClick={reset}>
                  <RotateCcw className="size-4 mr-1.5" /> New game
                </Button>
              </div>
            </div>
          </div>

          {/* Right column: history */}
          <div className="order-3">
            <MoveHistory history={history} />
          </div>
        </div>
      </div>
    </div>
  );
}
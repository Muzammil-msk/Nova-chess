import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Move, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Copy, Check, Users, ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getPlayerId } from "@/lib/player-id";
import { MoveHistory } from "./MoveHistory";
import { CapturedPieces } from "./CapturedPieces";

type Color = "w" | "b";

type RoomRow = {
  id: string;
  code: string;
  fen: string;
  pgn: string;
  turn: string;
  status: string;
  white_player_id: string | null;
  black_player_id: string | null;
  winner: string | null;
};

function findKingSquare(chess: Chess, color: Color): string | null {
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

export function MultiplayerGame({ roomCode }: { roomCode: string }) {
  const navigate = useNavigate();
  const playerId = useMemo(() => getPlayerId(), []);
  const chessRef = useRef(new Chess());

  const [room, setRoom] = useState<RoomRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fen, setFen] = useState(chessRef.current.fen());
  const [history, setHistory] = useState<Move[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Determine the local player's color
  const myColor: Color | null = useMemo(() => {
    if (!room) return null;
    if (room.white_player_id === playerId) return "w";
    if (room.black_player_id === playerId) return "b";
    return null;
  }, [room, playerId]);

  const orientation: "white" | "black" = myColor === "b" ? "black" : "white";

  // Apply room state to local chess instance
  const syncFromRoom = useCallback((next: RoomRow) => {
    try {
      const c = new Chess();
      // Prefer PGN replay so move history populates; fall back to FEN.
      if (next.pgn && next.pgn.trim().length > 0) {
        c.loadPgn(next.pgn);
      } else {
        c.load(next.fen);
      }
      chessRef.current = c;
      setFen(c.fen());
      setHistory(c.history({ verbose: true }) as Move[]);
      setSelected(null);
      setLegalTargets(new Set());
    } catch (e) {
      console.error("Failed to sync room state", e);
    }
  }, []);

  // Fetch room + auto-claim seat if open
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("code", roomCode)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        setLoading(false);
        return;
      }
      if (!data) {
        setLoadError("Room not found.");
        setLoading(false);
        return;
      }
      let row = data as RoomRow;

      // Auto-claim a free seat if we're not already in the room
      const alreadyIn =
        row.white_player_id === playerId || row.black_player_id === playerId;
      if (!alreadyIn) {
        if (!row.white_player_id) {
          const { data: u } = await supabase
            .from("game_rooms")
            .update({ white_player_id: playerId })
            .eq("id", row.id)
            .select()
            .single();
          if (u) row = u as RoomRow;
        } else if (!row.black_player_id) {
          const { data: u } = await supabase
            .from("game_rooms")
            .update({ black_player_id: playerId, status: "active" })
            .eq("id", row.id)
            .select()
            .single();
          if (u) row = u as RoomRow;
        }
        // If both seats are taken by others — viewer mode (read-only).
      }

      setRoom(row);
      syncFromRoom(row);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [roomCode, playerId, syncFromRoom]);

  // Realtime subscription
  useEffect(() => {
    if (!room) return;
    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_rooms",
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          const next = payload.new as RoomRow;
          setRoom(next);
          // Only re-sync the board if the FEN actually changed
          if (next.fen !== chessRef.current.fen()) {
            syncFromRoom(next);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, syncFromRoom]);

  const status = useMemo(() => {
    const c = chessRef.current;
    if (c.isCheckmate())
      return {
        kind: "checkmate" as const,
        winner: c.turn() === "w" ? "black" : "white",
      };
    if (c.isStalemate()) return { kind: "stalemate" as const };
    if (c.isDraw()) return { kind: "draw" as const };
    return { kind: "playing" as const, turn: c.turn() as Color, check: c.inCheck() };
  }, [fen]);

  const isMyTurn =
    status.kind === "playing" && myColor !== null && status.turn === myColor;

  // Push a local move to the database
  const pushMove = useCallback(
    async (move: { from: string; to: string; promotion?: string }) => {
      if (!room || !myColor || !isMyTurn) return false;
      const c = new Chess(chessRef.current.fen());
      // Replay PGN to keep history in PGN
      try {
        c.loadPgn(chessRef.current.pgn());
      } catch {
        /* ignore */
      }
      let result;
      try {
        result = c.move(move as Move);
      } catch {
        return false;
      }
      if (!result) return false;

      // Optimistic local update
      chessRef.current = c;
      setFen(c.fen());
      setHistory(c.history({ verbose: true }) as Move[]);
      setSelected(null);
      setLegalTargets(new Set());

      const update: Partial<RoomRow> = {
        fen: c.fen(),
        pgn: c.pgn(),
        turn: c.turn(),
      };
      if (c.isCheckmate()) {
        update.status = "finished";
        update.winner = myColor === "w" ? "white" : "black";
      } else if (c.isDraw() || c.isStalemate()) {
        update.status = "finished";
        update.winner = "draw";
      }

      const { error } = await supabase
        .from("game_rooms")
        .update(update)
        .eq("id", room.id);
      if (error) {
        console.error("Failed to push move", error);
      }
      return true;
    },
    [room, myColor, isMyTurn],
  );

  const onSquareClick = useCallback(
    ({ square }: { square: string; piece: { pieceType: string } | null }) => {
      if (!isMyTurn || !myColor) return;
      if (selected && legalTargets.has(square)) {
        pushMove({ from: selected, to: square, promotion: "q" });
        return;
      }
      const piece = chessRef.current.get(square as Square);
      if (piece && piece.color === myColor) {
        const moves = chessRef.current.moves({
          square: square as Square,
          verbose: true,
        }) as Move[];
        setSelected(square);
        setLegalTargets(new Set(moves.map((m) => m.to)));
      } else {
        setSelected(null);
        setLegalTargets(new Set());
      }
    },
    [selected, legalTargets, pushMove, isMyTurn, myColor],
  );

  const onPieceDrop = useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: {
      piece: { pieceType: string };
      sourceSquare: string;
      targetSquare: string | null;
    }) => {
      if (!targetSquare || !isMyTurn) return false;
      // Don't await — react-chessboard wants a sync boolean
      void pushMove({ from: sourceSquare, to: targetSquare, promotion: "q" });
      return true;
    },
    [pushMove, isMyTurn],
  );

  const lastMove = history[history.length - 1];

  const squareStyles = useMemo<Record<string, React.CSSProperties>>(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.from] = { background: "var(--board-last-move)" };
      styles[lastMove.to] = { background: "var(--board-last-move)" };
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
      if (kingSq) styles[kingSq] = { ...styles[kingSq], background: "var(--board-check)" };
    }
    return styles;
  }, [selected, legalTargets, lastMove, status, fen]);

  const copyShareLink = useCallback(async () => {
    const url = `${window.location.origin}/play/${roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }, [roomCode]);

  const resetRoom = useCallback(async () => {
    if (!room) return;
    const fresh = new Chess();
    chessRef.current = fresh;
    setFen(fresh.fen());
    setHistory([]);
    await supabase
      .from("game_rooms")
      .update({
        fen: fresh.fen(),
        pgn: "",
        turn: "w",
        status: room.black_player_id ? "active" : "waiting",
        winner: null,
      })
      .eq("id", room.id);
  }, [room]);

  // ---- Render ----
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading room…
        </div>
      </div>
    );
  }

  if (loadError || !room) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold mb-2">Room unavailable</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {loadError ?? "We couldn't find that room."}
          </p>
          <Button onClick={() => navigate({ to: "/lobby" })}>Back to lobby</Button>
        </div>
      </div>
    );
  }

  const waitingForOpponent =
    !room.white_player_id || !room.black_player_id;

  const banner = (() => {
    if (status.kind === "checkmate") {
      const youWon =
        (status.winner === "white" && myColor === "w") ||
        (status.winner === "black" && myColor === "b");
      return {
        title:
          myColor === null
            ? `Checkmate — ${status.winner} wins`
            : youWon
              ? "Checkmate — You win!"
              : "Checkmate — You lose",
        tone: youWon ? ("win" as const) : ("loss" as const),
      };
    }
    if (status.kind === "stalemate") return { title: "Stalemate", tone: "draw" as const };
    if (status.kind === "draw") return { title: "Draw", tone: "draw" as const };
    if (waitingForOpponent)
      return { title: "Waiting for opponent to join…", tone: "wait" as const };
    if (status.check)
      return {
        title: isMyTurn ? "You're in check" : "Opponent in check",
        tone: "check" as const,
      };
    return {
      title: myColor === null ? "Spectating" : isMyTurn ? "Your move" : "Opponent's move",
      tone: isMyTurn ? ("you" as const) : ("ai" as const),
    };
  })();

  return (
    <div className="min-h-screen px-4 py-6 md:py-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 md:mb-8">
          <div>
            <Link
              to="/lobby"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="size-3.5" /> Lobby
            </Link>
            <div className="flex items-center gap-2 mb-1">
              <div className="size-8 rounded-md bg-gradient-primary grid place-items-center glow">
                <Crown className="size-4 text-primary-foreground" />
              </div>
              <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Multiplayer Room
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
              <span className="text-foreground">Room</span>
              <span className="font-mono text-neon tracking-[0.2em]">{room.code}</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={copyShareLink}>
              {copied ? (
                <>
                  <Check className="size-4 mr-1.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-4 mr-1.5" /> Share invite link
                </>
              )}
            </Button>
            <Button variant="outline" onClick={resetRoom} disabled={waitingForOpponent}>
              <RotateCcw className="size-4 mr-1.5" /> Rematch
            </Button>
          </div>
        </header>

        {/* Player strip */}
        <div className="mb-4 grid grid-cols-2 gap-2 max-w-md">
          <PlayerChip
            label="White"
            isYou={myColor === "w"}
            occupied={!!room.white_player_id}
            active={status.kind === "playing" && status.turn === "w"}
          />
          <PlayerChip
            label="Black"
            isYou={myColor === "b"}
            occupied={!!room.black_player_id}
            active={status.kind === "playing" && status.turn === "b"}
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,560px)_1fr] gap-6 items-start">
          <div className="space-y-4 order-2 lg:order-1">
            <CapturedPieces history={history} />
          </div>

          <div className="order-1 lg:order-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={banner.title}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`mb-3 flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 backdrop-blur ${
                  banner.tone === "win"
                    ? "border-primary/50 bg-primary/10 text-primary glow"
                    : banner.tone === "loss"
                      ? "border-destructive/50 bg-destructive/10 text-destructive"
                      : banner.tone === "check"
                        ? "border-accent/50 bg-accent/10 text-accent glow-magenta"
                        : banner.tone === "wait"
                          ? "border-accent/40 bg-accent/5 text-accent"
                          : "border-border bg-card/60 text-foreground"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  {banner.tone === "wait" ? <Users className="size-4 animate-pulse" /> : null}
                  {banner.title}
                </div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Move {Math.ceil(history.length / 2) || 1}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="rounded-2xl p-2 bg-gradient-to-br from-[var(--neon-mint)]/30 via-transparent to-[var(--neon-magenta)]/30 shadow-elevated">
              <div className="rounded-xl overflow-hidden bg-card p-2">
                <Chessboard
                  options={{
                    position: fen,
                    onPieceDrop,
                    onSquareClick,
                    boardOrientation: orientation,
                    animationDurationInMs: 220,
                    darkSquareStyle: { backgroundColor: "oklch(0.22 0.03 260)" },
                    lightSquareStyle: { backgroundColor: "oklch(0.32 0.04 260)" },
                    squareStyles,
                    darkSquareNotationStyle: { color: "oklch(0.7 0.03 260)" },
                    lightSquareNotationStyle: { color: "oklch(0.5 0.03 260)" },
                    allowDragging: isMyTurn,
                    id: "mp-board",
                  }}
                />
              </div>
            </div>
          </div>

          <div className="order-3">
            <MoveHistory history={history} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerChip({
  label,
  isYou,
  occupied,
  active,
}: {
  label: string;
  isYou: boolean;
  occupied: boolean;
  active: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm backdrop-blur ${
        active
          ? "border-primary/60 bg-primary/10 text-primary glow"
          : "border-border bg-card/60 text-muted-foreground"
      }`}
    >
      <span className="font-medium">{label}</span>
      <span className="text-[11px] uppercase tracking-wider">
        {isYou ? "You" : occupied ? "Opponent" : "Empty"}
      </span>
    </div>
  );
}
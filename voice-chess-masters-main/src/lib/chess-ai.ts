import { Chess, type Move } from "chess.js";

// Piece values for evaluation
const PIECE_VALUES: Record<string, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
};

// Simple piece-square tables (white perspective, mirrored for black)
const PAWN_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];
const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];
const BISHOP_TABLE = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];

const TABLES: Record<string, number[]> = {
  p: PAWN_TABLE,
  n: KNIGHT_TABLE,
  b: BISHOP_TABLE,
  r: PAWN_TABLE.map(() => 0),
  q: PAWN_TABLE.map(() => 0),
  k: PAWN_TABLE.map(() => 0),
};

function squareIndex(square: string, isWhite: boolean): number {
  const file = square.charCodeAt(0) - 97; // a..h -> 0..7
  const rank = parseInt(square[1], 10) - 1; // 1..8 -> 0..7
  // Tables are written from rank 8 down to rank 1 (white perspective)
  const idx = (7 - rank) * 8 + file;
  return isWhite ? idx : (7 - rank) * 8 + file === idx ? (rank * 8 + file) : idx;
}

function evaluateBoard(chess: Chess): number {
  // Positive = good for white
  if (chess.isCheckmate()) {
    return chess.turn() === "w" ? -100000 : 100000;
  }
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) {
    return 0;
  }

  let score = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece) continue;
      const value = PIECE_VALUES[piece.type];
      const table = TABLES[piece.type];
      // r=0 is rank 8. White perspective: tableIndex = r*8+f. Black flips rank.
      const tableIndex = piece.color === "w" ? r * 8 + f : (7 - r) * 8 + f;
      const positional = table[tableIndex] ?? 0;
      const sign = piece.color === "w" ? 1 : -1;
      score += sign * (value + positional);
    }
  }
  return score;
}

function orderMoves(moves: Move[]): Move[] {
  // Captures and promotions first for better alpha-beta pruning
  return [...moves].sort((a, b) => {
    const score = (m: Move) => {
      let s = 0;
      if (m.captured) s += (PIECE_VALUES[m.captured] ?? 0) - (PIECE_VALUES[m.piece] ?? 0) / 10;
      if (m.promotion) s += 800;
      return s;
    };
    return score(b) - score(a);
  });
}

function minimax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluateBoard(chess);
  }

  const moves = orderMoves(chess.moves({ verbose: true }) as Move[]);

  if (maximizing) {
    let max = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const score = minimax(chess, depth - 1, alpha, beta, false);
      chess.undo();
      if (score > max) max = score;
      if (max > alpha) alpha = max;
      if (beta <= alpha) break;
    }
    return max;
  } else {
    let min = Infinity;
    for (const move of moves) {
      chess.move(move);
      const score = minimax(chess, depth - 1, alpha, beta, true);
      chess.undo();
      if (score < min) min = score;
      if (min < beta) beta = min;
      if (beta <= alpha) break;
    }
    return min;
  }
}

export type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTY_DEPTH: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

/**
 * Returns the best move (in verbose form) for the side to move.
 * Easy mode adds randomness so the AI doesn't always pick optimal.
 */
export function findBestMove(fen: string, difficulty: Difficulty): Move | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true }) as Move[];
  if (moves.length === 0) return null;

  // Easy: 40% chance to play a random legal move
  if (difficulty === "easy" && Math.random() < 0.4) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const depth = DIFFICULTY_DEPTH[difficulty];
  const isWhite = chess.turn() === "w";
  let bestScore = isWhite ? -Infinity : Infinity;
  let bestMoves: Move[] = [];

  for (const move of orderMoves(moves)) {
    chess.move(move);
    const score = minimax(chess, depth - 1, -Infinity, Infinity, !isWhite);
    chess.undo();

    if (isWhite) {
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [move];
      } else if (score === bestScore) {
        bestMoves.push(move);
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMoves = [move];
      } else if (score === bestScore) {
        bestMoves.push(move);
      }
    }
  }

  // Tie-break randomly among equally good moves
  return bestMoves[Math.floor(Math.random() * bestMoves.length)] ?? moves[0];
}
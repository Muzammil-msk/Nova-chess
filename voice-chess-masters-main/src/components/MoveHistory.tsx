import type { Move } from "chess.js";
import { motion } from "framer-motion";

interface MoveHistoryProps {
  history: Move[];
}

export function MoveHistory({ history }: MoveHistoryProps) {
  // Pair moves (white, black) for display
  const rows: { num: number; white?: Move; black?: Move }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    rows.push({
      num: i / 2 + 1,
      white: history[i],
      black: history[i + 1],
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 backdrop-blur p-4 shadow-elevated">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        Move history
      </h3>
      <div className="max-h-64 overflow-y-auto pr-1 font-mono-display text-sm">
        {rows.length === 0 ? (
          <p className="text-muted-foreground/70 text-xs italic">No moves yet.</p>
        ) : (
          <ul className="space-y-1">
            {rows.map((row) => (
              <motion.li
                key={row.num}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="grid grid-cols-[2.5rem_1fr_1fr] gap-2 items-center px-2 py-1 rounded hover:bg-muted/40"
              >
                <span className="text-muted-foreground">{row.num}.</span>
                <span className="text-foreground">{row.white?.san ?? ""}</span>
                <span className="text-muted-foreground">{row.black?.san ?? ""}</span>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
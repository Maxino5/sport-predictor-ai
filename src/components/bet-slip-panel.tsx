import { useBetSlip } from "@/lib/bet-slip";
import { Trash2, Ticket, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function BetSlip() {
  const slip = useBetSlip();
  const [open, setOpen] = useState(false);
  const count = slip.items.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-primary/50 bg-surface-strong px-4 py-3 text-sm font-semibold shadow-[var(--shadow-glow)] transition-transform hover:scale-105"
      >
        <Ticket className="size-4 text-primary" />
        Slip
        <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-xs text-primary-foreground">
          {count}
        </span>
      </button>

      <aside
        className={cn(
          "fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-sm flex-col border-l border-border bg-surface transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest">Bet slip</h2>
          <div className="flex items-center gap-1">
            {count > 0 ? (
              <button
                type="button"
                onClick={slip.clear}
                className="rounded-md p-2 text-muted-foreground hover:text-destructive"
                aria-label="Clear slip"
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-2 text-muted-foreground hover:text-foreground"
              aria-label="Close bet slip"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {count === 0 ? (
            <p className="mt-16 text-center text-sm text-muted-foreground">
              Tap any prediction to add it here and see the combined probability.
            </p>
          ) : (
            slip.items.map((item) => (
              <div key={item.id} className="rounded-md border border-border bg-surface-strong/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{item.fixture}</p>
                    <p className="mt-0.5 text-sm font-medium">{item.label}</p>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {item.market}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold text-primary">
                      {Math.round(item.probability * 100)}%
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {item.fairOdds.toFixed(2)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => slip.remove(item.id)}
                  className="mt-2 text-[11px] text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        <footer className="border-t border-border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Combined probability</span>
            <span className="font-mono font-semibold text-primary">
              {(slip.combinedProbability * 100).toFixed(1)}%
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Fair accumulator odds</span>
            <span className="font-mono font-semibold text-accent">
              {slip.combinedOdds.toFixed(2)}
            </span>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Fair odds are 1/probability with no bookmaker margin — anything priced above this is
            value.
          </p>
        </footer>
      </aside>
    </>
  );
}

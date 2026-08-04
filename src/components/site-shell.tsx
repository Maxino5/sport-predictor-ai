import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { BetSlip } from "./bet-slip-panel";

const nav = [
  { to: "/", label: "Today" },
  { to: "/value", label: "Value picks" },
  { to: "/accuracy", label: "Accuracy" },
];

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Trophy className="size-4" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">PitchIQ</span>
          </Link>
          <nav className="flex items-center gap-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                activeProps={{ className: "bg-secondary text-foreground" }}
                inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
                className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

      <footer className="mt-16 border-t border-border/70 py-8">
        <div className="mx-auto max-w-6xl px-4 text-xs leading-relaxed text-muted-foreground">
          <p className="font-display text-sm text-foreground">PitchIQ</p>
          <p className="mt-2 max-w-2xl">
            Probabilities are produced by a Poisson/normal statistical model blended with an AI
            analyst layer using live fixture and form data. Predictions are informational, never
            guarantees. 18+.
          </p>
        </div>
      </footer>

      <BetSlip />
    </div>
  );
}

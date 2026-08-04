import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import type { Match } from "@/lib/types";
import { cn } from "@/lib/utils";

function kickoffTime(match: Match) {
  if (!match.kickoff) return "TBC";
  const d = new Date(match.kickoff);
  if (Number.isNaN(d.getTime())) return "TBC";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MatchCard({ match, index = 0 }: { match: Match; index?: number }) {
  return (
    <Link
      to="/match/$matchId"
      params={{ matchId: match.id }}
      className="group rise-in panel relative block overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:border-primary/50"
      style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: "var(--gradient-pitch)" }} />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {match.leagueBadge ? (
            <img src={match.leagueBadge} alt="" loading="lazy" className="size-5 object-contain" />
          ) : null}
          <span className="truncate font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            {match.league}
          </span>
        </div>
        {match.status === "live" ? (
          <span className="live-dot flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive">
            <Activity className="size-3" /> Live
          </span>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">
            {match.status === "finished" ? "FT" : kickoffTime(match)}
          </span>
        )}
      </div>

      <div className="relative mt-4 space-y-2">
        <TeamRow
          name={match.homeTeam}
          score={match.homeScore}
          winner={
            match.status === "finished" && (match.homeScore ?? 0) > (match.awayScore ?? 0)
          }
        />
        <TeamRow
          name={match.awayTeam}
          score={match.awayScore}
          winner={
            match.status === "finished" && (match.awayScore ?? 0) > (match.homeScore ?? 0)
          }
        />
      </div>

      <div className="relative mt-4 flex items-center justify-between border-t border-border/70 pt-3">
        <span className="truncate text-xs text-muted-foreground">{match.venue ?? "Venue TBC"}</span>
        <span className="text-xs font-semibold text-primary opacity-70 transition-opacity group-hover:opacity-100">
          View prediction →
        </span>
      </div>
    </Link>
  );
}

function TeamRow({
  name,
  score,
  winner,
}: {
  name: string;
  score: number | null;
  winner: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span
        className={cn(
          "truncate text-sm font-medium",
          winner ? "text-primary" : "text-foreground",
        )}
      >
        {name}
      </span>
      {score !== null ? (
        <span className="font-mono text-sm font-semibold tabular-nums">{score}</span>
      ) : null}
    </div>
  );
}

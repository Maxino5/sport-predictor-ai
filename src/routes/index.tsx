import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { MatchCard } from "@/components/match-card";
import { getDailyMatches } from "@/lib/predictions.functions";
import type { Sport } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CalendarDays, Sparkles } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);

const matchesQuery = (date: string, sport: Sport) =>
  queryOptions({
    queryKey: ["matches", date, sport],
    queryFn: () => getDailyMatches({ data: { date, sport } }),
    staleTime: 3 * 60 * 1000,
  });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PitchIQ — AI Football & Basketball Predictions" },
      {
        name: "description",
        content:
          "Daily football and basketball fixtures with AI-blended probability ratings for 1X2, double chance, goals, corners and totals.",
      },
      { property: "og:title", content: "PitchIQ — AI Football & Basketball Predictions" },
      {
        property: "og:description",
        content:
          "Live fixtures plus calibrated probabilities for match result, double chance, over/under goals and corners.",
      },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(matchesQuery(today(), "football")),
  component: Home,
});

function Home() {
  const [sport, setSport] = useState<Sport>("football");
  const [offset, setOffset] = useState(0);

  const date = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <SiteShell>
      <section className="panel hairline-grid relative overflow-hidden px-6 py-10 sm:px-10 sm:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "var(--gradient-pitch)" }}
        />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="size-3" /> Model + AI analyst
          </span>
          <h1 className="mt-4 text-4xl font-bold leading-[1.05] sm:text-5xl">
            <span className="text-gradient-pitch">Every market, priced by probability.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Live football and basketball fixtures, run through a Poisson/normal simulation and
            reviewed by an AI analyst — home, draw, away, double chance, goals, corners and totals,
            each with a calibrated probability rating.
          </p>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-border bg-surface p-1">
          {(["football", "basketball"] as Sport[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSport(s)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors",
                sport === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
          <CalendarDays className="mx-2 size-4 text-muted-foreground" />
          {[
            { o: -1, l: "Yesterday" },
            { o: 0, l: "Today" },
            { o: 1, l: "Tomorrow" },
          ].map((d) => (
            <button
              key={d.o}
              type="button"
              onClick={() => setOffset(d.o)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                offset === d.o
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {d.l}
            </button>
          ))}
        </div>
      </div>

      <MatchList date={date} sport={sport} />
    </SiteShell>
  );
}

function MatchList({ date, sport }: { date: string; sport: Sport }) {
  const { data } = useSuspenseQuery(matchesQuery(date, sport));

  if (!data.length) {
    return (
      <p className="panel mt-6 p-10 text-center text-sm text-muted-foreground">
        No {sport} fixtures listed for {date}.
      </p>
    );
  }

  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((match, i) => (
        <MatchCard key={match.id} match={match} index={i} />
      ))}
    </div>
  );
}

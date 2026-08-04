import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { getValuePicks } from "@/lib/predictions.functions";
import { Flame } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);

const valueQuery = queryOptions({
  queryKey: ["value-picks", today()],
  queryFn: () => getValuePicks({ data: { date: today() } }),
  staleTime: 10 * 60 * 1000,
});

export const Route = createFileRoute("/value")({
  head: () => ({
    meta: [
      { title: "Value Picks of the Day | PitchIQ" },
      {
        name: "description",
        content:
          "The highest-confidence football and basketball selections of the day, ranked by model probability and data quality.",
      },
      { property: "og:title", content: "Value Picks of the Day | PitchIQ" },
      {
        property: "og:description",
        content: "Today's strongest model-rated selections across football and basketball.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(valueQuery),
  component: ValuePage,
});

function ValuePage() {
  const { data } = useSuspenseQuery(valueQuery);

  return (
    <SiteShell>
      <header className="panel relative overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "var(--gradient-value)" }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-accent">
            <Flame className="size-3" /> Value picks
          </span>
          <h1 className="mt-3 text-3xl font-bold">Today&apos;s strongest calls</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Ranked by model probability weighted against how much recent form data was available.
            Open a fixture for the full market breakdown.
          </p>
        </div>
      </header>

      {!data.length ? (
        <p className="panel mt-6 p-10 text-center text-sm text-muted-foreground">
          Not enough form data on today&apos;s fixtures yet. Check back closer to kickoff.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {data.map((pick, i) => (
            <Link
              key={pick.match.id + pick.label}
              to="/match/$matchId"
              params={{ matchId: pick.match.id }}
              className="panel rise-in flex items-center gap-4 p-4 transition-colors hover:border-accent/50"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="font-display text-2xl font-bold text-muted-foreground/50">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] uppercase tracking-widest text-muted-foreground">
                  {pick.match.league} · {pick.match.sport}
                </p>
                <p className="truncate text-sm font-semibold">
                  {pick.match.homeTeam} vs {pick.match.awayTeam}
                </p>
                <p className="mt-0.5 text-sm text-accent">
                  {pick.label}{" "}
                  <span className="text-muted-foreground">({pick.market})</span>
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xl font-bold text-primary">
                  {Math.round(pick.probability * 100)}%
                </p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  conf {pick.confidence}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </SiteShell>
  );
}

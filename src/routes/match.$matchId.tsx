import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { MarketBoard } from "@/components/market-board";
import { getPrediction } from "@/lib/predictions.functions";
import type { TeamForm } from "@/lib/types";
import { BrainCircuit, Gauge, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const predictionQuery = (matchId: string) =>
  queryOptions({
    queryKey: ["prediction", matchId],
    queryFn: () => getPrediction({ data: { matchId } }),
    staleTime: 10 * 60 * 1000,
  });

export const Route = createFileRoute("/match/$matchId")({
  head: () => ({
    meta: [
      { title: "Match prediction & probabilities | PitchIQ" },
      {
        name: "description",
        content:
          "Full AI prediction breakdown: match result, double chance, over/under goals, corners and totals with probability ratings.",
      },
      { property: "og:title", content: "Match prediction & probabilities | PitchIQ" },
      {
        property: "og:description",
        content: "Every market for this fixture, priced with a calibrated probability rating.",
      },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(predictionQuery(params.matchId)),
  component: MatchPage,
});

function MatchPage() {
  const { matchId } = Route.useParams();
  const { data } = useSuspenseQuery(predictionQuery(matchId));

  if (!data) {
    return (
      <SiteShell>
        <div className="panel p-10 text-center">
          <h1 className="text-xl font-semibold">Fixture not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This match is no longer available from the live feed.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm font-semibold text-primary">
            Back to today&apos;s fixtures
          </Link>
        </div>
      </SiteShell>
    );
  }

  const home = data.form.home;
  const away = data.form.away;
  const unit = data.sport === "basketball" ? "points" : "goals";

  return (
    <SiteShell>
      <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
        ← All fixtures
      </Link>

      <section className="panel relative mt-3 overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "var(--gradient-pitch)" }}
        />
        <div className="relative">
          <h1 className="text-2xl font-bold sm:text-3xl">
            {home?.team ?? "Home"} <span className="text-muted-foreground">vs</span>{" "}
            {away?.team ?? "Away"}
          </h1>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat
              icon={<Target className="size-4" />}
              label={`Expected ${unit}`}
              value={`${data.expectedHome} – ${data.expectedAway}`}
            />
            <Stat
              icon={<Gauge className="size-4" />}
              label="Model confidence"
              value={`${data.confidence}%`}
            />
            <Stat
              icon={<BrainCircuit className="size-4" />}
              label={data.aiEnhanced ? "AI-adjusted" : "Statistical only"}
              value={data.expectedCorners ? `${data.expectedCorners} corners` : data.sport}
            />
          </div>

          <div className="mt-5 rounded-lg border border-primary/40 bg-primary/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
              Standout call · {Math.round(data.bestBet.probability * 100)}%
            </p>
            <p className="mt-1 text-lg font-semibold">
              {data.bestBet.label}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({data.bestBet.market})
              </span>
            </p>
            <p className="mt-2 text-sm font-medium">{data.headline}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{data.reasoning}</p>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <FormCard form={home} unit={unit} side="Home" />
        <FormCard form={away} unit={unit} side="Away" />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        All markets · probability rating
      </h2>
      <MarketBoard
        markets={data.markets}
        matchId={data.matchId}
        fixture={`${home?.team ?? "Home"} vs ${away?.team ?? "Away"}`}
      />
    </SiteShell>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-strong/60 p-3">
      <p className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}

function FormCard({
  form,
  unit,
  side,
}: {
  form: TeamForm | null;
  unit: string;
  side: string;
}) {
  if (!form) return null;
  return (
    <div className="panel p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{form.team}</h3>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{side}</span>
      </div>
      <div className="mt-3 flex gap-1">
        {form.formString.split("").map((r, i) => (
          <span
            key={i}
            className={cn(
              "flex size-6 items-center justify-center rounded-sm font-mono text-[11px] font-bold",
              r === "W"
                ? "bg-primary/20 text-primary"
                : r === "D"
                  ? "bg-muted text-muted-foreground"
                  : "bg-destructive/20 text-destructive",
            )}
          >
            {r}
          </span>
        ))}
        {form.played === 0 ? (
          <span className="text-xs text-muted-foreground">No recent results on record</span>
        ) : null}
      </div>
      {form.played > 0 ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          {form.scored} {unit} for · {form.conceded} against · {form.played} played
        </p>
      ) : null}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { getAccuracyReport } from "@/lib/predictions.functions";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const accuracyQuery = queryOptions({
  queryKey: ["accuracy"],
  queryFn: () => getAccuracyReport(),
  staleTime: 30 * 60 * 1000,
});

export const Route = createFileRoute("/accuracy")({
  head: () => ({
    meta: [
      { title: "Prediction Accuracy Tracker | PitchIQ" },
      {
        name: "description",
        content:
          "Rolling backtest of the PitchIQ model: hit rate by market across recently finished football and basketball matches.",
      },
      { property: "og:title", content: "Prediction Accuracy Tracker | PitchIQ" },
      {
        property: "og:description",
        content: "Transparent hit rates per market from a rolling backtest on finished fixtures.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(accuracyQuery),
  component: AccuracyPage,
});

function AccuracyPage() {
  const { data } = useSuspenseQuery(accuracyQuery);

  return (
    <SiteShell>
      <header className="panel p-6">
        <h1 className="text-3xl font-bold">Accuracy tracker</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A rolling backtest over the last {data.windowDays} days. For each finished fixture the
          statistical model is re-run using <strong>only</strong> form recorded before that match,
          then its top selection in each verifiable market is settled against the real score.
        </p>
        <div className="mt-5 flex flex-wrap gap-4">
          <div className="rounded-lg border border-primary/40 bg-primary/10 px-5 py-3">
            <p className="text-[11px] uppercase tracking-widest text-primary">Overall hit rate</p>
            <p className="font-mono text-3xl font-bold">{(data.overall * 100).toFixed(1)}%</p>
          </div>
          <div className="rounded-lg border border-border bg-surface-strong/60 px-5 py-3">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Matches settled
            </p>
            <p className="font-mono text-3xl font-bold">{data.sampleSize}</p>
          </div>
        </div>
      </header>

      {data.byMarket.length ? (
        <section className="panel mt-6 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest">By market</h2>
          <div className="mt-4 space-y-3">
            {data.byMarket.map((m) => (
              <div key={m.market}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>{m.market}</span>
                  <span className="font-mono text-muted-foreground">
                    {m.hits}/{m.total} · {(m.accuracy * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${m.accuracy * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Settled fixtures
        </h2>
        {!data.recent.length ? (
          <p className="panel p-10 text-center text-sm text-muted-foreground">
            Not enough completed fixtures with prior form data in this window yet.
          </p>
        ) : (
          data.recent.map((r) => (
            <div key={r.matchId} className="panel p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {r.league} · {r.date}
                  </p>
                  <p className="text-sm font-semibold">{r.fixture}</p>
                </div>
                <span className="font-mono text-lg font-bold">{r.score}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.picks.map((p) => (
                  <span
                    key={p.market + p.label}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                      p.hit
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-destructive/40 bg-destructive/10 text-destructive",
                    )}
                  >
                    {p.hit ? <Check className="size-3" /> : <X className="size-3" />}
                    {p.label}
                    <span className="font-mono opacity-70">
                      {Math.round(p.probability * 100)}%
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </SiteShell>
  );
}

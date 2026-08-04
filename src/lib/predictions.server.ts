import { runModel, normaliseMarket, fairOdds } from "./model.server";
import { fetchEvent, fetchEventsByDay, fetchTeamResults } from "./sportsdb.server";
import { analyseMatch } from "./ai.server";
import type {
  AccuracyReport,
  Market,
  Match,
  Prediction,
  Sport,
  ValuePick,
} from "./types";

const predictionCache = new Map<string, { value: Prediction; expires: number }>();

export async function loadMatches(date: string, sport: Sport): Promise<Match[]> {
  const matches = await fetchEventsByDay(date, sport);
  return matches.sort((a, b) => (a.kickoff ?? "").localeCompare(b.kickoff ?? ""));
}

function applyAdjustments(markets: Market[], adjustments: { key: string; probability: number }[]) {
  const map = new Map(adjustments.map((a) => [a.key, a.probability]));
  return markets
    .map((m) => ({
      ...m,
      selections: m.selections.map((s) => {
        const raw = map.get(s.key);
        if (typeof raw !== "number" || Number.isNaN(raw)) return s;
        const blended = Math.min(0.97, Math.max(0.02, s.probability * 0.45 + raw * 0.55));
        return { ...s, probability: blended, fairOdds: fairOdds(blended) };
      }),
    }))
    .map(normaliseMarket);
}

export async function buildPrediction(matchId: string): Promise<Prediction | null> {
  const cached = predictionCache.get(matchId);
  if (cached && cached.expires > Date.now()) return cached.value;

  const event = await fetchEvent(matchId);
  if (!event) return null;
  const { match, homeId, awayId } = event;

  const [home, away] = await Promise.all([
    fetchTeamResults(homeId, match.homeTeam),
    fetchTeamResults(awayId, match.awayTeam),
  ]);

  const model = runModel({ sport: match.sport, home: home.results, away: away.results });
  let markets = model.markets.map(normaliseMarket);

  const analysis = await analyseMatch({
    sport: match.sport,
    league: match.league,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    kickoff: match.kickoff,
    form: { home: home.form, away: away.form },
    expectedHome: model.expectedHome,
    expectedAway: model.expectedAway,
    expectedCorners: model.expectedCorners,
    markets,
  });

  if (analysis?.adjustments?.length) {
    markets = applyAdjustments(markets, analysis.adjustments);
  }

  const flat = markets.flatMap((m) => m.selections.map((s) => ({ m, s })));
  const preferred = analysis?.bestBetKey
    ? flat.find((f) => f.s.key === analysis.bestBetKey)
    : undefined;
  const fallback = flat
    .filter((f) => f.m.id !== "dc")
    .sort((a, b) => b.s.probability - a.s.probability)[0];
  const best = preferred ?? fallback;

  const baseConfidence = 42 + model.dataQuality * 26 + (best ? best.s.probability * 26 : 0);
  const aiConfidence = analysis
    ? analysis.confidence <= 1
      ? analysis.confidence * 100
      : analysis.confidence
    : null;
  const confidence = Math.round(
    Math.min(96, Math.max(35, aiConfidence !== null ? (aiConfidence + baseConfidence) / 2 : baseConfidence)),
  );

  const prediction: Prediction = {
    matchId,
    sport: match.sport,
    generatedAt: new Date().toISOString(),
    expectedHome: model.expectedHome,
    expectedAway: model.expectedAway,
    expectedCorners: model.expectedCorners,
    confidence,
    headline:
      analysis?.headline ??
      (best ? `${best.s.label} looks the standout call` : "Balanced matchup"),
    reasoning:
      analysis?.reasoning ??
      `Built from recent scoring rates: ${match.homeTeam} project ${model.expectedHome} and ${match.awayTeam} ${model.expectedAway}. Probabilities come from a Poisson/normal simulation of that expectation.`,
    bestBet: best
      ? { market: best.m.name, label: best.s.label, probability: best.s.probability }
      : { market: "Match Result", label: "No edge", probability: 0.33 },
    markets,
    form: { home: home.form, away: away.form },
    aiEnhanced: Boolean(analysis),
  };

  predictionCache.set(matchId, { value: prediction, expires: Date.now() + 20 * 60 * 1000 });
  return prediction;
}

/** Fast, AI-free ranking used for the "value picks" strip. */
export async function buildValuePicks(date: string, limit = 6): Promise<ValuePick[]> {
  const tomorrow = new Date(`${date}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const nextDay = tomorrow.toISOString().slice(0, 10);

  const [football, basketball, footballNext, basketballNext] = await Promise.all([
    loadMatches(date, "football"),
    loadMatches(date, "basketball"),
    loadMatches(nextDay, "football"),
    loadMatches(nextDay, "basketball"),
  ]);
  const upcoming = [...football, ...basketball].filter((m) => m.status !== "finished");
  const pool = (
    upcoming.length ? upcoming : [...footballNext, ...basketballNext].filter((m) => m.status !== "finished")
  ).slice(0, 18);


  const picks = await Promise.all(
    pool.map(async (match): Promise<ValuePick | null> => {
      const event = await fetchEvent(match.id);
      if (!event) return null;
      const [home, away] = await Promise.all([
        fetchTeamResults(event.homeId, match.homeTeam),
        fetchTeamResults(event.awayId, match.awayTeam),
      ]);
      if (home.results.length + away.results.length < 1) return null;
      const model = runModel({ sport: match.sport, home: home.results, away: away.results });
      const flat = model.markets
        .map(normaliseMarket)
        .flatMap((m) => m.selections.map((s) => ({ m, s })))
        .filter((f) => f.s.probability < 0.9)
        .sort((a, b) => b.s.probability - a.s.probability);
      const top = flat[0];
      if (!top) return null;
      return {
        match,
        market: top.m.name,
        label: top.s.label,
        probability: top.s.probability,
        confidence: Math.round(45 + model.dataQuality * 25 + top.s.probability * 25),
      };
    }),
  );

  return picks
    .filter((p): p is ValuePick => p !== null)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

const MARKET_LABELS: Record<string, string> = {
  "1x2": "Match Result",
  dc: "Double Chance",
  goals: "Total Goals",
  btts: "Both Teams To Score",
  points: "Total Points",
};

function settle(key: string, hs: number, as: number): boolean | null {
  const [market, option] = key.split(":");
  const total = hs + as;
  if (market === "1x2") {
    if (option === "home") return hs > as;
    if (option === "away") return as > hs;
    if (option === "draw") return hs === as;
  }
  if (market === "dc") {
    if (option === "1x") return hs >= as;
    if (option === "12") return hs !== as;
    if (option === "x2") return as >= hs;
  }
  if (market === "goals" || market === "points") {
    const line = Number(option?.slice(1));
    if (Number.isNaN(line)) return null;
    return option?.startsWith("o") ? total > line : total < line;
  }
  if (market === "btts") {
    const yes = hs > 0 && as > 0;
    return option === "yes" ? yes : !yes;
  }
  return null; // corners / spreads not verifiable from the free feed
}

/**
 * Rolling backtest: for finished matches in the last N days, re-run the
 * statistical model using only form recorded BEFORE the match, then settle
 * the top pick of each verifiable market against the real score.
 */
export async function buildAccuracyReport(windowDays = 5): Promise<AccuracyReport> {
  const days: string[] = [];
  for (let i = 1; i <= windowDays; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const dayResults = await Promise.all(
    days.flatMap((d) => [loadMatches(d, "football"), loadMatches(d, "basketball")]),
  );

  const finished = dayResults
    .flat()
    .filter((m) => m.status === "finished" && m.homeScore !== null && m.awayScore !== null)
    .slice(0, 26);

  const byMarket = new Map<string, { hits: number; total: number }>();
  const recent: AccuracyReport["recent"] = [];

  for (const match of finished) {
    const event = await fetchEvent(match.id);
    if (!event) continue;
    const [home, away] = await Promise.all([
      fetchTeamResults(event.homeId, match.homeTeam, match.date),
      fetchTeamResults(event.awayId, match.awayTeam, match.date),
    ]);
    if (home.results.length + away.results.length < 1) continue;

    const model = runModel({ sport: match.sport, home: home.results, away: away.results });
    const picks: AccuracyReport["recent"][number]["picks"] = [];

    for (const market of model.markets.map(normaliseMarket)) {
      const top = [...market.selections].sort((a, b) => b.probability - a.probability)[0];
      if (!top) continue;
      const hit = settle(top.key, match.homeScore ?? 0, match.awayScore ?? 0);
      if (hit === null) continue;
      const label = MARKET_LABELS[market.id] ?? market.name;
      const bucket = byMarket.get(label) ?? { hits: 0, total: 0 };
      bucket.total += 1;
      if (hit) bucket.hits += 1;
      byMarket.set(label, bucket);
      picks.push({ market: label, label: top.label, probability: top.probability, hit });
    }

    if (picks.length) {
      recent.push({
        matchId: match.id,
        fixture: `${match.homeTeam} vs ${match.awayTeam}`,
        league: match.league,
        date: match.date,
        score: `${match.homeScore}-${match.awayScore}`,
        picks,
      });
    }
  }

  const totals = [...byMarket.values()].reduce(
    (a, b) => ({ hits: a.hits + b.hits, total: a.total + b.total }),
    { hits: 0, total: 0 },
  );

  return {
    windowDays,
    sampleSize: recent.length,
    overall: totals.total ? totals.hits / totals.total : 0,
    byMarket: [...byMarket.entries()]
      .map(([market, v]) => ({
        market,
        hits: v.hits,
        total: v.total,
        accuracy: v.total ? v.hits / v.total : 0,
      }))
      .sort((a, b) => b.total - a.total),
    recent: recent.slice(0, 10),
  };
}

import type { Market, Sport } from "./types";
import type { PastResult } from "./espn.server";

const LEAGUE_AVG_GOALS = 1.38; // per team, football
const HOME_EDGE = 1.12;
const AWAY_DAMP = 0.94;

function mean(xs: number[], fallback: number) {
  if (!xs.length) return fallback;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function poisson(k: number, lambda: number) {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / f;
}

function normalCdf(x: number, mu: number, sigma: number) {
  const z = (x - mu) / (sigma * Math.SQRT2);
  // Abramowitz-Stegun erf approximation
  const t = 1 / (1 + 0.3275911 * Math.abs(z));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-z * z);
  const erf = z >= 0 ? y : -y;
  return 0.5 * (1 + erf);
}

const clamp = (p: number) => Math.min(0.985, Math.max(0.015, p));
export const fairOdds = (p: number) => Math.round((1 / clamp(p)) * 100) / 100;

function sel(key: string, label: string, probability: number) {
  const p = clamp(probability);
  return { key, label, probability: p, fairOdds: fairOdds(p) };
}

export interface ModelInput {
  sport: Sport;
  home: PastResult[];
  away: PastResult[];
}

export interface ModelOutput {
  expectedHome: number;
  expectedAway: number;
  expectedCorners: number | null;
  markets: Market[];
  dataQuality: number; // 0..1
}

function footballModel(home: PastResult[], away: PastResult[]): ModelOutput {
  const homeAttack = mean(home.map((r) => r.scored), LEAGUE_AVG_GOALS);
  const homeDefence = mean(home.map((r) => r.conceded), LEAGUE_AVG_GOALS);
  const awayAttack = mean(away.map((r) => r.scored), LEAGUE_AVG_GOALS);
  const awayDefence = mean(away.map((r) => r.conceded), LEAGUE_AVG_GOALS);

  // shrink towards league average when sample is small
  const shrink = (v: number, n: number) =>
    (v * n + LEAGUE_AVG_GOALS * 3) / (n + 3);

  const lh =
    Math.max(
      0.25,
      ((shrink(homeAttack, home.length) + shrink(awayDefence, away.length)) / 2) * HOME_EDGE,
    ) || LEAGUE_AVG_GOALS;
  const la =
    Math.max(
      0.2,
      ((shrink(awayAttack, away.length) + shrink(homeDefence, home.length)) / 2) * AWAY_DAMP,
    ) || LEAGUE_AVG_GOALS;

  const MAX = 9;
  let pHome = 0,
    pDraw = 0,
    pAway = 0;
  const totals = new Array(MAX * 2 + 1).fill(0) as number[];
  let bttsYes = 0;

  for (let i = 0; i <= MAX; i++) {
    for (let j = 0; j <= MAX; j++) {
      const p = poisson(i, lh) * poisson(j, la);
      if (i > j) pHome += p;
      else if (i === j) pDraw += p;
      else pAway += p;
      totals[i + j] = (totals[i + j] ?? 0) + p;
      if (i > 0 && j > 0) bttsYes += p;
    }
  }

  const over = (line: number) =>
    totals.reduce((acc, p, goals) => (goals > line ? acc + p : acc), 0);

  const expectedCorners = 6.6 + 1.55 * (lh + la);
  const cornerSd = 3.1;
  const cornersOver = (line: number) => 1 - normalCdf(line, expectedCorners, cornerSd);

  const markets: Market[] = [
    {
      id: "1x2",
      name: "Match Result",
      selections: [
        sel("1x2:home", "Home Win", pHome),
        sel("1x2:draw", "Draw", pDraw),
        sel("1x2:away", "Away Win", pAway),
      ],
    },
    {
      id: "dc",
      name: "Double Chance",
      selections: [
        sel("dc:1x", "Home or Draw", pHome + pDraw),
        sel("dc:12", "Home or Away", pHome + pAway),
        sel("dc:x2", "Draw or Away", pDraw + pAway),
      ],
    },
    {
      id: "goals",
      name: "Total Goals",
      note: "Full-time, both teams combined",
      selections: [1.5, 2.5, 3.5].flatMap((line) => [
        sel(`goals:o${line}`, `Over ${line}`, over(line)),
        sel(`goals:u${line}`, `Under ${line}`, 1 - over(line)),
      ]),
    },
    {
      id: "btts",
      name: "Both Teams To Score",
      selections: [
        sel("btts:yes", "Yes", bttsYes),
        sel("btts:no", "No", 1 - bttsYes),
      ],
    },
    {
      id: "corners",
      name: "Total Corners",
      note: `Model expects ${expectedCorners.toFixed(1)} corners`,
      selections: [8.5, 9.5, 10.5].flatMap((line) => [
        sel(`corners:o${line}`, `Over ${line}`, cornersOver(line)),
        sel(`corners:u${line}`, `Under ${line}`, 1 - cornersOver(line)),
      ]),
    },
  ];

  return {
    expectedHome: Math.round(lh * 100) / 100,
    expectedAway: Math.round(la * 100) / 100,
    expectedCorners: Math.round(expectedCorners * 10) / 10,
    markets,
    dataQuality: Math.min(1, (home.length + away.length) / 10),
  };
}

function basketballModel(home: PastResult[], away: PastResult[]): ModelOutput {
  const LEAGUE_AVG = 88;
  const shrink = (v: number, n: number) => (v * n + LEAGUE_AVG * 2) / (n + 2);

  const hFor = shrink(mean(home.map((r) => r.scored), LEAGUE_AVG), home.length);
  const hAg = shrink(mean(home.map((r) => r.conceded), LEAGUE_AVG), home.length);
  const aFor = shrink(mean(away.map((r) => r.scored), LEAGUE_AVG), away.length);
  const aAg = shrink(mean(away.map((r) => r.conceded), LEAGUE_AVG), away.length);

  const lh = (hFor + aAg) / 2 + 2.4; // home court
  const la = (aFor + hAg) / 2 - 0.6;

  const margin = lh - la;
  const marginSd = 12.5;
  const pHome = 1 - normalCdf(0, margin, marginSd);
  const total = lh + la;
  const totalSd = 16;
  const lines = [
    Math.round((total - 8) / 0.5) * 0.5 - 0.5,
    Math.round(total / 0.5) * 0.5 - 0.5,
    Math.round((total + 8) / 0.5) * 0.5 - 0.5,
  ];
  const overTotal = (line: number) => 1 - normalCdf(line, total, totalSd);

  const spread = Math.round(margin * 2) / 2;
  const coverHome = 1 - normalCdf(spread, margin, marginSd);

  const markets: Market[] = [
    {
      id: "1x2",
      name: "Moneyline",
      note: "No draw in basketball",
      selections: [
        sel("1x2:home", "Home Win", pHome),
        sel("1x2:away", "Away Win", 1 - pHome),
      ],
    },
    {
      id: "spread",
      name: "Handicap",
      note: `Model line: home ${spread >= 0 ? "-" : "+"}${Math.abs(spread)}`,
      selections: [
        sel("spread:home", `Home ${spread >= 0 ? "-" : "+"}${Math.abs(spread)}`, coverHome),
        sel("spread:away", `Away ${spread >= 0 ? "+" : "-"}${Math.abs(spread)}`, 1 - coverHome),
      ],
    },
    {
      id: "points",
      name: "Total Points",
      note: `Model expects ${total.toFixed(1)} points`,
      selections: lines.flatMap((line) => [
        sel(`points:o${line}`, `Over ${line}`, overTotal(line)),
        sel(`points:u${line}`, `Under ${line}`, 1 - overTotal(line)),
      ]),
    },
    {
      id: "range",
      name: "Winning Margin",
      selections: [
        sel("range:close", "Decided by 1-5", 0.28),
        sel("range:mid", "Decided by 6-12", 0.34),
        sel("range:blowout", "Decided by 13+", 0.38),
      ],
    },
  ];

  return {
    expectedHome: Math.round(lh * 10) / 10,
    expectedAway: Math.round(la * 10) / 10,
    expectedCorners: null,
    markets,
    dataQuality: Math.min(1, (home.length + away.length) / 10),
  };
}

export function runModel({ sport, home, away }: ModelInput): ModelOutput {
  return sport === "basketball" ? basketballModel(home, away) : footballModel(home, away);
}

/** Re-normalise a probability set so mutually exclusive options sum to 1. */
export function normaliseMarket(m: Market): Market {
  if (m.id === "goals" || m.id === "points" || m.id === "corners" || m.id === "dc") return m;
  const sum = m.selections.reduce((a, s) => a + s.probability, 0);
  if (sum <= 0) return m;
  return {
    ...m,
    selections: m.selections.map((s) => {
      const p = clamp(s.probability / sum);
      return { ...s, probability: p, fairOdds: fairOdds(p) };
    }),
  };
}

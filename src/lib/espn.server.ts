import type { Match, Sport, TeamForm } from "./types";

/**
 * Live data provider: ESPN's public scoreboard feeds.
 * Free, no key, and covers dozens of competitions per day including club
 * friendlies (which the previous provider missed entirely).
 */
const BASE = "https://site.api.espn.com/apis/site/v2/sports";

const SOCCER_LEAGUES = [
  "club.friendly",
  "fifa.friendly",
  "uefa.champions",
  "uefa.europa",
  "uefa.europa.conf",
  "uefa.super_cup",
  "eng.1",
  "eng.2",
  "eng.fa",
  "eng.league_cup",
  "eng.charity",
  "esp.1",
  "esp.2",
  "esp.copa_del_rey",
  "ita.1",
  "ita.2",
  "ita.coppa_italia",
  "ger.1",
  "ger.2",
  "ger.dfb_pokal",
  "fra.1",
  "fra.2",
  "ned.1",
  "por.1",
  "bel.1",
  "tur.1",
  "sco.1",
  "gre.1",
  "sui.1",
  "aut.1",
  "den.1",
  "nor.1",
  "swe.1",
  "usa.1",
  "usa.usl.1",
  "mex.1",
  "bra.1",
  "arg.1",
  "col.1",
  "chi.1",
  "jpn.1",
  "kor.1",
  "chn.1",
  "aus.1",
  "ksa.1",
  "uae.1",
  "caf.champions",
  "concacaf.champions",
  "conmebol.libertadores",
  "conmebol.sudamericana",
  "afc.champions",
  "nga.1",
] as const;

const BASKETBALL_LEAGUES = [
  "nba",
  "wnba",
  "mens-college-basketball",
  "womens-college-basketball",
  "nba-summer-las-vegas",
  "nbl",
] as const;

const SPORT_PATH: Record<Sport, string> = {
  football: "soccer",
  basketball: "basketball",
};

const LEAGUES: Record<Sport, readonly string[]> = {
  football: SOCCER_LEAGUES,
  basketball: BASKETBALL_LEAGUES,
};

type Cached<T> = { value: T; expires: number };
const cache = new Map<string, Cached<unknown>>();

async function cachedJson<T>(url: string, ttlMs: number): Promise<T | null> {
  const hit = cache.get(url) as Cached<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as T;
    cache.set(url, { value: json, expires: Date.now() + ttlMs });
    return json;
  } catch {
    return null;
  }
}

interface EspnCompetitor {
  id: string;
  homeAway: "home" | "away";
  score?: string | { displayValue?: string; value?: number } | null;
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    logo?: string;
    logos?: { href: string }[];
  };
}

interface EspnEvent {
  id: string;
  date: string;
  name?: string;
  status?: { type?: { state?: string; completed?: boolean } };
  competitions?: {
    id: string;
    date: string;
    venue?: { fullName?: string };
    status?: { type?: { state?: string; completed?: boolean } };
    competitors?: EspnCompetitor[];
  }[];
}

interface EspnScoreboard {
  leagues?: { id?: string; name?: string; abbreviation?: string; logos?: { href: string }[] }[];
  events?: EspnEvent[] | null;
}

function scoreOf(c: EspnCompetitor | undefined): number | null {
  if (!c) return null;
  const raw = typeof c.score === "object" && c.score !== null ? (c.score.displayValue ?? c.score.value) : c.score;
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function logoOf(c: EspnCompetitor | undefined): string | null {
  return c?.team?.logo ?? c?.team?.logos?.[0]?.href ?? null;
}

export function makeMatchId(sport: Sport, league: string, eventId: string): string {
  return `${sport}~${league}~${eventId}`;
}

export function parseMatchId(id: string): { sport: Sport; league: string; eventId: string } | null {
  const [sport, league, eventId] = id.split("~");
  if (!sport || !league || !eventId) return null;
  if (sport !== "football" && sport !== "basketball") return null;
  return { sport, league, eventId };
}

function mapEvent(e: EspnEvent, sport: Sport, league: string, leagueName: string, leagueBadge: string | null): Match | null {
  const comp = e.competitions?.[0];
  const competitors = comp?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home?.team?.displayName || !away?.team?.displayName) return null;

  const state = comp?.status?.type?.state ?? e.status?.type?.state;
  const completed = comp?.status?.type?.completed ?? e.status?.type?.completed;
  const status: Match["status"] = completed || state === "post" ? "finished" : state === "in" ? "live" : "upcoming";

  return {
    id: makeMatchId(sport, league, e.id),
    sport,
    league: leagueName,
    leagueId: league,
    leagueBadge,
    homeTeam: home.team.displayName,
    awayTeam: away.team.displayName,
    homeBadge: logoOf(home),
    awayBadge: logoOf(away),
    kickoff: e.date ?? null,
    date: (e.date ?? "").slice(0, 10),
    status,
    homeScore: scoreOf(home),
    awayScore: scoreOf(away),
    venue: comp?.venue?.fullName ?? null,
  };
}

const eventIndex = new Map<string, Match>();

async function fetchLeagueDay(sport: Sport, league: string, date: string): Promise<Match[]> {
  const url = `${BASE}/${SPORT_PATH[sport]}/${league}/scoreboard?dates=${date.replace(/-/g, "")}&limit=200`;
  const data = await cachedJson<EspnScoreboard>(url, 3 * 60 * 1000);
  const leagueMeta = data?.leagues?.[0];
  const leagueName = leagueMeta?.name ?? league;
  const badge = leagueMeta?.logos?.[0]?.href ?? null;
  const matches: Match[] = [];
  for (const e of data?.events ?? []) {
    const m = mapEvent(e, sport, league, leagueName, badge);
    if (m) {
      eventIndex.set(m.id, m);
      matches.push(m);
    }
  }
  return matches;
}

export async function fetchEventsByDay(date: string, sport: Sport): Promise<Match[]> {
  const results = await Promise.all(
    LEAGUES[sport].map((league) => fetchLeagueDay(sport, league, date).catch(() => [])),
  );
  const seen = new Set<string>();
  return results.flat().filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

export interface PastResult {
  date: string;
  isHome: boolean;
  scored: number;
  conceded: number;
}

function formFrom(team: string, results: PastResult[]): TeamForm {
  return {
    team,
    played: results.length,
    wins: results.filter((r) => r.scored > r.conceded).length,
    draws: results.filter((r) => r.scored === r.conceded).length,
    losses: results.filter((r) => r.scored < r.conceded).length,
    scored: results.reduce((a, r) => a + r.scored, 0),
    conceded: results.reduce((a, r) => a + r.conceded, 0),
    formString: results
      .map((r) => (r.scored > r.conceded ? "W" : r.scored === r.conceded ? "D" : "L"))
      .join(""),
  };
}

interface EspnSummary {
  header?: {
    id?: string;
    competitions?: {
      date?: string;
      venue?: { fullName?: string };
      status?: { type?: { state?: string; completed?: boolean } };
      competitors?: EspnCompetitor[];
    }[];
    league?: { name?: string; slug?: string; logos?: { href: string }[] };
    leagues?: { name?: string; slug?: string; logos?: { href: string }[] }[];
  };
  lastFiveGames?: {
    team?: { id?: string; displayName?: string };
    events?: {
      gameDate?: string;
      homeTeamId?: string;
      awayTeamId?: string;
      homeTeamScore?: string;
      awayTeamScore?: string;
    }[];
  }[];
}

async function fetchSummary(sport: Sport, league: string, eventId: string): Promise<EspnSummary | null> {
  return cachedJson<EspnSummary>(
    `${BASE}/${SPORT_PATH[sport]}/${league}/summary?event=${eventId}`,
    10 * 60 * 1000,
  );
}

interface EspnSchedule {
  events?: {
    date?: string;
    competitions?: {
      status?: { type?: { completed?: boolean } };
      competitors?: EspnCompetitor[];
    }[];
  }[];
}

async function fetchTeamSchedule(
  sport: Sport,
  league: string,
  teamId: string,
  beforeDate?: string,
): Promise<PastResult[]> {
  const data = await cachedJson<EspnSchedule>(
    `${BASE}/${SPORT_PATH[sport]}/${league}/teams/${teamId}/schedule`,
    30 * 60 * 1000,
  );
  const out: PastResult[] = [];
  for (const e of data?.events ?? []) {
    const comp = e.competitions?.[0];
    if (!comp?.status?.type?.completed) continue;
    const date = (e.date ?? "").slice(0, 10);
    if (beforeDate && date >= beforeDate) continue;
    const me = comp.competitors?.find((c) => (c.team?.id ?? c.id) === teamId);
    const opp = comp.competitors?.find((c) => (c.team?.id ?? c.id) !== teamId);
    const mine = scoreOf(me);
    const theirs = scoreOf(opp);
    if (mine === null || theirs === null) continue;
    out.push({ date, isHome: me?.homeAway === "home", scored: mine, conceded: theirs });
  }
  return out.slice(-8);
}

function resultsFromLastFive(
  summary: EspnSummary,
  teamId: string,
  beforeDate?: string,
): PastResult[] {
  const block = summary.lastFiveGames?.find((b) => b.team?.id === teamId);
  const out: PastResult[] = [];
  for (const g of block?.events ?? []) {
    const date = (g.gameDate ?? "").slice(0, 10);
    if (beforeDate && date >= beforeDate) continue;
    const hs = Number(g.homeTeamScore);
    const as = Number(g.awayTeamScore);
    if (Number.isNaN(hs) || Number.isNaN(as)) continue;
    const isHome = g.homeTeamId === teamId;
    out.push({ date, isHome, scored: isHome ? hs : as, conceded: isHome ? as : hs });
  }
  return out;
}

export interface MatchContext {
  match: Match;
  home: { form: TeamForm; results: PastResult[] };
  away: { form: TeamForm; results: PastResult[] };
}

export async function fetchMatchContext(
  matchId: string,
  beforeDate?: string,
): Promise<MatchContext | null> {
  const parsed = parseMatchId(matchId);
  if (!parsed) return null;
  const { sport, league, eventId } = parsed;

  const summary = await fetchSummary(sport, league, eventId);
  const header = summary?.header;
  const comp = header?.competitions?.[0];
  const competitors = comp?.competitors ?? [];
  const homeC = competitors.find((c) => c.homeAway === "home");
  const awayC = competitors.find((c) => c.homeAway === "away");

  const indexed = eventIndex.get(matchId);
  let match = indexed ?? null;

  if (!match && homeC?.team?.displayName && awayC?.team?.displayName) {
    const leagueMeta = header?.league ?? header?.leagues?.[0];
    const state = comp?.status?.type?.state;
    match = {
      id: matchId,
      sport,
      league: leagueMeta?.name ?? league,
      leagueId: league,
      leagueBadge: leagueMeta?.logos?.[0]?.href ?? null,
      homeTeam: homeC.team.displayName,
      awayTeam: awayC.team.displayName,
      homeBadge: logoOf(homeC),
      awayBadge: logoOf(awayC),
      kickoff: comp?.date ?? null,
      date: (comp?.date ?? "").slice(0, 10),
      status: comp?.status?.type?.completed || state === "post" ? "finished" : state === "in" ? "live" : "upcoming",
      homeScore: scoreOf(homeC),
      awayScore: scoreOf(awayC),
      venue: comp?.venue?.fullName ?? null,
    };
  }
  if (!match) return null;

  const homeId = homeC?.team?.id ?? homeC?.id;
  const awayId = awayC?.team?.id ?? awayC?.id;

  let homeResults: PastResult[] = [];
  let awayResults: PastResult[] = [];

  if (summary && homeId && awayId) {
    homeResults = resultsFromLastFive(summary, homeId, beforeDate);
    awayResults = resultsFromLastFive(summary, awayId, beforeDate);
  }

  if (!homeResults.length && homeId) {
    homeResults = await fetchTeamSchedule(sport, league, homeId, beforeDate).catch(() => []);
  }
  if (!awayResults.length && awayId) {
    awayResults = await fetchTeamSchedule(sport, league, awayId, beforeDate).catch(() => []);
  }

  return {
    match,
    home: { form: formFrom(match.homeTeam, homeResults), results: homeResults },
    away: { form: formFrom(match.awayTeam, awayResults), results: awayResults },
  };
}

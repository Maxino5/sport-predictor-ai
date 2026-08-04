import type { Match, Sport, TeamForm } from "./types";

const BASE = "https://www.thesportsdb.com/api/v1/json/123";

const SPORT_QUERY: Record<Sport, string> = {
  football: "Soccer",
  basketball: "Basketball",
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

interface RawEvent {
  idEvent: string;
  strSport: string;
  strLeague: string;
  idLeague: string;
  strLeagueBadge: string | null;
  strHomeTeam: string;
  strAwayTeam: string;
  strHomeTeamBadge?: string | null;
  strAwayTeamBadge?: string | null;
  idHomeTeam: string;
  idAwayTeam: string;
  strTimestamp: string | null;
  dateEvent: string;
  strTime: string | null;
  strStatus: string | null;
  strVenue?: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strPostponed?: string | null;
}

function toStatus(e: RawEvent): Match["status"] {
  const s = (e.strStatus ?? "").toUpperCase();
  if (["FT", "AOT", "AET", "PEN", "MATCH FINISHED"].includes(s)) return "finished";
  if (s && !["NS", "NOT STARTED", "TBD", "POSTP", "PPD"].includes(s)) return "live";
  if (e.intHomeScore !== null && e.intAwayScore !== null && s !== "NS") return "finished";
  return "upcoming";
}

function mapEvent(e: RawEvent, sport: Sport): Match {
  return {
    id: e.idEvent,
    sport,
    league: e.strLeague,
    leagueId: e.idLeague,
    leagueBadge: e.strLeagueBadge ?? null,
    homeTeam: e.strHomeTeam,
    awayTeam: e.strAwayTeam,
    homeBadge: e.strHomeTeamBadge ?? null,
    awayBadge: e.strAwayTeamBadge ?? null,
    kickoff: e.strTimestamp ?? null,
    date: e.dateEvent,
    status: toStatus(e),
    homeScore: e.intHomeScore === null ? null : Number(e.intHomeScore),
    awayScore: e.intAwayScore === null ? null : Number(e.intAwayScore),
    venue: e.strVenue ?? null,
  };
}

const rawEventCache = new Map<string, RawEvent>();

export async function fetchEventsByDay(date: string, sport: Sport): Promise<Match[]> {
  const url = `${BASE}/eventsday.php?d=${date}&s=${SPORT_QUERY[sport]}`;
  const data = await cachedJson<{ events: RawEvent[] | null }>(url, 5 * 60 * 1000);
  const events = data?.events ?? [];
  for (const e of events) rawEventCache.set(e.idEvent, e);
  return events.filter((e) => e.strPostponed !== "yes").map((e) => mapEvent(e, sport));
}

export async function fetchEvent(
  id: string,
): Promise<{ match: Match; homeId: string; awayId: string } | null> {
  let raw = rawEventCache.get(id);
  if (!raw) {
    const data = await cachedJson<{ events: RawEvent[] | null }>(
      `${BASE}/lookupevent.php?id=${id}`,
      5 * 60 * 1000,
    );
    raw = data?.events?.[0];
  }
  if (!raw) return null;
  const sport: Sport = raw.strSport === "Basketball" ? "basketball" : "football";
  return { match: mapEvent(raw, sport), homeId: raw.idHomeTeam, awayId: raw.idAwayTeam };
}

export interface PastResult {
  date: string;
  isHome: boolean;
  scored: number;
  conceded: number;
}

/** Last completed results for a team, optionally only those before `beforeDate`. */
export async function fetchTeamResults(
  teamId: string,
  teamName: string,
  beforeDate?: string,
): Promise<{ form: TeamForm; results: PastResult[] }> {
  const data = await cachedJson<{ results: RawEvent[] | null }>(
    `${BASE}/eventslast.php?id=${teamId}`,
    30 * 60 * 1000,
  );
  const raw = (data?.results ?? []).filter(
    (e) =>
      e.intHomeScore !== null &&
      e.intAwayScore !== null &&
      (!beforeDate || e.dateEvent < beforeDate),
  );

  const results: PastResult[] = raw.map((e) => {
    const isHome = e.strHomeTeam === teamName || e.idHomeTeam === teamId;
    const hs = Number(e.intHomeScore);
    const as = Number(e.intAwayScore);
    return {
      date: e.dateEvent,
      isHome,
      scored: isHome ? hs : as,
      conceded: isHome ? as : hs,
    };
  });

  const form: TeamForm = {
    team: teamName,
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

  return { form, results };
}

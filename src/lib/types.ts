export type Sport = "football" | "basketball";

export type MatchStatus = "upcoming" | "live" | "finished";

export interface Match {
  id: string;
  sport: Sport;
  league: string;
  leagueId: string;
  leagueBadge: string | null;
  homeTeam: string;
  awayTeam: string;
  homeBadge: string | null;
  awayBadge: string | null;
  kickoff: string | null;
  date: string;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
}

export interface Selection {
  /** stable id, e.g. "1x2:home" */
  key: string;
  label: string;
  probability: number;
  /** fair decimal odds derived from probability */
  fairOdds: number;
}

export interface Market {
  id: string;
  name: string;
  note?: string;
  selections: Selection[];
}

export interface TeamForm {
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  scored: number;
  conceded: number;
  formString: string;
}

export interface Prediction {
  matchId: string;
  sport: Sport;
  generatedAt: string;
  expectedHome: number;
  expectedAway: number;
  expectedCorners: number | null;
  confidence: number;
  headline: string;
  reasoning: string;
  bestBet: { market: string; label: string; probability: number };
  markets: Market[];
  form: { home: TeamForm | null; away: TeamForm | null };
  aiEnhanced: boolean;
}

export interface ValuePick {
  match: Match;
  label: string;
  market: string;
  probability: number;
  confidence: number;
}

export interface AccuracyReport {
  windowDays: number;
  sampleSize: number;
  overall: number;
  byMarket: { market: string; hits: number; total: number; accuracy: number }[];
  recent: {
    matchId: string;
    fixture: string;
    league: string;
    date: string;
    score: string;
    picks: { market: string; label: string; probability: number; hit: boolean }[];
  }[];
}

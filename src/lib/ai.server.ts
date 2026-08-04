import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import type { Market, Sport, TeamForm } from "./types";

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
    supportsStructuredOutputs: true,
  });
}

const AnalysisSchema = z.object({
  headline: z.string(),
  reasoning: z.string(),
  confidence: z.number(),
  bestBetKey: z.string(),
  adjustments: z.array(
    z.object({
      key: z.string(),
      probability: z.number(),
    }),
  ),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

interface AnalyseArgs {
  sport: Sport;
  league: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string | null;
  form: { home: TeamForm | null; away: TeamForm | null };
  expectedHome: number;
  expectedAway: number;
  expectedCorners: number | null;
  markets: Market[];
}

function describeForm(f: TeamForm | null) {
  if (!f || f.played === 0) return "no recent completed matches on record";
  return `last ${f.played}: ${f.formString} (${f.wins}W-${f.draws}D-${f.losses}L), ${f.scored} for / ${f.conceded} against`;
}

export async function analyseMatch(args: AnalyseArgs): Promise<Analysis | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;

  const gateway = createLovableAiGatewayProvider(apiKey);

  const marketLines = args.markets
    .map(
      (m) =>
        `${m.name}\n` +
        m.selections
          .map((s) => `  ${s.key} | ${s.label} | model ${(s.probability * 100).toFixed(1)}%`)
          .join("\n"),
    )
    .join("\n");

  const prompt = `Fixture: ${args.homeTeam} (home) vs ${args.awayTeam} (away)
Competition: ${args.league} | Sport: ${args.sport} | Kickoff: ${args.kickoff ?? "TBC"}

Recent form
- ${args.homeTeam}: ${describeForm(args.form.home)}
- ${args.awayTeam}: ${describeForm(args.form.away)}

Statistical model expectation
- Expected ${args.sport === "basketball" ? "points" : "goals"}: home ${args.expectedHome}, away ${args.expectedAway}
${args.expectedCorners ? `- Expected corners: ${args.expectedCorners}` : ""}

Model probabilities by selection key:
${marketLines}

Task: act as a quantitative sports trader. Adjust the model probabilities where the form data, home advantage, competition context or scheduling suggest the pure Poisson/normal model is off. Keep adjustments disciplined: rarely move a probability by more than 12 percentage points, and keep mutually exclusive selections roughly summing to 100%. Return probabilities as decimals between 0.02 and 0.97 using the exact selection keys given. Pick one bestBetKey: the selection with the strongest edge and reasonable probability. confidence is 0-100. headline is under 70 characters. reasoning is 2-3 sentences of concrete analysis, no hedging boilerplate, no betting advice disclaimers.`;

  try {
    const { output } = await generateText({
      model: gateway("google/gemini-3.6-flash"),
      output: Output.object({ schema: AnalysisSchema }),
      system:
        "You are PitchIQ's prediction engine: a disciplined quantitative football and basketball analyst. You output calibrated probabilities, never certainties.",
      prompt,
    });
    return output;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      console.error("AI analysis returned unparsable output", error.text?.slice(0, 400));
      return null;
    }
    console.error("AI analysis failed", error);
    return null;
  }
}

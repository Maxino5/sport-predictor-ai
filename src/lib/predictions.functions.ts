import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const SportSchema = z.enum(["football", "basketball"]);

export const getDailyMatches = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ date: DateSchema, sport: SportSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { loadMatches } = await import("./predictions.server");
    return loadMatches(data.date, data.sport);
  });

export const getPrediction = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ matchId: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { buildPrediction } = await import("./predictions.server");
    return buildPrediction(data.matchId);
  });

export const getValuePicks = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ date: DateSchema }).parse(input))
  .handler(async ({ data }) => {
    const { buildValuePicks } = await import("./predictions.server");
    return buildValuePicks(data.date);
  });

export const getAccuracyReport = createServerFn({ method: "GET" }).handler(async () => {
  const { buildAccuracyReport } = await import("./predictions.server");
  return buildAccuracyReport(5);
});

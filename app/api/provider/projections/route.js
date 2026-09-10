import { sleeperWeeklyProjections } from "@/lib/sleeperprojections";

export async function GET(req) {
  const url = new URL(req.url);
  const season = url.searchParams.get("season");
  const week = url.searchParams.get("week");

  if (!season || !week) {
    return Response.json(
      { error: "season and week are required" },
      { status: 400 }
    );
  }

  try {
    const result = await sleeperWeeklyProjections({
      season: Number(season),
      week: Number(week)
    });

    return Response.json({
      configured: true,
      provider: result.provider,
      endpoint: result.endpoint,
      retrievedAt: new Date().toISOString(),
      season: Number(season),
      week: Number(week),
      projections: result.projections
    });
  } catch (error) {
    return Response.json({
      configured: false,
      provider: "Sleeper",
      error: "Sleeper projection feed unavailable",
      detail: String(error?.message || error),
      retrievedAt: new Date().toISOString(),
      projections: []
    });
  }
}

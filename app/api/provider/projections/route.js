import { sportsDataIO, normalizeProjection } from "@/lib/sportsdataio";

export async function GET(req) {
  const url = new URL(req.url);
  const season = url.searchParams.get("season");
  const week = url.searchParams.get("week");

  if (!season || !week) {
    return Response.json({ error: "season and week are required" }, { status: 400 });
  }

  try {
    const result = await sportsDataIO(
      `/PlayerGameProjectionStatsByWeek/${encodeURIComponent(season)}/${encodeURIComponent(week)}`,
      300
    );

    if (!result.configured) {
      return Response.json({
        configured: false,
        provider: "SportsDataIO",
        retrievedAt: new Date().toISOString(),
        projections: []
      });
    }

    const projections = Array.isArray(result.data)
      ? result.data.map(normalizeProjection)
      : [];

    return Response.json({
      configured: true,
      provider: "SportsDataIO",
      retrievedAt: new Date().toISOString(),
      season: Number(season),
      week: Number(week),
      projections
    });
  } catch (error) {
    return Response.json({
      configured: true,
      provider: "SportsDataIO",
      error: "Projection provider request failed",
      detail: String(error?.message || error),
      retrievedAt: new Date().toISOString(),
      projections: []
    }, { status: 502 });
  }
}

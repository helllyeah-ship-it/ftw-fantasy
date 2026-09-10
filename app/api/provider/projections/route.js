import { huddleBotProjections } from "@/lib/huddlebot";

export async function GET(req) {
  const url = new URL(req.url);
  const season = url.searchParams.get("season");
  const week = url.searchParams.get("week");

  if (!season || !week) {
    return Response.json({ error: "season and week are required" }, { status: 400 });
  }

  try {
    const result = await huddleBotProjections({
      season: Number(season),
      week: Number(week)
    });

    return Response.json({
      configured: result.configured,
      provider: "HuddleBot",
      retrievedAt: new Date().toISOString(),
      season: Number(season),
      week: Number(week),
      endpoint: result.endpoint || null,
      projections: result.projections || [],
      errors: result.configured ? undefined : result.errors
    }, { status: 200 });
  } catch (error) {
    return Response.json({
      configured: false,
      provider: "HuddleBot",
      error: "HuddleBot projection request failed",
      detail: String(error?.message || error),
      retrievedAt: new Date().toISOString(),
      projections: []
    }, { status: 200 });
  }
}

import { sleeper, jsonError } from "@/lib/sleeper";
export async function GET(req) {
  try {
    const sp = new URL(req.url).searchParams;
    const type = sp.get("type") === "drop" ? "drop" : "add";
    const hours = Math.min(168, Math.max(1, Number(sp.get("hours") || 24)));
    const limit = Math.min(50, Math.max(1, Number(sp.get("limit") || 25)));
    return Response.json(await sleeper(`/players/nfl/trending/${type}?lookback_hours=${hours}&limit=${limit}`, 60));
  } catch (e) {
    return jsonError("Unable to load trending players");
  }
}

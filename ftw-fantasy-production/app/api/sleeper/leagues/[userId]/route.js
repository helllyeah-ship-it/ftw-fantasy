import { sleeper, jsonError } from "@/lib/sleeper";
export async function GET(req, { params }) {
  try {
    const { userId } = await params;
    const season = new URL(req.url).searchParams.get("season");
    if (!season) return jsonError("Season is required", 400);
    return Response.json(await sleeper(`/user/${userId}/leagues/nfl/${season}`, 60));
  } catch (e) {
    return jsonError("Unable to load leagues");
  }
}

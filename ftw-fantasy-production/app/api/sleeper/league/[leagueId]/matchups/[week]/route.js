import { sleeper, jsonError } from "@/lib/sleeper";
export async function GET(_req, { params }) {
  try {
    const { leagueId, week } = await params;
    return Response.json(await sleeper(`/league/${leagueId}/matchups/${week}`, 15));
  } catch (e) {
    return jsonError("Unable to load matchups");
  }
}

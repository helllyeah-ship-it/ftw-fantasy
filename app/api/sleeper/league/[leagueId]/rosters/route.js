import { sleeper, jsonError } from "@/lib/sleeper";
export async function GET(_req, { params }) {
  try {
    const { leagueId } = await params;
    return Response.json(await sleeper(`/league/${leagueId}/rosters`, 30));
  } catch (e) {
    return jsonError("Unable to load rosters");
  }
}

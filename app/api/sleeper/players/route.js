import { sleeper, jsonError } from "@/lib/sleeper";
export async function GET() {
  try {
    // Sleeper recommends fetching the full player map at most about once/day.
    return Response.json(await sleeper("/players/nfl?active=true", 86400));
  } catch (e) {
    return jsonError("Unable to load players");
  }
}

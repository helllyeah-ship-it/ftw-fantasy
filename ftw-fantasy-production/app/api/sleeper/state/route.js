import { sleeper, jsonError } from "@/lib/sleeper";
export async function GET() {
  try {
    return Response.json(await sleeper("/state/nfl", 30));
  } catch (e) {
    return jsonError("Unable to load NFL state");
  }
}

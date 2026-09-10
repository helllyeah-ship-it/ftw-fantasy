import { sleeper, jsonError } from "@/lib/sleeper";
export async function GET(_req, { params }) {
  try {
    const { username } = await params;
    return Response.json(await sleeper(`/user/${encodeURIComponent(username)}`, 60));
  } catch (e) {
    return jsonError("Sleeper user not found", 404);
  }
}

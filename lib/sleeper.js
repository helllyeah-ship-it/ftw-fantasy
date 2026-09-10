const BASE = "https://api.sleeper.app/v1";

export async function sleeper(path, revalidate = 60) {
  const res = await fetch(`${BASE}${path}`, {
    next: { revalidate },
    headers: { "User-Agent": "FTW-Fantasy/1.0" },
  });
  if (!res.ok) {
    throw new Error(`Sleeper ${res.status}: ${path}`);
  }
  return res.json();
}

export function jsonError(message, status = 500) {
  return Response.json({ error: message }, { status });
}

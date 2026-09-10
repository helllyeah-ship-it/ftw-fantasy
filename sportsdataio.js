const BASE = "https://api.sportsdata.io/v3/nfl/projections/json";

export async function sportsDataIO(path, revalidate = 300) {
  const key = process.env.SPORTSDATAIO_API_KEY;
  if (!key) {
    return { configured: false, data: null };
  }

  const res = await fetch(`${BASE}${path}`, {
    next: { revalidate },
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Accept": "application/json",
      "User-Agent": "FTW-Fantasy/1.0"
    }
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SportsDataIO ${res.status}: ${body.slice(0,180)}`);
  }

  return { configured: true, data: await res.json() };
}

export function normalizeProjection(row) {
  return {
    providerPlayerId: row.PlayerID ?? null,
    name: row.Name ?? "",
    team: row.Team ?? "",
    position: row.Position ?? "",
    gameDate: row.GameDate ?? row.Date ?? null,
    opponent: row.Opponent ?? row.OpponentRank ?? null,
    homeOrAway: row.HomeOrAway ?? null,
    activated: row.Activated ?? null,
    started: row.Started ?? null,
    played: row.Played ?? null,
    injuryStatus: row.InjuryStatus ?? row.InjuryBodyPart ?? null,

    fantasyPoints: Number(row.FantasyPoints ?? 0),
    fantasyPointsPPR: Number(row.FantasyPointsPPR ?? row.FantasyPoints ?? 0),

    passingAttempts: Number(row.PassingAttempts ?? 0),
    passingYards: Number(row.PassingYards ?? 0),
    passingTouchdowns: Number(row.PassingTouchdowns ?? 0),
    passingInterceptions: Number(row.PassingInterceptions ?? 0),

    rushingAttempts: Number(row.RushingAttempts ?? 0),
    rushingYards: Number(row.RushingYards ?? 0),
    rushingTouchdowns: Number(row.RushingTouchdowns ?? 0),

    receivingTargets: Number(row.ReceivingTargets ?? 0),
    receptions: Number(row.Receptions ?? 0),
    receivingYards: Number(row.ReceivingYards ?? 0),
    receivingTouchdowns: Number(row.ReceivingTouchdowns ?? 0),

    fumblesLost: Number(row.FumblesLost ?? 0),
    twoPointPasses: Number(row.TwoPointConversionPasses ?? 0),
    twoPointRuns: Number(row.TwoPointConversionRuns ?? 0),
    twoPointReceptions: Number(row.TwoPointConversionReceptions ?? 0),
  };
}

const DEFAULT_ENDPOINTS = [
  "https://www.huddlebotai.com/api/projections",
  "https://www.huddlebotai.com/api/v1/projections",
  "https://api.huddlebotai.com/projections"
];

function num(...values) {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.projections)) return payload.projections;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.players)) return payload.players;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

export function normalizeProjection(row) {
  const player = row?.player || {};
  const stats = row?.stats || row?.statLine || row?.stat_line || {};
  const explanation = row?.explanation || row?.reasoning || row?.shap_explanation || null;

  const first = player.first_name || row.first_name || row.firstName || "";
  const last = player.last_name || row.last_name || row.lastName || "";
  const full = row.name || row.player_name || row.playerName || player.full_name ||
    `${first} ${last}`.trim();

  return {
    huddlebotId: String(row.id || player.id || row.player_id || row.playerId || ""),
    sleeperId: row.sleeper_id || row.sleeperId || player.sleeper_id || player.sleeperId || null,
    name: full,
    team: row.team || row.team_abbr || row.teamAbbr || player.team || "",
    position: row.position || row.pos || player.position || "",
    projectedPoints: num(
      row.projected_points,
      row.projectedPoints,
      row.projection,
      row.fantasy_points,
      row.fantasyPoints,
      row.predicted_points,
      row.predictedPoints,
      row.median,
      row.p50,
      row.mean
    ),
    floor: num(row.floor, row.p10, row.low, row.bust_projection),
    ceiling: num(row.ceiling, row.p90, row.high, row.boom_projection),
    boomProbability: num(row.boom_probability, row.boomProbability, row.boom_prob),
    bustProbability: num(row.bust_probability, row.bustProbability, row.bust_prob),
    explanation,

    passingAttempts: num(stats.pass_att, stats.passing_attempts, stats.passAtt) || 0,
    passingYards: num(stats.pass_yds, stats.passing_yards, stats.passYds) || 0,
    passingTouchdowns: num(stats.pass_tds, stats.passing_touchdowns, stats.passTds) || 0,
    passingInterceptions: num(stats.pass_ints, stats.interceptions, stats.passInts) || 0,

    rushingAttempts: num(stats.rush_att, stats.rushing_attempts, stats.rushAtt) || 0,
    rushingYards: num(stats.rush_yds, stats.rushing_yards, stats.rushYds) || 0,
    rushingTouchdowns: num(stats.rush_tds, stats.rushing_touchdowns, stats.rushTds) || 0,

    receivingTargets: num(stats.targets, stats.receiving_targets, stats.recTargets) || 0,
    receptions: num(stats.receptions, stats.rec) || 0,
    receivingYards: num(stats.rec_yds, stats.receiving_yards, stats.recYds) || 0,
    receivingTouchdowns: num(stats.rec_tds, stats.receiving_touchdowns, stats.recTds) || 0
  };
}

export async function huddleBotProjections({ season, week }) {
  const override = process.env.HUDDLEBOT_API_URL?.trim();
  const endpoints = override ? [override] : DEFAULT_ENDPOINTS;
  const errors = [];

  for (const base of endpoints) {
    try {
      const url = new URL(base);
      if (season) url.searchParams.set("season", String(season));
      if (week) url.searchParams.set("week", String(week));

      const res = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          "User-Agent": "FTW-Fantasy/1.0"
        },
        next: { revalidate: 300 }
      });

      if (!res.ok) {
        errors.push(`${url.origin}${url.pathname}: HTTP ${res.status}`);
        continue;
      }

      const payload = await res.json();
      const rows = getRows(payload);
      const projections = rows
        .map(normalizeProjection)
        .filter(x => x.name && Number.isFinite(x.projectedPoints));

      if (projections.length) {
        return {
          configured: true,
          provider: "HuddleBot",
          endpoint: `${url.origin}${url.pathname}`,
          projections
        };
      }

      errors.push(`${url.origin}${url.pathname}: no recognizable projection rows`);
    } catch (e) {
      errors.push(`${base}: ${String(e?.message || e)}`);
    }
  }

  return {
    configured: false,
    provider: "HuddleBot",
    projections: [],
    errors
  };
}

const BASES = [
  "https://api.sleeper.com/projections/nfl",
  "https://api.sleeper.app/projections/nfl"
];

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeRow(row, fallbackId = "") {
  const stats = row?.stats || row || {};
  const player = row?.player || {};
  const playerId = String(
    player.player_id ||
    row?.player_id ||
    row?.playerId ||
    fallbackId ||
    ""
  );

  return {
    sleeperId: playerId,
    name:
      player.full_name ||
      row?.full_name ||
      row?.player_name ||
      `${player.first_name || row?.first_name || ""} ${player.last_name || row?.last_name || ""}`.trim(),
    team: player.team || row?.team || "",
    position: player.position || row?.position || row?.pos || "",

    projectedPointsStd: num(stats.pts_std),
    projectedPointsHalf: num(stats.pts_half_ppr ?? stats.pts_half),
    projectedPointsPpr: num(stats.pts_ppr),

    passingAttempts: num(stats.pass_att) || 0,
    passingYards: num(stats.pass_yd) || 0,
    passingTouchdowns: num(stats.pass_td) || 0,
    passingInterceptions: num(stats.pass_int) || 0,

    rushingAttempts: num(stats.rush_att) || 0,
    rushingYards: num(stats.rush_yd) || 0,
    rushingTouchdowns: num(stats.rush_td) || 0,

    receivingTargets: num(stats.rec_tgt ?? stats.rec_target) || 0,
    receptions: num(stats.rec) || 0,
    receivingYards: num(stats.rec_yd) || 0,
    receivingTouchdowns: num(stats.rec_td) || 0,

    fumblesLost: num(stats.fum_lost) || 0,
    passingTwoPointConversions: num(stats.pass_2pt) || 0,
    rushingTwoPointConversions: num(stats.rush_2pt) || 0,
    receivingTwoPointConversions: num(stats.rec_2pt) || 0,

    passingCompletions: num(stats.pass_cmp) || 0,
    passingFirstDowns: num(stats.pass_fd) || 0,
    rushingFirstDowns: num(stats.rush_fd) || 0,
    receivingFirstDowns: num(stats.rec_fd) || 0,

    fieldGoalsMade: num(stats.fgm) || 0,
    extraPointsMade: num(stats.xpm) || 0
  };
}

function rowsFromPayload(payload) {
  if (Array.isArray(payload)) {
    return payload.map(r => normalizeRow(r));
  }

  if (payload && typeof payload === "object") {
    return Object.entries(payload).map(([playerId, row]) =>
      normalizeRow(row, playerId)
    );
  }

  return [];
}

export async function sleeperWeeklyProjections({ season, week }) {
  const errors = [];

  for (const base of BASES) {
    const url = `${base}/${encodeURIComponent(season)}/${encodeURIComponent(week)}?season_type=regular`;

    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "FTW-Fantasy/1.0"
        },
        next: { revalidate: 300 }
      });

      if (!res.ok) {
        errors.push(`${base}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const rows = rowsFromPayload(data).filter(x =>
        x.sleeperId &&
        (
          Number.isFinite(x.projectedPointsPpr) ||
          Number.isFinite(x.projectedPointsHalf) ||
          Number.isFinite(x.projectedPointsStd)
        )
      );

      if (rows.length) {
        return {
          provider: "Sleeper",
          endpoint: url,
          projections: rows
        };
      }

      errors.push(`${base}: response had no weekly fantasy-point projections`);
    } catch (error) {
      errors.push(`${base}: ${String(error?.message || error)}`);
    }
  }

  throw new Error(errors.join(" | "));
}

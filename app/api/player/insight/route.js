import { sleeperWeeklyProjections } from "@/lib/sleeperprojections";

function cleanText(v) {
  return typeof v === "string" ? v.trim() : "";
}

function findOpponent(schedule, teamAbbr, week) {
  const events = Array.isArray(schedule?.events) ? schedule.events : [];
  const wanted = String(teamAbbr || "").toUpperCase();

  for (const event of events) {
    const eventWeek =
      Number(event?.week?.number) ||
      Number(event?.week) ||
      Number(event?.season?.week) ||
      null;

    if (eventWeek !== Number(week)) continue;

    const competition = event?.competitions?.[0];
    const competitors = Array.isArray(competition?.competitors)
      ? competition.competitors
      : [];

    const mine = competitors.find(c =>
      String(c?.team?.abbreviation || "").toUpperCase() === wanted
    );
    const opp = competitors.find(c => c !== mine);

    return {
      opponent: opp?.team?.abbreviation || opp?.team?.shortDisplayName || "TBD",
      homeAway: mine?.homeAway || "",
      date: event?.date || competition?.date || null,
      eventName: event?.shortName || event?.name || "",
      completed: Boolean(event?.status?.type?.completed)
    };
  }

  return { opponent: "TBD", homeAway: "", date: null, eventName: "", completed: false };
}

function normalizeNews(payload) {
  const articles = Array.isArray(payload?.articles)
    ? payload.articles
    : Array.isArray(payload?.news)
      ? payload.news
      : [];

  return articles.slice(0, 8).map(a => ({
    id: String(a?.id || a?.nowId || a?.headline || Math.random()),
    headline: cleanText(a?.headline || a?.title),
    description: cleanText(a?.description || a?.story || a?.summary),
    published: a?.published || a?.lastModified || a?.date || null,
    link:
      a?.links?.web?.href ||
      a?.link ||
      a?.url ||
      null,
    image:
      a?.images?.[0]?.url ||
      a?.image?.url ||
      null
  })).filter(x => x.headline);
}

function normalizeInjury(payload, espnId, playerName) {
  const all = [];

  if (Array.isArray(payload?.injuries)) all.push(...payload.injuries);
  if (Array.isArray(payload?.items)) all.push(...payload.items);

  for (const group of Array.isArray(payload?.injuries) ? payload.injuries : []) {
    if (Array.isArray(group?.items)) all.push(...group.items);
  }

  const id = String(espnId || "");
  const target = String(playerName || "").toLowerCase();

  const hit = all.find(item => {
    const athlete = item?.athlete || item?.player || {};
    const athleteId = String(athlete?.id || item?.athleteId || item?.playerId || "");
    const athleteName = String(
      athlete?.displayName ||
      athlete?.fullName ||
      item?.displayName ||
      item?.name ||
      ""
    ).toLowerCase();
    return (id && athleteId === id) || (target && athleteName === target);
  });

  if (!hit) return null;

  return {
    status:
      hit?.status ||
      hit?.type?.description ||
      hit?.type?.name ||
      hit?.details?.type ||
      null,
    bodyPart:
      hit?.details?.location ||
      hit?.bodyPart ||
      hit?.location ||
      null,
    detail:
      hit?.details?.detail ||
      hit?.details?.shortComment ||
      hit?.shortComment ||
      hit?.longComment ||
      hit?.description ||
      null
  };
}

export async function GET(req) {
  const url = new URL(req.url);
  const season = Number(url.searchParams.get("season"));
  const currentWeek = Number(url.searchParams.get("week"));
  const sleeperId = String(url.searchParams.get("sleeperId") || "");
  const espnId = String(url.searchParams.get("espnId") || "");
  const team = String(url.searchParams.get("team") || "");
  const playerName = String(url.searchParams.get("name") || "");

  if (!season || !currentWeek || !sleeperId) {
    return Response.json(
      { error: "season, week and sleeperId are required" },
      { status: 400 }
    );
  }

  const lastWeek = 18;
  const weeks = Array.from(
    { length: Math.max(0, lastWeek - currentWeek + 1) },
    (_, i) => currentWeek + i
  );

  const [projectionResults, scheduleResult, newsResult, injuryResult] = await Promise.all([
    Promise.all(
      weeks.map(async week => {
        try {
          const result = await sleeperWeeklyProjections({ season, week });
          const p = result.projections.find(
            row => String(row.sleeperId) === sleeperId
          );
          if (!p) return { week, projection: null };
          return {
            week,
            projection: {
              passingAttempts: p.passingAttempts,
              passingYards: p.passingYards,
              passingTouchdowns: p.passingTouchdowns,
              passingInterceptions: p.passingInterceptions,
              rushingAttempts: p.rushingAttempts,
              rushingYards: p.rushingYards,
              rushingTouchdowns: p.rushingTouchdowns,
              targets: p.receivingTargets,
              receptions: p.receptions,
              receivingYards: p.receivingYards,
              receivingTouchdowns: p.receivingTouchdowns,
              fumblesLost: p.fumblesLost,
              passingTwoPointConversions: p.passingTwoPointConversions,
              rushingTwoPointConversions: p.rushingTwoPointConversions,
              receivingTwoPointConversions: p.receivingTwoPointConversions
            }
          };
        } catch {
          return { week, projection: null };
        }
      })
    ),
    team
      ? fetch(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${encodeURIComponent(team.toLowerCase())}/schedule?season=${season}&seasontype=2`,
          { next: { revalidate: 1800 } }
        ).then(r => r.ok ? r.json() : null).catch(() => null)
      : Promise.resolve(null),
    espnId
      ? fetch(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/${encodeURIComponent(espnId)}/news?limit=8`,
          { next: { revalidate: 600 } }
        ).then(r => r.ok ? r.json() : null).catch(() => null)
      : Promise.resolve(null),
    team
      ? fetch(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${encodeURIComponent(team.toLowerCase())}/injuries`,
          { next: { revalidate: 600 } }
        ).then(r => r.ok ? r.json() : null).catch(() => null)
      : Promise.resolve(null)
  ]);

  const future = projectionResults.map(row => ({
    ...row,
    matchup: findOpponent(scheduleResult, team, row.week)
  }));

  return Response.json({
    player: {
      sleeperId,
      espnId: espnId || null,
      name: playerName || null,
      team: team || null
    },
    currentWeek,
    future,
    news: normalizeNews(newsResult),
    espnInjury: normalizeInjury(injuryResult, espnId, playerName),
    sources: {
      projections: "Sleeper",
      schedule: "ESPN",
      news: "ESPN",
      injuries: "Sleeper + ESPN when available"
    },
    retrievedAt: new Date().toISOString()
  });
}

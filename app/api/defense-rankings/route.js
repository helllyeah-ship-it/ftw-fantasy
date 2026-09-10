const TEAM_IDS = {
  ARI:22, ATL:1, BAL:33, BUF:2, CAR:29, CHI:3, CIN:4, CLE:5,
  DAL:6, DEN:7, DET:8, GB:9, HOU:34, IND:11, JAX:30, KC:12,
  LV:13, LAC:24, LAR:14, MIA:15, MIN:16, NE:17, NO:18, NYG:19,
  NYJ:20, PHI:21, PIT:23, SF:25, SEA:26, TB:27, TEN:10, WAS:28
};

function number(v){
  const n=Number(v);
  return Number.isFinite(n)?n:null;
}

function collectStats(node,out=[]){
  if(!node||typeof node!=="object")return out;

  if(Array.isArray(node)){
    for(const x of node)collectStats(x,out);
    return out;
  }

  if(typeof node.name==="string" && (node.value!==undefined || node.displayValue!==undefined)){
    out.push({
      name:String(node.name||""),
      label:String(node.label||node.displayName||""),
      value:number(node.value),
      displayValue:node.displayValue
    });
  }

  for(const value of Object.values(node)){
    if(value&&typeof value==="object")collectStats(value,out);
  }
  return out;
}

function findStat(stats,names){
  const wanted=names.map(x=>x.toLowerCase());
  for(const stat of stats){
    const n=stat.name.toLowerCase();
    const l=stat.label.toLowerCase();
    if(wanted.some(w=>n===w||n.includes(w)||l===w||l.includes(w))){
      if(Number.isFinite(stat.value))return stat.value;
      const parsed=parseFloat(String(stat.displayValue||"").replace(/,/g,""));
      if(Number.isFinite(parsed))return parsed;
    }
  }
  return null;
}

function statMap(stats){
  const map={};
  for(const stat of stats){
    if(!stat?.name)continue;
    const key=String(stat.name);
    if(map[key]===undefined){
      map[key]=Number.isFinite(stat.value)?stat.value:stat.displayValue;
    }
  }
  return map;
}

function perGame(total,direct,games){
  if(Number.isFinite(direct))return direct;
  if(Number.isFinite(total)&&games>0)return total/games;
  return null;
}

async function teamDefense(abbr,id){
  const url=`https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/types/2/teams/${id}/statistics`;
  const res=await fetch(url,{next:{revalidate:86400}});
  if(!res.ok)throw new Error(`${abbr}: HTTP ${res.status}`);
  const json=await res.json();
  const stats=collectStats(json);

  const games=findStat(stats,["gamesPlayed","games played"])||17;

  const passYards=findStat(stats,[
    "passingYardsAllowed","netPassingYardsAllowed","passYardsAllowed",
    "opponentPassingYards","passing yards allowed"
  ]);
  const rushYards=findStat(stats,[
    "rushingYardsAllowed","rushYardsAllowed","opponentRushingYards",
    "rushing yards allowed"
  ]);
  const pointsAllowed=findStat(stats,[
    "pointsAllowed","opponentPoints","totalPointsAllowed","points allowed"
  ]);

  const passPerGame=findStat(stats,[
    "passingYardsAllowedPerGame","opponentPassingYardsPerGame","passing yards allowed per game"
  ]);
  const rushPerGame=findStat(stats,[
    "rushingYardsAllowedPerGame","opponentRushingYardsPerGame","rushing yards allowed per game"
  ]);
  const pointsPerGame=findStat(stats,[
    "pointsAllowedPerGame","opponentPointsPerGame","points allowed per game"
  ]);

  const passAttemptsAllowed=findStat(stats,[
    "passingAttemptsAllowed","opponentPassingAttempts","pass attempts allowed"
  ]);
  const passCompletionsAllowed=findStat(stats,[
    "passingCompletionsAllowed","opponentPassingCompletions","pass completions allowed"
  ]);
  const passTdsAllowed=findStat(stats,[
    "passingTouchdownsAllowed","passTouchdownsAllowed","opponentPassingTouchdowns","passing touchdowns allowed"
  ]);
  const interceptions=findStat(stats,[
    "interceptions","defensiveInterceptions","passesIntercepted","interceptions made"
  ]);
  const sacks=findStat(stats,["sacks","defensiveSacks","sacks made"]);
  const opponentPasserRating=findStat(stats,[
    "opponentPasserRating","passerRatingAllowed","opponent quarterback rating"
  ]);
  const passYardsPerAttempt=findStat(stats,[
    "opponentYardsPerPassAttempt","passingYardsPerAttemptAllowed","yards per pass attempt allowed"
  ]);

  const rushAttemptsAllowed=findStat(stats,[
    "rushingAttemptsAllowed","opponentRushingAttempts","rush attempts allowed"
  ]);
  const rushTdsAllowed=findStat(stats,[
    "rushingTouchdownsAllowed","rushTouchdownsAllowed","opponentRushingTouchdowns","rushing touchdowns allowed"
  ]);
  const rushYardsPerAttempt=findStat(stats,[
    "opponentYardsPerRushAttempt","rushingYardsPerAttemptAllowed","yards per rush attempt allowed","yards per carry allowed"
  ]);

  const takeaways=findStat(stats,["takeaways","totalTakeaways","takeaways total"]);
  const fumbleRecoveries=findStat(stats,["fumbleRecoveries","defensiveFumbleRecoveries"]);
  const thirdDownPct=findStat(stats,[
    "opponentThirdDownConvPct","thirdDownConversionPctAllowed","third down conversion percentage allowed"
  ]);
  const redZonePct=findStat(stats,[
    "opponentRedZonePct","redZoneTouchdownPctAllowed","red zone touchdown percentage allowed"
  ]);

  return {
    team:abbr,
    games,
    passYardsPerGame:perGame(passYards,passPerGame,games),
    rushYardsPerGame:perGame(rushYards,rushPerGame,games),
    pointsAllowedPerGame:perGame(pointsAllowed,pointsPerGame,games),

    passing:{
      attemptsAllowed:passAttemptsAllowed,
      completionsAllowed:passCompletionsAllowed,
      touchdownsAllowed:passTdsAllowed,
      interceptions,
      sacks,
      passerRatingAllowed:opponentPasserRating,
      yardsPerAttemptAllowed:passYardsPerAttempt
    },
    rushing:{
      attemptsAllowed:rushAttemptsAllowed,
      touchdownsAllowed:rushTdsAllowed,
      yardsPerAttemptAllowed:rushYardsPerAttempt
    },
    situational:{
      takeaways,
      fumbleRecoveries,
      thirdDownPctAllowed:thirdDownPct,
      redZoneTdPctAllowed:redZonePct
    },

    // Keep the complete 2025 stat payload available for FTW's future models.
    allStats:statMap(stats)
  };
}

function rank(rows,key){
  const valid=rows.filter(x=>Number.isFinite(x[key])).sort((a,b)=>a[key]-b[key]);
  const map={};
  valid.forEach((row,i)=>{map[row.team]=i+1;});
  return map;
}

export async function GET(){
  try{
    const rows=(await Promise.all(
      Object.entries(TEAM_IDS).map(([abbr,id])=>teamDefense(abbr,id).catch(()=>null))
    )).filter(Boolean);

    // FTW matchup ranking:
    // #1 allows the fewest yards/game (toughest); #32 allows the most (best matchup).
    const passRanks=rank(rows,"passYardsPerGame");
    const rushRanks=rank(rows,"rushYardsPerGame");
    const overallRanks=rank(rows,"pointsAllowedPerGame");

    const rankings={};
    for(const row of rows){
      rankings[row.team]={
        passRank:passRanks[row.team]||null,
        rushRank:rushRanks[row.team]||null,
        overallRank:overallRanks[row.team]||null,
        passYardsPerGame:row.passYardsPerGame,
        rushYardsPerGame:row.rushYardsPerGame,
        pointsAllowedPerGame:row.pointsAllowedPerGame,
        passing:row.passing,
        rushing:row.rushing,
        situational:row.situational,
        allStats:row.allStats
      };
    }

    return Response.json({
      season:2025,
      source:"ESPN 2025 regular-season team statistics",
      methodology:{
        QB:"2025 opponent pass-yards-allowed per game rank",
        WR:"2025 opponent pass-yards-allowed per game rank",
        TE:"2025 opponent pass-yards-allowed per game rank",
        RB:"2025 opponent rush-yards-allowed per game rank",
        other:"2025 opponent points-allowed per game rank",
        rankMeaning:"#1 = toughest defense, #32 = most favorable matchup",
        colorTiers:"Red 1-10, Yellow 11-22, Green 23-32"
      },
      rankings,
      retrievedAt:new Date().toISOString()
    });
  }catch(error){
    return Response.json({
      season:2025,
      rankings:{},
      error:"Could not build 2025 defense rankings",
      detail:String(error?.message||error)
    },{status:200});
  }
}

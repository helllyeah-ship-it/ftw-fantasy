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

  if(
    typeof node.name==="string" &&
    (node.value!==undefined || node.displayValue!==undefined)
  ){
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

async function teamDefense(abbr,id){
  const url=`https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/types/2/teams/${id}/statistics`;
  const res=await fetch(url,{next:{revalidate:86400}});
  if(!res.ok)throw new Error(`${abbr}: HTTP ${res.status}`);
  const json=await res.json();
  const stats=collectStats(json);

  const games=findStat(stats,["gamesPlayed","games played"])||17;

  let passYards=findStat(stats,[
    "passingYardsAllowed","netPassingYardsAllowed","passYardsAllowed",
    "opponentPassingYards","passing yards allowed"
  ]);
  let rushYards=findStat(stats,[
    "rushingYardsAllowed","rushYardsAllowed","opponentRushingYards",
    "rushing yards allowed"
  ]);
  let pointsAllowed=findStat(stats,[
    "pointsAllowed","opponentPoints","totalPointsAllowed","points allowed"
  ]);

  // ESPN sometimes exposes per-game values directly.
  const passPerGame=findStat(stats,[
    "passingYardsAllowedPerGame","opponentPassingYardsPerGame","passing yards allowed per game"
  ]);
  const rushPerGame=findStat(stats,[
    "rushingYardsAllowedPerGame","opponentRushingYardsPerGame","rushing yards allowed per game"
  ]);
  const pointsPerGame=findStat(stats,[
    "pointsAllowedPerGame","opponentPointsPerGame","points allowed per game"
  ]);

  return {
    team:abbr,
    passYardsPerGame:Number.isFinite(passPerGame)?passPerGame:(Number.isFinite(passYards)?passYards/games:null),
    rushYardsPerGame:Number.isFinite(rushPerGame)?rushPerGame:(Number.isFinite(rushYards)?rushYards/games:null),
    pointsAllowedPerGame:Number.isFinite(pointsPerGame)?pointsPerGame:(Number.isFinite(pointsAllowed)?pointsAllowed/games:null)
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
      Object.entries(TEAM_IDS).map(([abbr,id])=>
        teamDefense(abbr,id).catch(()=>null)
      )
    )).filter(Boolean);

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
        pointsAllowedPerGame:row.pointsAllowedPerGame
      };
    }

    return Response.json({
      season:2025,
      methodology:{
        QB:"2025 opponent pass-yards-allowed rank",
        WR:"2025 opponent pass-yards-allowed rank",
        TE:"2025 opponent pass-yards-allowed rank",
        RB:"2025 opponent rush-yards-allowed rank",
        other:"2025 opponent points-allowed rank",
        rankMeaning:"#1 = toughest defense, #32 = most favorable",
        tiers:"Hard 1-10, Medium 11-22, Easy 23-32"
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

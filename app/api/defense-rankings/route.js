const FRONT_CSV =
  "https://raw.githubusercontent.com/mccallj/Does-Your-Team-Defense-Actually-Hold-Up/main/data/def_front_2025.csv";
const OVERVIEW_CSV =
  "https://raw.githubusercontent.com/mccallj/Does-Your-Team-Defense-Actually-Hold-Up/main/data/def_overview_2025.csv";

const TEAM_FIX = {
  LA:"LAR"
};

function splitCsvLine(line){
  const out=[];
  let cur="";
  let quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(quoted && line[i+1]==='"'){cur+='"';i++;}
      else quoted=!quoted;
    }else if(ch==="," && !quoted){
      out.push(cur);
      cur="";
    }else cur+=ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text){
  const lines=String(text||"").trim().split(/\r?\n/).filter(Boolean);
  if(!lines.length)return [];
  const headers=splitCsvLine(lines[0]);
  return lines.slice(1).map(line=>{
    const vals=splitCsvLine(line);
    const row={};
    headers.forEach((h,i)=>row[h]=vals[i]??"");
    return row;
  });
}

function n(v){
  const x=Number(v);
  return Number.isFinite(x)?x:null;
}

function weighted(rows,key){
  let total=0, weight=0;
  for(const row of rows){
    const value=n(row[key]);
    const plays=n(row.plays);
    if(Number.isFinite(value)&&Number.isFinite(plays)&&plays>0){
      total+=value*plays;
      weight+=plays;
    }
  }
  return weight?total/weight:null;
}

function sum(rows,key){
  let total=0, seen=false;
  for(const row of rows){
    const value=n(row[key]);
    if(Number.isFinite(value)){
      total+=value;
      seen=true;
    }
  }
  return seen?total:null;
}

function rankMetric(rows,key,{higherBetter=false}={}){
  const valid=rows
    .filter(r=>Number.isFinite(r[key]))
    .slice()
    .sort((a,b)=>higherBetter ? b[key]-a[key] : a[key]-b[key]);
  const map={};
  valid.forEach((r,i)=>map[r.team]=i+1);
  return map;
}

function compositeRank(rows,weights){
  const metricRanks={};
  for(const w of weights){
    metricRanks[w.key]=rankMetric(rows,w.key,{higherBetter:w.higherBetter});
  }

  for(const row of rows){
    let score=0, used=0;
    for(const w of weights){
      const rank=metricRanks[w.key]?.[row.team];
      if(Number.isFinite(rank)){
        score+=rank*w.weight;
        used+=w.weight;
      }
    }
    row.compositeScore=used?score/used:null;
    row.metricRanks=Object.fromEntries(
      weights.map(w=>[w.key,metricRanks[w.key]?.[row.team]||null])
    );
  }

  const final=rows
    .filter(r=>Number.isFinite(r.compositeScore))
    .slice()
    .sort((a,b)=>a.compositeScore-b.compositeScore);

  const rank={};
  final.forEach((r,i)=>rank[r.team]=i+1);
  return rank;
}

async function fetchCsv(url){
  const res=await fetch(url,{
    headers:{
      Accept:"text/csv,text/plain,*/*",
      "User-Agent":"FTW-Fantasy/1.0"
    },
    next:{revalidate:86400}
  });
  if(!res.ok)throw new Error(`Data source HTTP ${res.status}`);
  return parseCsv(await res.text());
}

export async function GET(){
  try{
    const [frontRows,overviewRows]=await Promise.all([
      fetchCsv(FRONT_CSV),
      fetchCsv(OVERVIEW_CSV)
    ]);

    const teams=[...new Set(frontRows.map(r=>TEAM_FIX[r.defteam]||r.defteam).filter(Boolean))];

    const pass=[];
    const rush=[];

    for(const team of teams){
      const rawTeam=team==="LAR"?"LA":team;

      const passRows=frontRows.filter(r=>r.defteam===rawTeam&&r.play_type==="pass");
      const runRows=frontRows.filter(r=>r.defteam===rawTeam&&r.play_type==="run");

      const passPlays=sum(passRows,"plays")||0;
      const rushPlays=sum(runRows,"plays")||0;

      pass.push({
        team,
        plays:passPlays,
        epaAllowed:weighted(passRows,"epa_allowed"),
        successRateAllowed:weighted(passRows,"success_rate_allowed"),
        yardsPerPlayAllowed:weighted(passRows,"yards_allowed"),
        tdRateAllowed:weighted(passRows,"td_rate"),
        firstDownRateAllowed:weighted(passRows,"first_down_rate"),
        pressureRate:weighted(passRows,"pressure_rate"),
        interceptions:sum(passRows,"interceptions"),
        sacks:sum(passRows,"sacks"),
        yacAllowed:weighted(passRows,"yac_allowed"),
        interceptionRate:passPlays?sum(passRows,"interceptions")/passPlays:null,
        sackRate:passPlays?sum(passRows,"sacks")/passPlays:null
      });

      rush.push({
        team,
        plays:rushPlays,
        epaAllowed:weighted(runRows,"epa_allowed"),
        successRateAllowed:weighted(runRows,"success_rate_allowed"),
        yardsPerPlayAllowed:weighted(runRows,"yards_allowed"),
        tdRateAllowed:weighted(runRows,"td_rate"),
        firstDownRateAllowed:weighted(runRows,"first_down_rate")
      });
    }

    // A stronger position-specific rating than "yards allowed" alone.
    // Lower final rank = tougher defense.
    const passRank=compositeRank(pass,[
      {key:"epaAllowed",weight:.30},
      {key:"successRateAllowed",weight:.20},
      {key:"yardsPerPlayAllowed",weight:.20},
      {key:"tdRateAllowed",weight:.12},
      {key:"pressureRate",weight:.08,higherBetter:true},
      {key:"sackRate",weight:.05,higherBetter:true},
      {key:"interceptionRate",weight:.05,higherBetter:true}
    ]);

    const rushRank=compositeRank(rush,[
      {key:"epaAllowed",weight:.30},
      {key:"successRateAllowed",weight:.25},
      {key:"yardsPerPlayAllowed",weight:.25},
      {key:"tdRateAllowed",weight:.12},
      {key:"firstDownRateAllowed",weight:.08}
    ]);

    const overview={};
    for(const r of overviewRows){
      const team=TEAM_FIX[r.defteam]||r.defteam;
      if(!team)continue;
      overview[team]={
        plays:n(r.plays),
        epaAllowed:n(r.epa_allowed),
        successRateAllowed:n(r.success_rate_allowed),
        yardsPerPlayAllowed:n(r.yards_allowed),
        tdRateAllowed:n(r.td_rate),
        pressureRate:n(r.pressure_rate),
        interceptions:n(r.interceptions),
        sacks:n(r.sacks),
        epaRank:n(r.epa_rank),
        successRank:n(r.success_rank),
        yardsRank:n(r.yards_rank)
      };
    }

    const rankings={};
    for(const team of teams){
      const p=pass.find(x=>x.team===team)||{};
      const r=rush.find(x=>x.team===team)||{};
      rankings[team]={
        passRank:passRank[team]||null,
        rushRank:rushRank[team]||null,
        overallRank:overview[team]?.epaRank||null,

        passing:{
          plays:p.plays??null,
          epaAllowed:p.epaAllowed??null,
          successRateAllowed:p.successRateAllowed??null,
          yardsPerPlayAllowed:p.yardsPerPlayAllowed??null,
          tdRateAllowed:p.tdRateAllowed??null,
          firstDownRateAllowed:p.firstDownRateAllowed??null,
          pressureRate:p.pressureRate??null,
          interceptions:p.interceptions??null,
          sacks:p.sacks??null,
          yacAllowed:p.yacAllowed??null,
          metricRanks:p.metricRanks||{}
        },

        rushing:{
          plays:r.plays??null,
          epaAllowed:r.epaAllowed??null,
          successRateAllowed:r.successRateAllowed??null,
          yardsPerPlayAllowed:r.yardsPerPlayAllowed??null,
          tdRateAllowed:r.tdRateAllowed??null,
          firstDownRateAllowed:r.firstDownRateAllowed??null,
          metricRanks:r.metricRanks||{}
        },

        overall:overview[team]||null
      };
    }

    if(Object.keys(rankings).length!==32){
      throw new Error(`Expected 32 teams, received ${Object.keys(rankings).length}`);
    }

    return Response.json({
      season:2025,
      source:"nflverse 2025 regular-season play-by-play derived defense data",
      sourceDetail:"Pre-aggregated from nflverse play-by-play in the public Defense Report dataset",
      methodology:{
        QB:"2025 composite pass-defense rank",
        WR:"2025 composite pass-defense rank",
        TE:"2025 composite pass-defense rank",
        RB:"2025 composite rush-defense rank",
        passWeights:"EPA 30%, success rate 20%, yards/play 20%, TD rate 12%, pressure 8%, sacks 5%, interceptions 5%",
        rushWeights:"EPA 30%, success rate 25%, yards/play 25%, TD rate 12%, first-down rate 8%",
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
      error:"2025 nflverse defense data unavailable",
      detail:String(error?.message||error)
    },{status:200});
  }
}

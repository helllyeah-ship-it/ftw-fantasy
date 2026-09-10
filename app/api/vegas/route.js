const API_BASE="https://api.sportsgameodds.com/v2/events";

const PROP_STATS=new Set([
  "passing_yards",
  "passing_touchdowns",
  "passing_attempts",
  "passing_completions",
  "rushing_yards",
  "rushing_attempts",
  "rushing_touchdowns",
  "receiving_yards",
  "receiving_receptions",
  "receiving_targets",
  "receiving_touchdowns",
  "rushing+receiving_yards",
  "touchdowns"
]);

function num(v){
  const n=Number(v);
  return Number.isFinite(n)?n:null;
}

function normalizeName(value){
  return String(value||"")
    .toLowerCase()
    .replace(/[^a-z0-9]/g,"");
}

function playerNameFromID(playerID){
  const parts=String(playerID||"").split("_");
  // SportsGameOdds player IDs commonly end with sequence + NFL.
  if(parts.length>=3 && parts[parts.length-1]==="NFL"){
    parts.pop();
    if(/^\d+$/.test(parts[parts.length-1]||""))parts.pop();
  }
  return parts.map(x=>x.toLowerCase()).join(" ");
}

function americanToProbability(odds){
  const a=num(odds);
  if(!Number.isFinite(a)||a===0)return null;
  return a<0 ? (-a)/((-a)+100) : 100/(a+100);
}

function median(values){
  const nums=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!nums.length)return null;
  const mid=Math.floor(nums.length/2);
  return nums.length%2?nums[mid]:(nums[mid-1]+nums[mid])/2;
}

function collectBookLines(odd){
  const lines=[];
  for(const [bookmaker,data] of Object.entries(odd?.byBookmaker||{})){
    if(data?.available===false)continue;
    const line=num(data?.overUnder);
    if(Number.isFinite(line))lines.push({bookmaker,line});
  }

  // Prefer the provider's consensus line if bookmaker lines are absent.
  if(!lines.length){
    const consensus=num(odd?.fairOverUnder ?? odd?.bookOverUnder);
    if(Number.isFinite(consensus))lines.push({bookmaker:"consensus",line:consensus});
  }
  return lines;
}

function collectYesProbabilities(odd){
  const fair=americanToProbability(odd?.fairOdds);
  if(Number.isFinite(fair)){
    return [{bookmaker:"fair-consensus",probability:fair}];
  }

  const probs=[];
  for(const [bookmaker,data] of Object.entries(odd?.byBookmaker||{})){
    if(data?.available===false)continue;
    const p=americanToProbability(data?.odds);
    if(Number.isFinite(p))probs.push({bookmaker,probability:p});
  }
  if(!probs.length){
    const p=americanToProbability(odd?.bookOdds);
    if(Number.isFinite(p))probs.push({bookmaker:"consensus",probability:p});
  }
  return probs;
}

export async function GET(){
  const apiKey=process.env.SPORTSGAMEODDS_KEY || process.env.SPORTSGAMEODDS_API_KEY;
  if(!apiKey){
    return Response.json({
      configured:false,
      provider:"SportsGameOdds",
      players:{},
      message:"Add SPORTSGAMEODDS_KEY in your Netlify environment variables to enable Vegas-adjusted projections."
    });
  }

  try{
    const url=new URL(API_BASE);
    url.searchParams.set("leagueID","NFL");
    url.searchParams.set("oddsAvailable","true");
    url.searchParams.set("finalized","false");
    url.searchParams.set("limit","50");
    url.searchParams.set("includeOpposingOdds","true");
    url.searchParams.set("oddIDs",[
      "passing_yards-PLAYER_ID-game-ou-over",
      "passing_touchdowns-PLAYER_ID-game-ou-over",
      "passing_attempts-PLAYER_ID-game-ou-over",
      "passing_completions-PLAYER_ID-game-ou-over",
      "rushing_yards-PLAYER_ID-game-ou-over",
      "rushing_attempts-PLAYER_ID-game-ou-over",
      "rushing_touchdowns-PLAYER_ID-game-ou-over",
      "receiving_yards-PLAYER_ID-game-ou-over",
      "receiving_receptions-PLAYER_ID-game-ou-over",
      "receiving_touchdowns-PLAYER_ID-game-ou-over",
      "touchdowns-PLAYER_ID-game-yn-yes"
    ].join(","));

    const res=await fetch(url,{
      headers:{
        "x-api-key":apiKey,
        Accept:"application/json"
      },
      next:{revalidate:600}
    });

    if(!res.ok)throw new Error(`SportsGameOdds HTTP ${res.status}`);
    const payload=await res.json();
    const events=Array.isArray(payload?.data)?payload.data:[];
    const players={};

    for(const event of events){
      for(const odd of Object.values(event?.odds||{})){
        const playerID=odd?.playerID||odd?.statEntityID;
        const statID=String(odd?.statID||"");
        if(!playerID || ["all","home","away"].includes(playerID) || !PROP_STATS.has(statID))continue;
        if(String(odd?.periodID||"game")!=="game")continue;

        const playerName=playerNameFromID(playerID);
        const key=normalizeName(playerName);
        if(!key)continue;
        if(!players[key]){
          players[key]={
            playerID,
            name:playerName,
            eventID:event?.eventID||null,
            startsAt:event?.status?.startsAt||event?.startsAt||null,
            props:{}
          };
        }

        const side=String(odd?.sideID||"");
        const betType=String(odd?.betTypeID||"");

        if(betType==="ou" && (side==="over" || side==="under")){
          const lines=collectBookLines(odd);
          if(lines.length){
            const existing=players[key].props[statID]||{lines:[],books:new Set()};
            for(const item of lines){
              existing.lines.push(item.line);
              existing.books.add(item.bookmaker);
            }
            players[key].props[statID]=existing;
          }
        }

        // Anytime-touchdown market. Use only the YES side and provider fair odds
        // when possible. This becomes a market probability, not a guaranteed TD.
        if(statID==="touchdowns" && betType==="yn" && side==="yes"){
          const probs=collectYesProbabilities(odd);
          if(probs.length){
            const existing=players[key].props.touchdowns||{probabilities:[],books:new Set()};
            for(const item of probs){
              existing.probabilities.push(item.probability);
              existing.books.add(item.bookmaker);
            }
            players[key].props.touchdowns=existing;
          }
        }
      }
    }

    for(const player of Object.values(players)){
      const clean={};
      for(const [statID,data] of Object.entries(player.props)){
        if(Array.isArray(data.lines)&&data.lines.length){
          clean[statID]={
            line:median(data.lines),
            books:data.books?.size||0,
            min:Math.min(...data.lines),
            max:Math.max(...data.lines)
          };
        }else if(Array.isArray(data.probabilities)&&data.probabilities.length){
          clean[statID]={
            probability:median(data.probabilities),
            books:data.books?.size||0
          };
        }
      }
      player.props=clean;
    }

    return Response.json({
      configured:true,
      provider:"SportsGameOdds",
      source:"Sportsbook consensus player-prop market",
      players,
      events:events.length,
      retrievedAt:new Date().toISOString()
    });
  }catch(error){
    return Response.json({
      configured:true,
      provider:"SportsGameOdds",
      players:{},
      error:"Vegas odds are temporarily unavailable.",
      detail:String(error?.message||error)
    });
  }
}

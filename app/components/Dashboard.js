"use client";

import { useEffect, useMemo, useState } from "react";

const DEMO = [
  ["d1","Jalen Hurts","QB","PHI","4040715"],["d2","Bijan Robinson","RB","ATL","4430807"],
  ["d3","De'Von Achane","RB","MIA","4429160"],["d4","Garrett Wilson","WR","NYJ","4361407"],
  ["d5","Zay Flowers","WR","BAL","4429615"],["d6","Sam LaPorta","TE","DET","4430027"],
  ["d7","Emeka Egbuka","WR","TB","4567750"],["d8","Parker Washington","WR","JAX","4430878"],
  ["d9","TreVeyon Henderson","RB","NE","4432710"],["d10","Tyler Warren","TE","IND","4431459"]
].map(([player_id,full_name,position,team,espn_id])=>({player_id,full_name,position,team,espn_id,active:true}));

const NAV = [
  ["team","⚡","Team"],["optimize","◎","Optimize your Lineup"],["startsit","✓","Start/Sit"],
  ["trade","⇄","Trade"],["waivers","＋","Waivers"],["gm","◈","FTW GM"]
];

const safeJson = async (url) => {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "Request failed");
  return j;
};

function name(p){return p?.full_name || [p?.first_name,p?.last_name].filter(Boolean).join(" ") || "Unknown"}
function id(p){return String(p?.player_id || "")}

function PlayerAvatar({p,size="md"}){
  const espnId=String(p?.espn_id||p?.espnId||p?.metadata?.espn_id||"");
  const sleeperId=id(p);
  const initials=name(p).split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();

  const espnSrc=espnId
    ? `https://a.espncdn.com/i/headshots/nfl/players/full/${encodeURIComponent(espnId)}.png`
    : "";
  const sleeperSrc=sleeperId
    ? `https://sleepercdn.com/content/nfl/players/${encodeURIComponent(sleeperId)}.jpg`
    : "";

  const firstSrc=espnSrc||sleeperSrc;

  const handleError=(e)=>{
    const img=e.currentTarget;
    if(espnSrc && sleeperSrc && img.dataset.fallback!=="sleeper"){
      img.dataset.fallback="sleeper";
      img.src=sleeperSrc;
      return;
    }
    img.style.display="none";
  };

  return <span className={`playerAvatar ${size}`} aria-hidden="true">
    <span className="avatarFallback">{initials||"?"}</span>
    {firstSrc&&<img
      src={firstSrc}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={handleError}
    />}
  </span>
}

export default function Dashboard(){
  const [tab,setTab]=useState("team");
  const [nfl,setNfl]=useState(null);
  const [players,setPlayers]=useState({});
  const [trending,setTrending]=useState([]);
  const [trendingDrops,setTrendingDrops]=useState([]);
  const [username,setUsername]=useState("");
  const [status,setStatus]=useState("Enter a Sleeper username or use Demo Mode.");
  const [leagues,setLeagues]=useState([]);
  const [league,setLeague]=useState(null);
  const [roster,setRoster]=useState([]);
  const [myRoster,setMyRoster]=useState(null);
  const [matchup,setMatchup]=useState(null);
  const [startA,setStartA]=useState("");
  const [startB,setStartB]=useState("");
  const [give,setGive]=useState([]);
  const [get,setGet]=useState([]);
  const [pos,setPos]=useState("ALL");
  const [gmMessages,setGmMessages]=useState([{who:"bot",text:"Ask me about your roster, trades, starters or waivers."}]);
  const [gmText,setGmText]=useState("");
  const [projectionFeed,setProjectionFeed]=useState({configured:false,provider:"Sleeper",retrievedAt:null,projections:[]});
  const [projectionError,setProjectionError]=useState("");
  const [selectedPlayer,setSelectedPlayer]=useState(null);
  const [playerInsight,setPlayerInsight]=useState(null);
  const [playerInsightLoading,setPlayerInsightLoading]=useState(false);
  const [playerInsightError,setPlayerInsightError]=useState("");
  const [defenseRankings,setDefenseRankings]=useState({});
  const [weekMatchups,setWeekMatchups]=useState({});

  useEffect(()=>{
    (async()=>{
      try{
        const [s,p,t,d,def]=await Promise.all([
          safeJson("/api/sleeper/state"),
          safeJson("/api/sleeper/players"),
          safeJson("/api/sleeper/trending?type=add&hours=24&limit=30"),
          safeJson("/api/sleeper/trending?type=drop&hours=24&limit=30"),
          safeJson("/api/defense-rankings").catch(()=>({rankings:{}}))
        ]);
        setNfl(s);setPlayers(p);setTrending(t);setTrendingDrops(d);setDefenseRankings(def?.rankings||{});
      }catch(e){setStatus("Live feed is temporarily unavailable. Demo Mode still works.");}
    })();
  },[]);

  useEffect(()=>{
    if(!nfl?.season || !nfl?.week) return;
    (async()=>{
      try{
        const [feed,matchupFeed]=await Promise.all([
          safeJson(`/api/provider/projections?season=${nfl.season}&week=${nfl.week}`),
          safeJson(`/api/week-matchups?season=${nfl.season}&week=${nfl.week}`).catch(()=>({matchups:{}}))
        ]);
        setProjectionFeed(feed);
        setWeekMatchups(matchupFeed?.matchups||{});
        setProjectionError("");
      }catch(e){
        setProjectionError(e.message || "Projection feed unavailable");
      }
    })();
  },[nfl?.season,nfl?.week]);

  const normalizeName=(s)=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const projectionFor=(p)=>{
    if(!p || !projectionFeed?.projections?.length) return null;
    const pid=id(p);
    const bySleeper=projectionFeed.projections.find(x=>x.sleeperId && String(x.sleeperId)===pid);
    if(bySleeper)return bySleeper;
    const n=normalizeName(name(p));
    const team=String(p.team||"").toUpperCase();
    return projectionFeed.projections.find(x=>
      normalizeName(x.name)===n && (!team || !x.team || String(x.team).toUpperCase()===team)
    ) || projectionFeed.projections.find(x=>normalizeName(x.name)===n) || null;
  };

  const format=useMemo(()=>{
    const s=league?.scoring_settings||{};
    const ppr=Number(s.rec||0), sf=(league?.roster_positions||[]).includes("SUPER_FLEX");
    const te=Number(s.bonus_rec_te||0);
    return {ppr,sf,te,label:`${sf?"SUPERFLEX • ":""}${ppr>=1?"PPR":ppr>=.5?"HALF PPR":"STANDARD"}${te>0?" • TE+":""}`};
  },[league]);

  const scoringValue=(key,fallback)=>{
    const s=league?.scoring_settings||{};
    const n=Number(s[key]);
    return Number.isFinite(n)?n:fallback;
  };

  const rawFantasyPoints=(p)=>{
    const pr=projectionFor(p);
    if(!pr)return null;

    const fields=[
      pr.passingYards,pr.passingTouchdowns,pr.passingInterceptions,
      pr.rushingYards,pr.rushingTouchdowns,pr.receptions,
      pr.receivingYards,pr.receivingTouchdowns
    ];
    const hasRealStatLine=fields.some(v=>Number(v)>0);
    if(!hasRealStatLine)return null;

    let pts=0;
    pts+=Number(pr.passingYards||0)*scoringValue("pass_yd",0.04);
    pts+=Number(pr.passingTouchdowns||0)*scoringValue("pass_td",4);
    pts+=Number(pr.passingInterceptions||0)*scoringValue("pass_int",-2);
    pts+=Number(pr.rushingYards||0)*scoringValue("rush_yd",0.1);
    pts+=Number(pr.rushingTouchdowns||0)*scoringValue("rush_td",6);
    pts+=Number(pr.receptions||0)*scoringValue("rec",0);
    pts+=Number(pr.receivingYards||0)*scoringValue("rec_yd",0.1);
    pts+=Number(pr.receivingTouchdowns||0)*scoringValue("rec_td",6);
    pts+=Number(pr.fumblesLost||0)*scoringValue("fum_lost",-2);
    pts+=Number(pr.passingTwoPointConversions||0)*scoringValue("pass_2pt",2);
    pts+=Number(pr.rushingTwoPointConversions||0)*scoringValue("rush_2pt",2);
    pts+=Number(pr.receivingTwoPointConversions||0)*scoringValue("rec_2pt",2);

    if(p?.position==="TE"){
      pts+=Number(pr.receptions||0)*scoringValue("bonus_rec_te",0);
    }

    return Math.max(0,pts);
  };

  const matchupAdjustment=(p)=>{
    const team=String(p?.team||"").toUpperCase();
    const opp=String(weekMatchups?.[team]?.opponent||"").toUpperCase();
    const ranks=defenseRankings?.[opp];
    if(!ranks)return {factor:1,opponent:opp||"TBD",rank:null,metric:null};

    let rank=null;
    let metric=null;
    if(["QB","WR","TE"].includes(p.position)){
      rank=Number(ranks.passRank);
      metric="PASS";
    }else if(p.position==="RB"){
      rank=Number(ranks.rushRank);
      metric="RUSH";
    }else{
      rank=Number(ranks.overallRank);
      metric="OVERALL";
    }

    if(!Number.isFinite(rank))return {factor:1,opponent:opp||"TBD",rank:null,metric};

    // Keep matchup impact modest: opponent defense matters, but volume/talent
    // should remain the dominant projection signal.
    const centered=(rank-16.5)/15.5; // roughly -1 toughest to +1 easiest
    const factor=1+(centered*0.08);  // max about +/-8%
    return {factor,opponent:opp,rank,metric};
  };

  const injuryAdjustment=(p)=>{
    const s=String(p?.injury_status||p?.status||"").toLowerCase();
    if(["out","ir","inactive","pup","suspended","reserve","nfi"].some(x=>s===x||s.includes(x)))return 0;
    if(s.includes("doubtful"))return 0.25;
    if(s.includes("questionable"))return 0.90;
    if(s.includes("gtd")||s.includes("game-time"))return 0.85;
    if(s.includes("probable"))return 0.98;
    return 1;
  };

  const projectionConfidence=(p)=>{
    const pr=projectionFor(p);
    if(!pr)return "LOW";
    const usage=Number(pr.passingAttempts||0)+Number(pr.rushingAttempts||0)+Number(pr.receivingTargets||0);
    const injury=injuryAdjustment(p);
    if(injury===0)return "LOW";
    if(usage>=25&&injury>=0.98)return "HIGH";
    if(usage>=10&&injury>=0.85)return "MEDIUM";
    return "LOW";
  };

  const projectionRange=(p)=>{
    const expected=projectedFantasyPoints(p);
    if(expected===null)return {floor:null,expected:null,ceiling:null};
    const pr=projectionFor(p);
    const volume=Number(pr?.passingAttempts||0)+Number(pr?.rushingAttempts||0)+Number(pr?.receivingTargets||0);
    const spread=volume>=25?0.24:volume>=10?0.30:0.38;
    return {
      floor:Math.max(0,Math.round(expected*(1-spread)*10)/10),
      expected,
      ceiling:Math.round(expected*(1+spread)*10)/10
    };
  };

  const projectedFantasyPoints=(p)=>{
    const base=rawFantasyPoints(p);
    if(base===null)return null;

    const matchup=matchupAdjustment(p);
    const injury=injuryAdjustment(p);
    let value=base*matchup.factor*injury;

    // Sanity caps prevent malformed raw feeds from creating absurd fantasy totals.
    const caps={QB:45,RB:38,WR:38,TE:32,K:25,DEF:30};
    const cap=caps[p?.position]||40;
    value=Math.max(0,Math.min(cap,value));

    return Math.round(value*10)/10;
  };

  const score=(p)=>{
    if(!p)return 0;
    const pr=projectionFor(p);
    const proj=projectedFantasyPoints(p);

    // When a projection provider is connected, weekly projection is the
    // dominant signal. Sleeper status, depth chart, format, and market movement
    // provide smaller context adjustments.
    if(pr && proj!==null){
      const positionBaseline={QB:18,RB:11,WR:11,TE:8}[p.position]||8;
      let s=65 + (proj-positionBaseline)*2.0;
      if(pr.activated===0 || pr.played===0) s-=18;
      if(p.injury_status) s-=({IR:22,Out:18,Doubtful:12,Questionable:5}[p.injury_status]||4);
      if(p.depth_chart_order===1||p.depth_chart_position===1)s+=2;
      if(addCount(p)>100)s+=1;
      if(dropCount(p)>100)s-=1;
      if(format.sf&&p.position==="QB")s+=4;
      return Math.max(35,Math.min(99,Math.round(s)));
    }

    // Transparent fallback when no paid projection feed is configured.
    const base={QB:76,RB:75,WR:74,TE:70,K:55,DEF:58}[p.position]||60;
    const seed=name(p).split("").reduce((a,c)=>a+c.charCodeAt(0),0);
    const depth=Number(p.depth_chart_order||p.depth_chart_position)===1?5:0;
    const injury=p.injury_status?({IR:-20,Out:-18,Doubtful:-12,Questionable:-5}[p.injury_status]||-4):0;
    let s=base+(seed%17)+depth+injury;
    if(format.ppr>=1&&["RB","WR","TE"].includes(p.position))s+=2;
    if(format.te>0&&p.position==="TE")s+=4;
    if(format.sf&&p.position==="QB")s+=6;
    return Math.max(40,Math.min(99,Math.round(s)));
  };
  const availabilityStatus=(p)=>{
    const raw=String(p?.injury_status||p?.status||"").trim().toLowerCase();
    return raw;
  };

  const isUnavailable=(p)=>{
    const s=availabilityStatus(p);
    return [
      "out","ir","inactive","pup","suspended","reserve","nfi",
      "physically unable to perform"
    ].some(tag=>s===tag||s.includes(tag)) || s.includes("doubtful");
  };

  const lineupDecisionValue=(p)=>{
    if(!p||isUnavailable(p))return -100000;

    const proj=projectedFantasyPoints(p);
    let value=proj!==null ? proj*10 : score(p);

    const s=availabilityStatus(p);
    if(s.includes("questionable")) value*=0.88;
    else if(s.includes("gtd")||s.includes("game-time")) value*=0.82;
    else if(s.includes("probable")) value*=0.98;

    // A projection of zero usually means bye / no expected role this week.
    if(proj!==null && proj<=0) value-=500;

    // Small role/context tie-breakers only. Projection remains dominant.
    if(p.depth_chart_order===1||p.depth_chart_position===1)value+=1.5;
    if(addCount(p)>100)value+=0.4;
    if(dropCount(p)>100)value-=0.4;

    return value;
  };

  const lineupRiskLabel=(p)=>{
    if(!p)return "";
    const s=availabilityStatus(p);
    if(isUnavailable(p))return "OUT";
    if(s.includes("questionable"))return "QUESTIONABLE";
    if(s.includes("gtd")||s.includes("game-time"))return "GTD";
    return "";
  };

  const tradeValue=(p)=>score(p)+(format.sf&&p.position==="QB"?8:p.position==="RB"?3:p.position==="TE"?3:0);

  const addCount=(p)=>trending.find(t=>String(t.player_id)===id(p))?.count||0;
  const dropCount=(p)=>trendingDrops.find(t=>String(t.player_id)===id(p))?.count||0;
  const liveFactors=(p)=>{
    const factors=[];
    if(!p)return factors;
    factors.push(`${format.label} league`);
    factors.push(`${p.position} positional value`);
    if(p.depth_chart_order===1||p.depth_chart_position===1) factors.push("listed at/near the top of the current depth chart");
    if(p.injury_status) factors.push(`current injury tag: ${p.injury_status}`);
    else if(p.status) factors.push(`current status: ${p.status}`);
    const pr=projectionFor(p), proj=projectedFantasyPoints(p);
    if(pr && proj!==null){
      factors.push(`${proj.toFixed(1)} projected fantasy points for your league settings`);
      if(pr.receivingTargets) factors.push(`${pr.receivingTargets.toFixed(1)} projected targets`);
      if(pr.rushingAttempts) factors.push(`${pr.rushingAttempts.toFixed(1)} projected carries`);
      if(pr.passingAttempts) factors.push(`${pr.passingAttempts.toFixed(1)} projected pass attempts`);
    }
    const adds=addCount(p), drops=dropCount(p);
    if(adds) factors.push(`${adds} Sleeper adds in the last 24 hours`);
    if(drops) factors.push(`${drops} Sleeper drops in the last 24 hours`);
    return factors;
  };

  const pool=roster.length?roster:DEMO;
  const avg=pool.length?pool.reduce((a,p)=>a+score(p),0)/pool.length:0;
  const grade=avg>=88?"A+":avg>=84?"A":avg>=80?"A-":avg>=76?"B+":avg>=72?"B":avg>=68?"B-":"C+";
  const avgs=["QB","RB","WR","TE"].map(k=>{
    const xs=pool.filter(p=>p.position===k).map(score);
    return [k,xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0];
  }).sort((a,b)=>a[1]-b[1]);
  const biggestNeed=avgs[0]?.[0]||"--";

  useEffect(()=>{
    if(pool.length){
      setStartA(a=>a||id(pool[0]));
      setStartB(b=>b||id(pool[Math.min(1,pool.length-1)]));
    }
  },[roster.length]);

  const connect=async()=>{
    if(!username.trim())return setStatus("Enter your Sleeper username.");
    setStatus("Finding your Sleeper leagues…");
    try{
      const user=await safeJson(`/api/sleeper/user/${encodeURIComponent(username.trim())}`);
      const season=nfl?.league_season||nfl?.season||new Date().getFullYear();
      const ls=await safeJson(`/api/sleeper/leagues/${user.user_id}?season=${season}`);
      setLeagues(ls.map(l=>({...l,_userId:user.user_id})));
      setStatus(ls.length?`Found ${ls.length} league${ls.length===1?"":"s"}. Choose one.`:"No leagues found for this season.");
    }catch(e){setStatus(e.message);}
  };

  const chooseLeague=async(l)=>{
    setStatus(`Loading ${l.name}…`);
    try{
      const rs=await safeJson(`/api/sleeper/league/${l.league_id}/rosters`);
      const mine=rs.find(r=>r.owner_id===l._userId||(r.co_owners||[]).includes(l._userId));
      if(!mine)throw new Error("Could not match your roster.");
      const rp=(mine.players||[]).map(x=>players[x]).filter(Boolean);
      setLeague(l);setMyRoster(mine);setRoster(rp);setLeagues([]);
      setGive([]);setGet([]);
      const week=nfl?.week||1;
      const ms=await safeJson(`/api/sleeper/league/${l.league_id}/matchups/${week}`);
      const me=ms.find(x=>x.roster_id===mine.roster_id);
      const opp=ms.find(x=>x.matchup_id===me?.matchup_id&&x.roster_id!==mine.roster_id);
      setMatchup({me,opp});
      setStatus(`${l.name} connected • ${l.total_rosters} teams`);
    }catch(e){setStatus(e.message);}
  };

  const demo=()=>{
    setLeague({name:"FTW Demo",total_rosters:12,scoring_settings:{rec:1},roster_positions:["QB","RB","RB","WR","WR","TE","FLEX","BN","BN","BN"]});
    setRoster(DEMO);setMyRoster({});setMatchup(null);setLeagues([]);setStatus("Demo Mode • 12-team PPR");
  };

  const slots=()=>league?.roster_positions?.filter(x=>!["BN","IR","TAXI"].includes(x))||["QB","RB","RB","WR","WR","TE","FLEX"];
  const eligible=(p,s)=>p.position===s||(s==="FLEX"&&["RB","WR","TE"].includes(p.position))||(s==="SUPER_FLEX"&&["QB","RB","WR","TE"].includes(p.position))||(s==="WRRB_FLEX"&&["WR","RB"].includes(p.position))||(s==="REC_FLEX"&&["WR","TE"].includes(p.position));
  const optimal=useMemo(()=>{
    const lineupSlots=slots();
    const available=pool.filter(p=>!isUnavailable(p));

    // Put restrictive slots first, then FLEX/SUPER_FLEX. This prevents a flex
    // spot from stealing a player needed at a scarcer mandatory position.
    const slotPriority=(s)=>{
      if(s==="QB"||s==="RB"||s==="WR"||s==="TE"||s==="K"||s==="DEF")return 0;
      if(s==="WRRB_FLEX"||s==="REC_FLEX")return 1;
      if(s==="FLEX")return 2;
      if(s==="SUPER_FLEX")return 3;
      return 4;
    };

    const indexed=lineupSlots.map((slot,index)=>({slot,index})).sort((a,b)=>slotPriority(a.slot)-slotPriority(b.slot));
    const chosen=new Map();
    const used=new Set();

    // Choose the best risk-adjusted weekly option for each legal slot.
    for(const entry of indexed){
      const candidates=available
        .filter(p=>!used.has(id(p))&&eligible(p,entry.slot))
        .sort((a,b)=>lineupDecisionValue(b)-lineupDecisionValue(a));
      const pick=candidates[0]||null;
      if(pick)used.add(id(pick));
      chosen.set(entry.index,pick);
    }

    const starters=lineupSlots.map((slot,index)=>({slot,p:chosen.get(index)||null}));
    const bench=pool
      .filter(p=>!used.has(id(p)))
      .sort((a,b)=>lineupDecisionValue(b)-lineupDecisionValue(a));

    return {starters,bench};
  },[roster,league,format.label,projectionFeed.retrievedAt,players]);

  const find=(x)=>pool.find(p=>id(p)===String(x))||Object.values(players).find(p=>id(p)===String(x));
  const A=find(startA),B=find(startB);
  const startWinner=A&&B?(score(A)>=score(B)?A:B):null;
  const startLoser=A&&B?(startWinner===A?B:A):null;

  const tradePool=useMemo(()=>Object.values(players).filter(p=>["QB","RB","WR","TE"].includes(p.position)&&p.active===true).sort((a,b)=>tradeValue(b)-tradeValue(a)),[players,format.label]);
  const packageValue=(ids)=>{
    const vals=ids.slice(0,6).map(x=>tradeValue(find(x))).filter(Boolean).sort((a,b)=>b-a);
    let v=vals.reduce((a,b)=>a+b,0)-Math.max(0,vals.length-1)*3;
    if(vals[0]>=90)v+=5;return Math.round(v);
  };
  const gv=packageValue(give),rv=packageValue(get),winPct=gv+rv?Math.max(5,Math.min(95,Math.round(50+(rv-gv)/(gv+rv)*100))):50;

  const weakest=(position)=>{
    const xs=pool.filter(p=>!position||p.position===position).sort((a,b)=>score(a)-score(b));
    return xs[0]||[...pool].sort((a,b)=>score(a)-score(b))[0];
  };
  const waiverRows=trending.map(t=>({t,p:players[t.player_id]})).filter(x=>x.p&&(["ALL",x.p.position].includes(pos))).slice(0,14);

  const tradePlayers=(ids)=>ids.map(find).filter(Boolean);

  const packagePositions=(ids)=>{
    const counts={};
    for(const p of tradePlayers(ids))counts[p.position]=(counts[p.position]||0)+1;
    return counts;
  };

  const tradeTeamAnalysis=()=>{
    const outgoing=tradePlayers(give);
    const incoming=tradePlayers(get);
    if(!outgoing.length||!incoming.length)return null;

    const incomingBest=[...incoming].sort((a,b)=>tradeValue(b)-tradeValue(a))[0];
    const outgoingBest=[...outgoing].sort((a,b)=>tradeValue(b)-tradeValue(a))[0];
    const incomingPos=packagePositions(get);
    const outgoingPos=packagePositions(give);

    const good=[];
    const bad=[];

    if(rv>gv)good.push(`You gain ${rv-gv} points of adjusted FTW package value.`);
    else bad.push(`You give up ${gv-rv} more adjusted FTW value than you receive.`);

    if(incomingPos[biggestNeed])good.push(`The return adds help at ${biggestNeed}, your weakest current position group.`);
    if(outgoingPos[biggestNeed]&&!incomingPos[biggestNeed])bad.push(`You lose depth at ${biggestNeed}, currently your weakest position group.`);

    if(incomingBest&&outgoingBest&&tradeValue(incomingBest)>tradeValue(outgoingBest)){
      good.push(`${name(incomingBest)} becomes the best individual asset changing hands.`);
    }else if(incomingBest&&outgoingBest&&tradeValue(outgoingBest)>tradeValue(incomingBest)){
      bad.push(`${name(outgoingBest)} is the best individual asset in the deal, so you are giving up the strongest piece.`);
    }

    if(incoming.length<outgoing.length)good.push("You consolidate roster spots, which can create room for a waiver add.");
    if(incoming.length>outgoing.length)bad.push("You take on more roster spots, which may force a drop and reduce the package's practical value.");

    return {
      good:good.slice(0,3),
      bad:bad.slice(0,3)
    };
  };

  const gmAnswer=(q)=>{
    const sorted=[...pool].sort((a,b)=>score(b)-score(a)), weak=[...sorted].reverse()[0];
    const l=q.toLowerCase();
    if(l.includes("weak")||l.includes("waiver")||l.includes("target")) return `Attack ${biggestNeed} first. It is your lowest-rated position group. Use waivers for upside, then package depth for a stronger weekly starter.`;
    if(l.includes("start")||l.includes("lineup")) return `Your optimized core starts with ${optimal.starters.filter(x=>x.p).slice(0,5).map(x=>name(x.p)).join(", ")}.`;
    if(l.includes("trade away")||l.includes("sell")) return `${name(weak)} is one of your lowest FTW values. I’d prefer packaging that player rather than selling your elite core.`;
    if(l.includes("best")||l.includes("core")) return `${name(sorted[0])} is your current top FTW asset at ${score(sorted[0])}. Build around that tier.`;
    return `Your strongest piece is ${name(sorted[0])}; your first need is ${biggestNeed}. Ask about starters, trades, weaknesses or waivers for a narrower answer.`;
  };

  const askGM=(text=gmText)=>{
    const q=text.trim();if(!q)return;
    setGmMessages(m=>[...m,{who:"user",text:q},{who:"bot",text:gmAnswer(q)}]);setGmText("");
  };

  const openPlayer=async(p)=>{
    if(!p)return;
    setSelectedPlayer(p);
    setPlayerInsight(null);
    setPlayerInsightError("");
    setPlayerInsightLoading(true);
    try{
      const season=nfl?.season || new Date().getFullYear();
      const week=nfl?.week || 1;
      const q=new URLSearchParams({
        season:String(season),
        week:String(week),
        sleeperId:id(p),
        espnId:String(p?.espn_id||p?.espnId||""),
        team:String(p?.team||""),
        name:name(p)
      });
      const insight=await safeJson(`/api/player/insight?${q.toString()}`);
      setPlayerInsight(insight);
    }catch(e){
      setPlayerInsightError(e.message||"Player details are temporarily unavailable.");
    }finally{
      setPlayerInsightLoading(false);
    }
  };

  const closePlayer=()=>{
    setSelectedPlayer(null);
    setPlayerInsight(null);
    setPlayerInsightError("");
  };

  const modalProjection=(row)=>{
    const p=row?.projection;
    if(!p)return null;

    const fields=[
      p.passingYards,p.passingTouchdowns,p.passingInterceptions,
      p.rushingYards,p.rushingTouchdowns,p.receptions,
      p.receivingYards,p.receivingTouchdowns
    ];
    if(!fields.some(v=>Number(v)>0))return null;

    let pts=0;
    pts+=Number(p.passingYards||0)*scoringValue("pass_yd",0.04);
    pts+=Number(p.passingTouchdowns||0)*scoringValue("pass_td",4);
    pts+=Number(p.passingInterceptions||0)*scoringValue("pass_int",-2);
    pts+=Number(p.rushingYards||0)*scoringValue("rush_yd",0.1);
    pts+=Number(p.rushingTouchdowns||0)*scoringValue("rush_td",6);
    pts+=Number(p.receptions||0)*scoringValue("rec",0);
    pts+=Number(p.receivingYards||0)*scoringValue("rec_yd",0.1);
    pts+=Number(p.receivingTouchdowns||0)*scoringValue("rec_td",6);
    pts+=Number(p.fumblesLost||0)*scoringValue("fum_lost",-2);
    pts+=Number(p.passingTwoPointConversions||0)*scoringValue("pass_2pt",2);
    pts+=Number(p.rushingTwoPointConversions||0)*scoringValue("rush_2pt",2);
    pts+=Number(p.receivingTwoPointConversions||0)*scoringValue("rec_2pt",2);

    if(selectedPlayer?.position==="TE"){
      pts+=Number(p.receptions||0)*scoringValue("bonus_rec_te",0);
    }

    const opp=String(row?.matchup?.opponent||"").toUpperCase();
    const ranks=defenseRankings?.[opp]||null;
    let rank=null;
    if(ranks){
      rank=["QB","WR","TE"].includes(selectedPlayer?.position)
        ? Number(ranks.passRank)
        : selectedPlayer?.position==="RB"
          ? Number(ranks.rushRank)
          : Number(ranks.overallRank);
    }

    let matchupFactor=1;
    if(Number.isFinite(rank)){
      const centered=(rank-16.5)/15.5;
      matchupFactor=1+(centered*0.08);
    }

    const injury=injuryAdjustment(selectedPlayer);
    const caps={QB:45,RB:38,WR:38,TE:32,K:25,DEF:30};
    const cap=caps[selectedPlayer?.position]||40;
    const value=Math.max(0,Math.min(cap,pts*matchupFactor*injury));
    return Math.round(value*10)/10;
  };

  const futureProjectionRows=()=>{
    const position=selectedPlayer?.position||"";
    return (playerInsight?.future||[]).map(row=>{
      const points=modalProjection(row);
      const opp=String(row?.matchup?.opponent||"").toUpperCase();
      const ranks=defenseRankings?.[opp]||null;

      let rank=null;
      let metric="OVERALL";
      let details=null;

      if(ranks){
        if(["QB","WR","TE"].includes(position)){
          rank=ranks.passRank;
          metric="PASS";
          details=ranks.passing||null;
        }else if(position==="RB"){
          rank=ranks.rushRank;
          metric="RUSH";
          details=ranks.rushing||null;
        }else{
          rank=ranks.overallRank;
          metric="OVERALL";
          details=ranks.overall||null;
        }
      }

      let matchupColor="unknown";
      if(Number.isFinite(Number(rank))){
        matchupColor=Number(rank)<=10?"bad":Number(rank)>=23?"great":"okay";
      }

      return {
        ...row,
        points,
        matchupColor,
        defenseRank:rank,
        defenseMetric:metric,
        defenseDetails:details
      };
    });
  };

  const selectedAdvice=()=>{
    const p=selectedPlayer;
    if(!p)return {call:"—",reason:""};
    const current=(playerInsight?.future||[]).find(x=>Number(x.week)===Number(nfl?.week||1));
    const pts=modalProjection(current);
    const isStarter=optimal.starters.some(x=>x.p&&id(x.p)===id(p));
    const status=String(p.injury_status||p.status||"").toLowerCase();

    if(status.includes("out")||status.includes("ir")){
      return {call:"SIT",reason:`${name(p)} is currently listed ${p.injury_status||p.status}. Keep them out unless that designation changes before kickoff.`};
    }
    if(status.includes("doubt")){
      return {call:"SIT",reason:`${name(p)} carries a doubtful injury designation, creating too much availability risk for a normal start recommendation.`};
    }
    if(isStarter){
      return {call:"START",reason:Number.isFinite(pts)?`${name(p)} is in your optimized lineup and projects for ${pts.toFixed(1)} points in your ${format.label} scoring.`:`${name(p)} is currently in your optimized FTW lineup for this week.`};
    }
    const baseline={QB:17,RB:10,WR:10,TE:8}[p.position]||8;
    if(Number.isFinite(pts)&&pts>=baseline){
      return {call:"START / FLEX",reason:`The current weekly projection of ${pts.toFixed(1)} is strong enough to keep ${name(p)} in start/flex consideration, depending on your alternatives.`};
    }
    return {call:"SIT / BENCH",reason:Number.isFinite(pts)?`${name(p)} projects for ${pts.toFixed(1)} this week and currently falls behind your optimized starters.`:`FTW does not have a reliable weekly projection for ${name(p)} right now, so the safer call is to compare them against your other available starters.`};
  };

  const addTradePlayer=(playerId,setter,current)=>{
    const pid=String(playerId||"");
    if(!pid||current.includes(pid)||current.length>=6)return;
    setter([...current,pid]);
  };

  const removeTradePlayer=(playerId,setter,current)=>{
    setter(current.filter(x=>String(x)!==String(playerId)));
  };

  return <main>
    <header className="topbar">
      <div className="brand"><span>FTW</span> FANTASY</div>
      <div className="live"><i/> {nfl?"LIVE":"CONNECTING"}</div>
    </header>

    <div className="shell">
      <section className="hero">
        <div><small>FANTASY FOOTBALL • SIMPLIFIED</small><h1>BUILD THE <em>WINNING</em> TEAM.</h1><p>The one stop shop for everything you need to win your fantasy leagues!</p></div>
        <div className="week glass"><small>NFL STATE</small><b>{nfl?`WEEK ${nfl.display_week||nfl.week}`:"…"}</b><span>{nfl?`${nfl.season} ${String(nfl.season_type).toUpperCase()}`:"Connecting"}</span></div>
      </section>

      <section className="connect glass">
        <div><small>CONNECT SLEEPER</small><h2>Import your league</h2><p>No password needed. FTW only reads public Sleeper league data.</p></div>
        <div className="connectRow"><input value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==="Enter"&&connect()} placeholder="Sleeper username"/><button onClick={connect}>CONNECT</button></div>
        {leagues.length>0&&<div className="leagueList">{leagues.map(l=><button key={l.league_id} onClick={()=>chooseLeague(l)}>{l.name}</button>)}</div>}
        <div className="status">{status} <button className="textBtn" onClick={demo}>Use Demo Mode</button></div>
      </section>

      <section className="providerBar glass">
        <div>
          <small>PROJECTION ENGINE</small>
          <b>{projectionFeed.configured ? "FTW PROJECTION ENGINE LIVE" : "FTW PROJECTION INPUT UNAVAILABLE"}</b>
          <span>{projectionFeed.configured
            ? `${projectionFeed.projections.length} weekly player projections loaded${projectionFeed.retrievedAt?` • refreshed ${new Date(projectionFeed.retrievedAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}`:""}`
            : (projectionFeed.detail ? `Projection feed error: ${projectionFeed.detail}` : "No API key required. FTW calculates weekly points from projected stat lines, your league scoring, injuries and nflverse-derived 2025 defensive matchup strength.")}</span>
          {projectionFeed.configured&&<span className="providerAttribution">FTW Projection Engine • Sleeper stat-line input • nflverse 2025 defense adjustment</span>}
        </div>
        <div className={projectionFeed.configured?"providerDot on":"providerDot"} />
      </section>

      <nav className="nav">{NAV.map(([x,icon,label])=><button key={x} className={tab===x?"active":""} onClick={()=>setTab(x)}><b>{icon}</b><span>{label}</span></button>)}</nav>

      {tab==="team"&&<section>
        <Head kicker="TEAM SNAPSHOT" title="Roster Analyzer"/>
        <div className="stats">
          <div className="grade glass"><div className="ring">{grade}</div><div><small>OVERALL</small><h3>{avg>=82?"CHAMPIONSHIP CORE":avg>=75?"PLAYOFF CALIBER":"NEEDS WORK"}</h3><p>FTW score {avg.toFixed(1)} / 100</p></div></div>
          <Stat label="FORMAT" value={format.label}/>
          <Stat label="BIGGEST NEED" value={biggestNeed}/>
          <Stat label="STARTER EDGE" value={`+${Math.max(0,(avg-68)/2).toFixed(1)}`}/>
        </div>
        <div className="insights">
          <div className="glass insight"><small>FTW TAKE</small><p>Build around <b>{name([...pool].sort((a,b)=>score(b)-score(a))[0])}</b>. Your {biggestNeed} group is the first area to upgrade.</p></div>
          <div className="glass insight"><small>LIVE MATCHUP</small><p>{matchup?.me?`${Number(matchup.me.points||0).toFixed(1)} vs ${Number(matchup.opp?.points||0).toFixed(1)} points`:"Connect a league for the current matchup."}</p></div>
        </div>
        <div className="roster glass">
          <div className="row rowHead"><span>PLAYER</span><span>POS</span><span>WEEK PROJ</span><span>STATUS</span></div>
          {[...pool].sort((a,b)=>score(b)-score(a)).map(p=><button type="button" className="row playerRowButton" key={id(p)} onClick={()=>openPlayer(p)}><span className="playerIdentity"><PlayerAvatar p={p}/><span><b>{name(p)}</b><small>{p.team||"FA"}</small></span></span><span className="pink">{p.position}</span><span className="projection">{projectedFantasyPoints(p)!==null?`${projectedFantasyPoints(p).toFixed(1)} pts`:"—"}</span><span className={p.injury_status?"warn":"ok"}>{p.injury_status||p.status||"Active"}</span></button>)}
        </div>
      </section>}

      {tab==="optimize"&&<section>
        <Head kicker="LINEUP ENGINE" title="Optimize your Lineup"/>
        <div className="explainer glass"><b>How FTW optimizes:</b> FTW calculates each weekly projection from the player’s projected stat line using your exact league scoring, then applies a modest 2025 opponent-defense adjustment and current injury risk. Players listed Out, IR, Inactive, PUP, Suspended or Doubtful are removed before FTW fills the highest-value legal lineup.</div>
        <div className="lineup">{optimal.starters.map((x,i)=><button type="button" className="slot glass playerCardButton" key={`${x.slot}-${i}`} onClick={()=>x.p&&openPlayer(x.p)}><span>{x.slot}</span>{x.p?<div className="slotPlayer"><PlayerAvatar p={x.p} size="sm"/><b>{name(x.p)}</b></div>:<b>EMPTY</b>}<em>{x.p?(projectedFantasyPoints(x.p)!==null?`${projectedFantasyPoints(x.p).toFixed(1)} PTS`:"PROJ —"):"--"}</em>{x.p&&lineupRiskLabel(x.p)&&<small className="lineupRisk">{lineupRiskLabel(x.p)}</small>}</button>)}</div>
        <div className="result glass"><h3>BENCH CHECK</h3><p>{optimal.bench.find(p=>!isUnavailable(p))?`${name(optimal.bench.find(p=>!isUnavailable(p)))} is your highest-rated available bench option based on this week's risk-adjusted outlook. Recheck late injury news before kickoff.`:"No healthy bench alternative is currently available."}</p></div>
      </section>}

      {tab==="startsit"&&<section>
        <Head kicker="WEEKLY DECISION" title="Start / Sit"/>
        <div className="explainer glass"><b>How FTW decides:</b> League scoring, positional value, live Sleeper injury/status metadata, depth-chart placement and recent player movement all influence the recommendation. The FTW score is a decision model, not an official projection.</div>
        <div className="compare">
          <PlayerPicker label="PLAYER A" value={startA} set={setStartA} pool={pool} score={score} projection={projectedFantasyPoints} onPlayer={openPlayer}/>
          <div className="vs">VS</div>
          <PlayerPicker label="PLAYER B" value={startB} set={setStartB} pool={pool} score={score} projection={projectedFantasyPoints} onPlayer={openPlayer}/>
        </div>
        {startWinner&&<div className="result glass">
          <button type="button" className="resultPlayerTitle playerTitleButton" onClick={()=>openPlayer(startWinner)}><PlayerAvatar p={startWinner} size="lg"/><span>START {name(startWinner).toUpperCase()}</span></button>
          <p>{projectionFor(startWinner)
            ? `${name(startWinner)} has the stronger provider-backed weekly outlook for your scoring format.`
            : `${name(startWinner)} currently grades ahead of ${name(startLoser)} in FTW fallback mode because a paid projection feed is not configured.`}</p>
          <Why title={`Why FTW prefers ${name(startWinner)}`} items={[
            projectedFantasyPoints(startWinner)!==null && projectedFantasyPoints(startLoser)!==null
              ? `${projectedFantasyPoints(startWinner).toFixed(1)} projected points vs ${projectedFantasyPoints(startLoser).toFixed(1)}`
              : `${score(startWinner)} FTW decision score vs ${score(startLoser)} for ${name(startLoser)}`,
            ...liveFactors(startWinner),
            startWinner.injury_status ? `Risk: ${startWinner.injury_status} injury designation should be checked again before lineup lock` : "No current Sleeper injury designation is shown",
            `The recommendation is tuned to your ${format.label} scoring format`
          ]}/>
          <div className="accuracyNote"><b>Data source:</b> {projectionFor(startWinner) ? "FTW-calculated weekly projection using projected stat lines, your league scoring, injury status and opponent defensive strength." : "Sleeper live metadata + FTW fallback model because the weekly projection feed is currently unavailable."}</div>
        </div>}
      </section>}

      {tab==="trade"&&<section>
        <Head kicker="MULTI-PLAYER DEALS" title="Trade Analyzer"/>
        <div className="explainer glass"><b>How FTW decides:</b> Search active NFL players, build packages of up to six players per side, then compare league-format scarcity, weekly value, positional need, roster consolidation and current player status.</div>
        <p className="helper">Search for a player and hit <b>＋</b> to add them. Only players Sleeper currently marks active are shown.</p>
        <div className="compare tradeCompare">
          <TradeSide
            label="YOU GIVE"
            ids={give}
            addPlayer={pid=>addTradePlayer(pid,setGive,give)}
            removePlayer={pid=>removeTradePlayer(pid,setGive,give)}
            pool={tradePool.length?tradePool:DEMO.filter(p=>p.active!==false)}
            value={gv}
            valueFn={tradeValue}
            onPlayer={openPlayer}
          />
          <div className="vs">⇄</div>
          <TradeSide
            label="YOU GET"
            ids={get}
            addPlayer={pid=>addTradePlayer(pid,setGet,get)}
            removePlayer={pid=>removeTradePlayer(pid,setGet,get)}
            pool={tradePool.length?tradePool:DEMO.filter(p=>p.active!==false)}
            value={rv}
            valueFn={tradeValue}
            onPlayer={openPlayer}
          />
        </div>
        {(give.length>0&&get.length>0)&&(()=>{
          const tradeNotes=tradeTeamAnalysis();
          return <div className="result glass">
            <h3>{winPct>=57?"ACCEPT":winPct>=46?"FAIR TRADE":"DECLINE"} • YOU {winPct}% / THEM {100-winPct}%</h3>
            <p>{rv>=gv?"The incoming package has the stronger adjusted FTW value.":"The outgoing package has the stronger adjusted FTW value."}</p>

            <div className="tradeProsCons">
              <div className="tradeGood">
                <small>WHY THIS IS GOOD FOR YOUR TEAM</small>
                <ul>{tradeNotes?.good?.length?tradeNotes.good.map((x,i)=><li key={i}>{x}</li>):<li>No major roster-specific advantage detected.</li>}</ul>
              </div>
              <div className="tradeBad">
                <small>WHY THIS COULD HURT YOUR TEAM</small>
                <ul>{tradeNotes?.bad?.length?tradeNotes.bad.map((x,i)=><li key={i}>{x}</li>):<li>No major roster-specific downside detected.</li>}</ul>
              </div>
            </div>

            <Why title="Why FTW grades the trade this way" items={[
              `Adjusted package value: ${rv} received vs ${gv} given`,
              `League format: ${format.label}; scarcity changes in Superflex and TE-premium formats`,
              `Best player in the deal: ${name([...give.map(find),...get.map(find)].filter(Boolean).sort((a,b)=>tradeValue(b)-tradeValue(a))[0])}`,
              "FTW applies an elite-player consolidation premium and a multi-roster-spot penalty",
              `Your current weakest position group is ${biggestNeed}, so deals that improve that group help your specific roster more`
            ]}/>
            <div className="accuracyNote"><b>Important:</b> trade percentages are FTW model estimates, not betting odds. Current league settings, roster construction, player status and weekly projection inputs inform the analysis.</div>
          </div>
        })()}
      </section>}

      {tab==="waivers"&&<section>
        <Head kicker="LIVE SLEEPER MOVEMENT" title="Waiver Assistant"/>
        <div className="explainer glass"><b>How FTW decides:</b> It compares live Sleeper add activity, current player status/depth-chart metadata, your league format, your weakest same-position player and your biggest roster need. Trending does not automatically mean “add.”</div>
        <div className="chips">{["ALL","QB","RB","WR","TE"].map(x=><button key={x} onClick={()=>setPos(x)} className={pos===x?"active":""}>{x}</button>)}</div>
        <div className="waivers">{waiverRows.length?waiverRows.map(({t,p})=>{
          const d=weakest(p.position), pProj=projectedFantasyPoints(p), dProj=d?projectedFantasyPoints(d):null;
          const providerUpgrade=pProj!==null&&dProj!==null?pProj>dProj:null;
          const upgrade=d&&(providerUpgrade!==null?providerUpgrade:score(p)>score(d));
          const delta=d?(providerUpgrade!==null?Math.round((pProj-dProj)*10)/10:score(p)-score(d)):0;
          return <div className="waiver glass" key={t.player_id}>
            <div className="waiverTop">
              <button type="button" className="playerIdentity playerIdentityButton" onClick={()=>openPlayer(p)}><PlayerAvatar p={p}/><span><b>{name(p)}</b><small>{p.position} • {p.team||"FA"} • FTW decision score {score(p)}</small></span></button>
              <div><strong>+{t.count}</strong><small>24H Sleeper adds</small></div>
            </div>
            <button type="button" className="profileLink" onClick={()=>openPlayer(p)}>VIEW PLAYER PROFILE</button>
            <div className="waiverExplain">
              <b>{upgrade?`ADD ${name(p)} • CONSIDER DROPPING ${name(d)}`:"WATCH / HOLD"}</b>
              <p>{upgrade
                ? `${name(p)} ${providerUpgrade!==null?`projects ${Math.abs(delta).toFixed(1)} points better this week`:`grades ${delta} FTW points higher`} than your lowest-rated ${p.position}, ${name(d)}. The move is also supported by current Sleeper add activity${biggestNeed===p.position?` and directly improves your biggest roster need (${biggestNeed})`:""}.`
                : `${name(p)} is trending on Sleeper, but FTW does not currently see a clear same-position upgrade over your roster. That makes this a watch-list move rather than an automatic add.`}</p>
              <div className="factorLine">{[
                `${t.count} adds / 24h`,
                p.injury_status?`Injury: ${p.injury_status}`:"No current injury tag",
                p.depth_chart_order===1||p.depth_chart_position===1?"Top depth-chart listing":null,
                `${format.label} value`
              ].filter(Boolean).join(" • ")}</div>
            </div>
          </div>
        }):<div className="result glass"><p>No trending {pos} players in the current live feed.</p></div>}</div>
      </section>}

      {tab==="gm"&&<section>
        <Head kicker="PERSONAL TEAM ASSISTANT" title="FTW GM"/>
        <div className="gm glass">
          <div className="chat">{gmMessages.map((m,i)=><div key={i} className={m.who==="user"?"bubble user":"bubble"}>{m.text}</div>)}</div>
          <div className="suggest">{["What is my biggest weakness?","Who are my best starters?","Who should I trade away?","What position should I target on waivers?"].map(q=><button key={q} onClick={()=>askGM(q)}>{q}</button>)}</div>
          <div className="gmRow"><input value={gmText} onChange={e=>setGmText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&askGM()} placeholder="Ask FTW GM about your roster…"/><button onClick={()=>askGM()}>ASK</button></div>
        </div>
      </section>}

      {selectedPlayer&&(()=>{
        const advice=selectedAdvice();
        const rows=futureProjectionRows();
        const currentRow=rows.find(x=>Number(x.week)===Number(nfl?.week||1));
        const currentPts=currentRow?.points;
        const injury=selectedPlayer.injury_status||selectedPlayer.status||playerInsight?.espnInjury?.status||"Active";
        return <div className="modalBackdrop" onMouseDown={e=>e.target===e.currentTarget&&closePlayer()}>
          <div className="playerModal glass" role="dialog" aria-modal="true" aria-label={`${name(selectedPlayer)} fantasy profile`}>
            <button type="button" className="modalClose" onClick={closePlayer}>×</button>

            <div className="playerModalHero">
              <PlayerAvatar p={selectedPlayer} size="xl"/>
              <div>
                <small>{selectedPlayer.position} • {selectedPlayer.team||"FA"} • WEEK {nfl?.week||1}</small>
                <h2>{name(selectedPlayer)}</h2>
                <div className="playerBadges">
                  <span className={String(injury).toLowerCase()==="active"?"badge good":"badge caution"}>{injury}</span>
                  {Number.isFinite(currentPts)&&<span className="badge projectionBadge">{currentPts.toFixed(1)} FTW PROJ</span>}
                  {selectedPlayer&&<span className="badge">{projectionConfidence(selectedPlayer)} CONFIDENCE</span>}
                </div>
              </div>
            </div>

            {playerInsightLoading&&<div className="modalLoading">Loading projections, schedule and player news…</div>}
            {playerInsightError&&<div className="modalError">{playerInsightError}</div>}

            {!playerInsightLoading&&<>
              <div className="advicePanel">
                <div className={`adviceCall ${advice.call.includes("START")?"start":"sit"}`}>{advice.call}</div>
                <div><small>FTW WEEKLY ADVICE</small><p>{advice.reason}</p></div>
              </div>

              {selectedPlayer&&(()=>{const r=projectionRange(selectedPlayer);return Number.isFinite(r.expected)?<div className="projectionRange">
                <div><small>FLOOR</small><b>{r.floor.toFixed(1)}</b></div>
                <div><small>EXPECTED</small><b>{r.expected.toFixed(1)}</b></div>
                <div><small>CEILING</small><b>{r.ceiling.toFixed(1)}</b></div>
                <div><small>CONFIDENCE</small><b>{projectionConfidence(selectedPlayer)}</b></div>
              </div>:null})()}

              <div className="modalSection">
                <div className="modalSectionHead"><div><small>REST OF SEASON</small><h3>Schedule + projections</h3></div><span>Matchup color uses a 2025 position-specific defensive composite from nflverse play-by-play. RB = rush-defense rank; QB/WR/TE = pass-defense rank. #1 is toughest and #32 is most favorable.</span></div>
                <div className="matchupLegend">
                  <span><i className="matchupDot great"/> Great matchup</span>
                  <span><i className="matchupDot okay"/> Okay matchup</span>
                  <span><i className="matchupDot bad"/> Bad matchup</span>
                </div>
                <div className="futureGrid">
                  {rows.length?rows.map(row=><div className="futureGame" key={row.week}>
                    <div><b>W{row.week}</b><small>{row.matchup?.homeAway==="home"?"vs":"@"} {row.matchup?.opponent||"TBD"}</small></div>
                    <strong>{Number.isFinite(row.points)?row.points.toFixed(1):"—"}</strong>
                    <span
                      className={`matchupDot ${row.matchupColor}`}
                      title={row.matchupColor==="great"?"Great matchup":row.matchupColor==="okay"?"Okay matchup":row.matchupColor==="bad"?"Bad matchup":"Matchup unavailable"}
                      aria-label={row.matchupColor==="great"?"Great matchup":row.matchupColor==="okay"?"Okay matchup":row.matchupColor==="bad"?"Bad matchup":"Matchup unavailable"}
                    />
                    {Number.isFinite(Number(row.defenseRank))&&<small className="defenseRank">
                      2025 {row.defenseMetric} DEF #{row.defenseRank}
                      {Number.isFinite(Number(row.defenseDetails?.epaAllowed))?` • EPA/play ${Number(row.defenseDetails.epaAllowed).toFixed(2)}`:""}
                      {Number.isFinite(Number(row.defenseDetails?.successRateAllowed))?` • ${(Number(row.defenseDetails.successRateAllowed)*100).toFixed(1)}% success allowed`:""}
                      {Number.isFinite(Number(row.defenseDetails?.yardsPerPlayAllowed))?` • ${Number(row.defenseDetails.yardsPerPlayAllowed).toFixed(1)} yds/play`:""}
                      {row.defenseMetric==="PASS"&&Number.isFinite(Number(row.defenseDetails?.pressureRate))?` • ${(Number(row.defenseDetails.pressureRate)*100).toFixed(1)}% pressure`:""}
                      {row.defenseMetric==="PASS"&&Number.isFinite(Number(row.defenseDetails?.interceptions))?` • ${Number(row.defenseDetails.interceptions)} INT`:""}
                      {row.defenseMetric==="PASS"&&Number.isFinite(Number(row.defenseDetails?.sacks))?` • ${Number(row.defenseDetails.sacks)} sacks`:""}
                      {Number.isFinite(Number(row.defenseDetails?.tdRateAllowed))?` • ${(Number(row.defenseDetails.tdRateAllowed)*100).toFixed(1)}% TD rate`:""}
                    </small>}
                  </div>):<p className="muted">Future weekly projections are not available from the current projection feed.</p>}
                </div>
              </div>

              {selectedPlayer&&projectionFor(selectedPlayer)&&(()=>{const pr=projectionFor(selectedPlayer);const position=selectedPlayer.position;const totalTds=Number(pr?.rushingTouchdowns||0)+Number(pr?.receivingTouchdowns||0);return <div className="modalSection workloadSection">
                <div className="modalSectionHead"><div><small>PROJECTED OPPORTUNITY</small><h3>Expected workload</h3></div></div>
                <div className="workloadGrid">
                  {position==="QB"&&<div><small>PASS ATT</small><b>{Number(pr?.passingAttempts||0).toFixed(1)}</b></div>}
                  {position==="QB"&&<div><small>PASS YDS</small><b>{Number(pr?.passingYards||0).toFixed(1)}</b></div>}
                  {position==="QB"&&<div><small>PASS TD</small><b>{Number(pr?.passingTouchdowns||0).toFixed(2)}</b></div>}
                  {position==="QB"&&Number(pr?.rushingAttempts||0)>0&&<div><small>CARRIES</small><b>{Number(pr.rushingAttempts).toFixed(1)}</b></div>}
                  {position==="QB"&&Number(pr?.rushingYards||0)>0&&<div><small>RUSH YDS</small><b>{Number(pr.rushingYards).toFixed(1)}</b></div>}
                  {position==="QB"&&Number(pr?.rushingTouchdowns||0)>0&&<div><small>RUSH TD</small><b>{Number(pr.rushingTouchdowns).toFixed(2)}</b></div>}

                  {["WR","TE"].includes(position)&&Number(pr?.receivingTargets||0)>0&&<div><small>TARGETS</small><b>{Number(pr.receivingTargets).toFixed(1)}</b></div>}
                  {["WR","TE"].includes(position)&&Number(pr?.receptions||0)>0&&<div><small>RECEPTIONS</small><b>{Number(pr.receptions).toFixed(1)}</b></div>}
                  {["WR","TE"].includes(position)&&Number(pr?.receivingYards||0)>0&&<div><small>REC YDS</small><b>{Number(pr.receivingYards).toFixed(1)}</b></div>}
                  {["WR","TE"].includes(position)&&<div><small>REC TD</small><b>{Number(pr?.receivingTouchdowns||0).toFixed(2)}</b></div>}

                  {position==="RB"&&Number(pr?.rushingAttempts||0)>0&&<div><small>CARRIES</small><b>{Number(pr.rushingAttempts).toFixed(1)}</b></div>}
                  {position==="RB"&&Number(pr?.rushingYards||0)>0&&<div><small>RUSH YDS</small><b>{Number(pr.rushingYards).toFixed(1)}</b></div>}
                  {position==="RB"&&Number(pr?.receivingTargets||0)>0&&<div><small>TARGETS</small><b>{Number(pr.receivingTargets).toFixed(1)}</b></div>}
                  {position==="RB"&&Number(pr?.receptions||0)>0&&<div><small>RECEPTIONS</small><b>{Number(pr.receptions).toFixed(1)}</b></div>}
                  {position==="RB"&&Number(pr?.receivingYards||0)>0&&<div><small>REC YDS</small><b>{Number(pr.receivingYards).toFixed(1)}</b></div>}
                  {position==="RB"&&<div><small>RUSH TD</small><b>{Number(pr?.rushingTouchdowns||0).toFixed(2)}</b></div>}
                  {position==="RB"&&<div><small>REC TD</small><b>{Number(pr?.receivingTouchdowns||0).toFixed(2)}</b></div>}
                  {position==="RB"&&<div><small>TOTAL TD</small><b>{totalTds.toFixed(2)}</b></div>}
                </div>
              </div>})()}

              <div className="modalColumns">
                <div className="modalSection">
                  <div className="modalSectionHead"><div><small>AVAILABILITY</small><h3>Injury report</h3></div></div>
                  <div className="injuryCard">
                    <b>{injury}</b>
                    <p>{playerInsight?.espnInjury?.detail || (selectedPlayer.injury_status
                      ? `${name(selectedPlayer)} currently carries a ${selectedPlayer.injury_status} designation in Sleeper player data. Recheck before lineup lock.`
                      : `No current injury designation is shown for ${name(selectedPlayer)} in Sleeper player data.`)}</p>
                    {playerInsight?.espnInjury?.bodyPart&&<small>Reported area: {playerInsight.espnInjury.bodyPart}</small>}
                  </div>
                </div>

                <div className="modalSection">
                  <div className="modalSectionHead"><div><small>LATEST</small><h3>Player news</h3></div><span>ESPN</span></div>
                  <div className="newsList">
                    {(playerInsight?.news||[]).length?playerInsight.news.map(item=><a key={item.id} href={item.link||"#"} target={item.link?"_blank":undefined} rel="noreferrer">
                      <b>{item.headline}</b>
                      {item.description&&<p>{item.description}</p>}
                      {item.published&&<small>{new Date(item.published).toLocaleDateString()}</small>}
                    </a>):<p className="muted">No recent ESPN player-specific stories were returned.</p>}
                  </div>
                </div>
              </div>

              <div className="modalFoot">Click any player throughout FTW Fantasy to reopen this profile. Projection and matchup information can change as news, injuries and depth charts change.</div>
            </>}
          </div>
        </div>
      })()}

      <section className="ticker glass"><b>FTW WIRE</b><span>{trending.slice(0,8).map(t=>players[t.player_id]).filter(Boolean).map(name).join(" • ")||"Connecting to live player movement…"}</span></section>
    </div>

    <footer><b>FTW FANTASY</b><span>Fantasy decisions without the clutter.</span><small>League/roster/player movement uses Sleeper. FTW calculates weekly projections from underlying projected stat lines when the feed is available. FTW combines those inputs into recommendations; no projection guarantees an outcome.</small></footer>
  </main>
}

function Head({kicker,title}){return <div className="head"><div><small>{kicker}</small><h2>{title}</h2></div></div>}
function Stat({label,value}){return <div className="stat glass"><small>{label}</small><b>{value}</b></div>}
function PlayerPicker({label,value,set,pool,score,projection,onPlayer}){
  const p=pool.find(x=>id(x)===String(value));
  return <div className="picker glass">
    <label>{label}</label>
    <select value={value} onChange={e=>set(e.target.value)}>
      {pool.map(p=><option value={id(p)} key={id(p)}>{name(p)} — {p.position}</option>)}
    </select>
    {p&&<button
      type="button"
      className="focus playerFocusButton"
      onClick={()=>onPlayer?.(p)}
    >
      <PlayerAvatar p={p} size="lg"/>
      <div className="focusInfo">
        <strong>{projection?.(p)!==null?`${projection(p).toFixed(1)} pts`:score(p)}</strong>
        <b>{name(p)}</b>
        <small>{projection?.(p)!==null?"LIVE WEEKLY PROJECTION":"FTW FALLBACK SCORE"} • {p.position} • {p.team||"FA"} • {p.injury_status||p.status||"Active"}</small>
      </div>
    </button>}
  </div>;
}

function Why({title,items}){
  return <div className="why">
    <b>{title}</b>
    <ul>
      {items.filter(Boolean).slice(0,7).map((x,i)=><li key={i}>{x}</li>)}
    </ul>
  </div>;
}

function TradeSide({label,ids,addPlayer,removePlayer,pool,value,valueFn,onPlayer}){
  const [query,setQuery]=useState("");
  const normalized=query.trim().toLowerCase();
  const matches=normalized
    ? pool.filter(p=>name(p).toLowerCase().includes(normalized)&&!ids.includes(id(p))).slice(0,10)
    : [];

  return <div className="tradeSide glass">
    <div className="tradeSideHead">
      <label>{label}</label>
      <span>{ids.length}/6</span>
    </div>

    <div className="tradeSearch">
      <input
        value={query}
        onChange={e=>setQuery(e.target.value)}
        placeholder="Search active player…"
        aria-label={`${label} player search`}
      />
      {normalized&&<div className="tradeSearchResults">
        {matches.length?matches.map(p=><div className="tradeSearchRow" key={id(p)}>
          <button type="button" className="tradeSearchPlayer" onClick={()=>onPlayer?.(p)}>
            <PlayerAvatar p={p} size="xs"/>
            <span><b>{name(p)}</b><small>{p.position} • {p.team||"FA"}</small></span>
          </button>
          <button
            type="button"
            className="tradeAdd"
            disabled={ids.length>=6}
            onClick={()=>{addPlayer(id(p));setQuery("");}}
            aria-label={`Add ${name(p)}`}
          >＋</button>
        </div>):<div className="tradeNoResults">No active players found.</div>}
      </div>}
    </div>

    <div className="tradeSelected tradeSelectedLarge">
      {ids.map(pid=>{
        const p=pool.find(x=>id(x)===String(pid));
        return p?<div className="tradeSelectedPlayer" key={pid}>
          <button type="button" className="tradeChipPlayer" onClick={()=>onPlayer?.(p)}>
            <PlayerAvatar p={p} size="xs"/>
            <span>{name(p)}</span>
          </button>
          <button type="button" className="tradeRemove" onClick={()=>removePlayer(pid)} aria-label={`Remove ${name(p)}`}>×</button>
        </div>:null;
      })}
    </div>

    <div className="package">
      <span>PACKAGE</span>
      <b>{value}</b>
    </div>
  </div>;
}

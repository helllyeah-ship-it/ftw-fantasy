"use client";

import { useEffect, useMemo, useState } from "react";

const DEMO = [
  ["d1","Jalen Hurts","QB","PHI"],["d2","Bijan Robinson","RB","ATL"],
  ["d3","De'Von Achane","RB","MIA"],["d4","Garrett Wilson","WR","NYJ"],
  ["d5","Zay Flowers","WR","BAL"],["d6","Sam LaPorta","TE","DET"],
  ["d7","Emeka Egbuka","WR","TB"],["d8","Parker Washington","WR","JAX"],
  ["d9","TreVeyon Henderson","RB","NE"],["d10","Tyler Warren","TE","IND"]
].map(([player_id,full_name,position,team])=>({player_id,full_name,position,team,active:true}));

const NAV = [
  ["team","⚡","Team"],["optimize","◎","Optimize"],["startsit","✓","Start/Sit"],
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
  const [projectionFeed,setProjectionFeed]=useState({configured:false,provider:"HuddleBot",retrievedAt:null,projections:[]});
  const [projectionError,setProjectionError]=useState("");

  useEffect(()=>{
    (async()=>{
      try{
        const [s,p,t,d]=await Promise.all([
          safeJson("/api/sleeper/state"),
          safeJson("/api/sleeper/players"),
          safeJson("/api/sleeper/trending?type=add&hours=24&limit=30"),
          safeJson("/api/sleeper/trending?type=drop&hours=24&limit=30")
        ]);
        setNfl(s);setPlayers(p);setTrending(t);setTrendingDrops(d);
      }catch(e){setStatus("Live feed is temporarily unavailable. Demo Mode still works.");}
    })();
  },[]);

  useEffect(()=>{
    if(!nfl?.season || !nfl?.week) return;
    (async()=>{
      try{
        const feed = await safeJson(`/api/provider/projections?season=${nfl.season}&week=${nfl.week}`);
        setProjectionFeed(feed);
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

  const projectedFantasyPoints=(p)=>{
    const pr=projectionFor(p);
    if(!pr || !Number.isFinite(Number(pr.projectedPoints))) return null;
    return Math.round(Number(pr.projectedPoints)*10)/10;
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
    let unused=[...pool].sort((a,b)=>score(b)-score(a));
    const starters=slots().map(slot=>{
      const i=unused.findIndex(p=>eligible(p,slot));
      if(i<0)return {slot,p:null};
      return {slot,p:unused.splice(i,1)[0]};
    });
    return {starters,bench:unused};
  },[roster,league,format.label]);

  const find=(x)=>pool.find(p=>id(p)===String(x))||Object.values(players).find(p=>id(p)===String(x));
  const A=find(startA),B=find(startB);
  const startWinner=A&&B?(score(A)>=score(B)?A:B):null;
  const startLoser=A&&B?(startWinner===A?B:A):null;

  const tradePool=useMemo(()=>Object.values(players).filter(p=>["QB","RB","WR","TE"].includes(p.position)&&p.active!==false).sort((a,b)=>tradeValue(b)-tradeValue(a)).slice(0,450),[players,format.label]);
  const packageValue=(ids)=>{
    const vals=ids.slice(0,3).map(x=>tradeValue(find(x))).filter(Boolean).sort((a,b)=>b-a);
    let v=vals.reduce((a,b)=>a+b,0)-Math.max(0,vals.length-1)*3;
    if(vals[0]>=90)v+=5;return Math.round(v);
  };
  const gv=packageValue(give),rv=packageValue(get),winPct=gv+rv?Math.max(5,Math.min(95,Math.round(50+(rv-gv)/(gv+rv)*100))):50;

  const weakest=(position)=>{
    const xs=pool.filter(p=>!position||p.position===position).sort((a,b)=>score(a)-score(b));
    return xs[0]||[...pool].sort((a,b)=>score(a)-score(b))[0];
  };
  const waiverRows=trending.map(t=>({t,p:players[t.player_id]})).filter(x=>x.p&&(["ALL",x.p.position].includes(pos))).slice(0,14);

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

  const multiSelect=(e,setter)=>{
    const vals=[...e.target.selectedOptions].map(o=>o.value).slice(0,3);
    setter(vals);
  };

  return <main>
    <header className="topbar">
      <div className="brand"><span>FTW</span> FANTASY</div>
      <div className="live"><i/> {nfl?"LIVE":"CONNECTING"}</div>
    </header>

    <div className="shell">
      <section className="hero">
        <div><small>FANTASY FOOTBALL • SIMPLIFIED</small><h1>BUILD THE <em>WINNING</em> TEAM.</h1><p>One clean place for roster grades, lineup decisions, trades, waivers and live player movement.</p></div>
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
          <b>{projectionFeed.configured ? "HUDDLEBOT CONNECTED" : "HUDDLEBOT FEED UNAVAILABLE"}</b>
          <span>{projectionFeed.configured
            ? `${projectionFeed.projections.length} weekly player projections loaded${projectionFeed.retrievedAt?` • refreshed ${new Date(projectionFeed.retrievedAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}`:""}`
            : "No API key is required. FTW will use its fallback model if the public HuddleBot feed is unavailable."}</span>
          {projectionFeed.configured&&<span className="providerAttribution">Public HuddleBot projection feed • no API key</span>}
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
          {[...pool].sort((a,b)=>score(b)-score(a)).map(p=><div className="row" key={id(p)}><span><b>{name(p)}</b><small>{p.team||"FA"}</small></span><span className="pink">{p.position}</span><span className="projection">{projectedFantasyPoints(p)!==null?`${projectedFantasyPoints(p).toFixed(1)} pts`:"—"}</span><span className={p.injury_status?"warn":"ok"}>{p.injury_status||p.status||"Active"}</span></div>)}
        </div>
      </section>}

      {tab==="optimize"&&<section>
        <Head kicker="LINEUP ENGINE" title="Best Legal Lineup"/>
        <div className="lineup">{optimal.starters.map((x,i)=><div className="slot glass" key={`${x.slot}-${i}`}><span>{x.slot}</span><b>{x.p?name(x.p):"EMPTY"}</b><em>{x.p?(projectedFantasyPoints(x.p)!==null?`${projectedFantasyPoints(x.p).toFixed(1)} PTS`:"PROJ —"):"--"}</em></div>)}</div>
        <div className="result glass"><h3>BENCH CHECK</h3><p>{optimal.bench[0]?`${name(optimal.bench[0])} is your highest-rated bench player at FTW ${score(optimal.bench[0])}. Recheck late injury news before kickoff.`:"No extra bench player is available."}</p></div>
      </section>}

      {tab==="startsit"&&<section>
        <Head kicker="WEEKLY DECISION" title="Start / Sit"/>
        <div className="explainer glass"><b>How FTW decides:</b> League scoring, positional value, live Sleeper injury/status metadata, depth-chart placement and recent player movement all influence the recommendation. The FTW score is a decision model, not an official projection.</div>
        <div className="compare">
          <PlayerPicker label="PLAYER A" value={startA} set={setStartA} pool={pool} score={score} projection={projectedFantasyPoints}/>
          <div className="vs">VS</div>
          <PlayerPicker label="PLAYER B" value={startB} set={setStartB} pool={pool} score={score} projection={projectedFantasyPoints}/>
        </div>
        {startWinner&&<div className="result glass">
          <h3>START {name(startWinner).toUpperCase()}</h3>
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
          <div className="accuracyNote"><b>Data source:</b> {projectionFor(startWinner) ? "weekly projection from HuddleBot + your Sleeper league settings and live player metadata." : "Sleeper live metadata + FTW fallback model because the HuddleBot feed is currently unavailable."}</div>
        </div>}
      </section>}

      {tab==="trade"&&<section>
        <Head kicker="MULTI-PLAYER DEALS" title="Trade Analyzer"/>
        <div className="explainer glass"><b>How FTW decides:</b> It evaluates each side using league-format scarcity, roster construction, package size, elite-player consolidation, current player status and your biggest positional need.</div>
        <p className="helper">Select up to three players on each side. FTW applies league-format scarcity and an elite-player consolidation premium.</p>
        <div className="compare">
          <TradeSide label="YOU GIVE" ids={give} onChange={e=>multiSelect(e,setGive)} pool={tradePool.length?tradePool:DEMO} value={gv} valueFn={tradeValue}/>
          <div className="vs">⇄</div>
          <TradeSide label="YOU GET" ids={get} onChange={e=>multiSelect(e,setGet)} pool={tradePool.length?tradePool:DEMO} value={rv} valueFn={tradeValue}/>
        </div>
        {(give.length>0&&get.length>0)&&<div className="result glass">
          <h3>{winPct>=57?"ACCEPT":winPct>=46?"FAIR TRADE":"DECLINE"} • YOU {winPct}% / THEM {100-winPct}%</h3>
          <p>{rv>=gv?"The incoming package has the stronger adjusted FTW value.":"The outgoing package has the stronger adjusted FTW value."}</p>
          <Why title="Why FTW grades the trade this way" items={[
            `Adjusted package value: ${rv} received vs ${gv} given`,
            `League format: ${format.label}; scarcity changes in Superflex and TE-premium formats`,
            `Best player in the deal: ${name([...give.map(find),...get.map(find)].filter(Boolean).sort((a,b)=>tradeValue(b)-tradeValue(a))[0])}`,
            "FTW applies an elite-player consolidation premium and a small multi-roster-spot penalty",
            `Your current weakest position group is ${biggestNeed}, so deals that improve that group help your specific roster more`
          ]}/>
          <div className="accuracyNote"><b>Important:</b> trade percentages are FTW model estimates, not betting odds or official market probabilities. Live league settings, roster data and current player metadata inform the analysis.</div>
        </div>}
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
              <div><b>{name(p)}</b><small>{p.position} • {p.team||"FA"} • FTW decision score {score(p)}</small></div>
              <div><strong>+{t.count}</strong><small>24H Sleeper adds</small></div>
            </div>
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

      <section className="ticker glass"><b>FTW WIRE</b><span>{trending.slice(0,8).map(t=>players[t.player_id]).filter(Boolean).map(name).join(" • ")||"Connecting to live player movement…"}</span></section>
    </div>

    <footer><b>FTW FANTASY</b><span>Fantasy decisions without the clutter.</span><small>League/roster/player movement uses Sleeper. Weekly projections use HuddleBot when its public feed is available. FTW combines those inputs into recommendations; no projection guarantees an outcome.</small></footer>
  </main>
}

function Head({kicker,title}){return <div className="head"><div><small>{kicker}</small><h2>{title}</h2></div></div>}
function Stat({label,value}){return <div className="stat glass"><small>{label}</small><b>{value}</b></div>}
function PlayerPicker({label,value,set,pool,score,projection}){const p=pool.find(x=>id(x)===String(value));return <div className="picker glass"><label>{label}</label><select value={value} onChange={e=>set(e.target.value)}>{pool.map(p=><option value={id(p)} key={id(p)}>{name(p)} — {p.position}</option>)}</select>{p&&<div className="focus"><strong>{projection?.(p)!==null?`${projection(p).toFixed(1)} pts`:score(p)}</strong><b>{name(p)}</b><small>{projection?.(p)!==null?"LIVE WEEKLY PROJECTION":"FTW FALLBACK SCORE"} • {p.position} • {p.team||"FA"} • {p.injury_status||p.status||"Active"}</small></div>}</div>}
function Why({title,items}){return <div className="why"><b>{title}</b><ul>{items.filter(Boolean).slice(0,7).map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
function TradeSide({label,ids,onChange,pool,value,valueFn}){return <div className="tradeSide glass"><label>{label}</label><select multiple size={10} value={ids} onChange={onChange}>{pool.map(p=><option value={id(p)} key={id(p)}>{name(p)} • {p.position} • {valueFn(p)}</option>)}</select><div className="package"><span>PACKAGE</span><b>{value}</b></div></div>}

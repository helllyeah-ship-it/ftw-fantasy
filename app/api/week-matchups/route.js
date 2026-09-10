export async function GET(req){
  const url=new URL(req.url);
  const season=Number(url.searchParams.get("season"));
  const week=Number(url.searchParams.get("week"));

  if(!season||!week){
    return Response.json({error:"season and week are required"},{status:400});
  }

  try{
    const endpoint=`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season}&seasontype=2&week=${week}`;
    const res=await fetch(endpoint,{next:{revalidate:900}});
    if(!res.ok)throw new Error(`ESPN schedule HTTP ${res.status}`);
    const data=await res.json();

    const matchups={};
    for(const event of Array.isArray(data?.events)?data.events:[]){
      const competitors=event?.competitions?.[0]?.competitors||[];
      if(competitors.length<2)continue;
      for(const me of competitors){
        const opp=competitors.find(x=>x!==me);
        const team=String(me?.team?.abbreviation||"").toUpperCase();
        const opponent=String(opp?.team?.abbreviation||"").toUpperCase();
        if(team&&opponent){
          matchups[team]={
            opponent,
            homeAway:me?.homeAway||"",
            date:event?.date||null
          };
        }
      }
    }

    return Response.json({season,week,matchups,retrievedAt:new Date().toISOString()});
  }catch(error){
    return Response.json({
      season,week,matchups:{},
      error:"Current-week matchup feed unavailable",
      detail:String(error?.message||error)
    },{status:200});
  }
}

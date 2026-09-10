# FTW Fantasy — Production Starter

This is the deployable Next.js version of FTW Fantasy.

## What works now
- Next.js App Router
- Server-side Sleeper API proxy
- Server caching of the large Sleeper player map for 24 hours
- Sleeper username lookup
- Current-season league import
- Real roster import
- Current matchup points
- Live 24-hour trending adds
- Player status / injury metadata where provided by Sleeper
- League-aware PPR / Half-PPR / Standard / Superflex / TE bonus detection
- Roster grading
- Legal lineup optimizer
- Start/Sit comparison
- 1–3 player Trade Analyzer
- Waiver add/drop suggestions
- Roster-aware FTW GM
- Mobile-first 80s neon UI

## Run locally
Requires Node.js 20.9+.

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel
1. Put this folder in a GitHub repository.
2. Go to Vercel and import the repository.
3. Framework preset should detect Next.js automatically.
4. Deploy.
5. Connect your custom domain in Vercel > Project > Settings > Domains.

No environment variables are required for the current Sleeper-backed build.

## Domain
Once you own a domain (for example ftwfantasy.com), add it in Vercel's Domains panel. Vercel will show the DNS records to set at your registrar.

## Data/licensing
Sleeper's API documentation says the API is read-only and free for non-commercial use. For commercial use, contact Sleeper about licensing.

The current FTW rating engine is a transparent heuristic model. It is NOT a licensed projection feed and should not be marketed as one.

## Next production integrations
The code is intentionally set up so additional server-only providers can be added without exposing API keys to the browser:
- Weekly projections
- Rest-of-season rankings
- Snap / route / target / carry usage
- Injury/practice news
- Sportsbook lines and implied totals
- Weather
- Defensive matchup metrics

Add provider keys to `.env.local`, never to client code.

## Recommended launch sequence
1. Deploy this version to Vercel.
2. Connect your domain.
3. Test several Sleeper leagues.
4. Contact Sleeper if you plan to monetize.
5. Add a licensed projection provider.
6. Add accounts/database only once you need saved preferences or paid subscriptions.


## Recommendation explanations added
Start/Sit, Trade Analyzer and Waiver Assistant now show the main reasons behind each recommendation.

Live factual inputs come from Sleeper's documented API where available:
- league scoring and roster format
- roster membership
- matchup team points
- player status / injury metadata
- depth-chart metadata in the player map
- 24-hour trending adds and drops

The FTW decision score and trade percentage remain FTW model outputs, not official live statistics or licensed projections. This distinction is shown directly in the UI.



## Weekly projection-first UI
The lineup optimizer and roster views now display weekly projected fantasy points instead of the internal whole-number FTW score whenever the JerryGM feed is connected. If the projection provider is unavailable, the UI shows `PROJ —` rather than presenting the fallback model as a weekly projection.



## HuddleBot weekly projection provider

FTW Fantasy now uses HuddleBot as its external weekly projection source.

### Setup
No API key or account is required.

The server route `/api/provider/projections` requests HuddleBot's public projection feed and caches results for five minutes. FTW matches returned players to Sleeper players by Sleeper ID when available, then falls back to normalized player name + team.

### Reliability safeguard
HuddleBot is a small independent public service and its public documentation does not expose every endpoint detail in search-indexed text. To make the integration resilient, the adapter checks the common public projection routes and supports an optional `HUDDLEBOT_API_URL` Netlify environment variable if HuddleBot changes the route.

If HuddleBot is unreachable or changes its response format, FTW stays online and falls back to its internal model instead of displaying false provider projections.

### Data sources
- Sleeper: league, roster, player status, scoring settings and trending movement
- HuddleBot: weekly fantasy projection when its public feed is available
- FTW: lineup, Start/Sit, trade and waiver decision logic

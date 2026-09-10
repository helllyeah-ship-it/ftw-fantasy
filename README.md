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


## SportsDataIO provider upgrade

FTW Fantasy now supports provider-backed weekly NFL projections through SportsDataIO.

### Turn it on in Vercel
1. Create a SportsDataIO account / NFL API subscription or trial.
2. Copy the API key.
3. In Vercel open **Project → Settings → Environment Variables**.
4. Add:
   - Name: `SPORTSDATAIO_API_KEY`
   - Value: your SportsDataIO API key
5. Redeploy FTW Fantasy.

The API key is used only in a server-side Next.js route and is never sent to the browser.

### What FTW now uses from the provider
When the key is configured, FTW loads the current week's player projection feed and can use:
- projected fantasy points calculated for the connected Sleeper league's scoring rules
- projected passing attempts/yards/TDs/interceptions
- projected rushing attempts/yards/TDs
- projected targets/receptions/receiving yards/TDs
- projected fumbles and two-point conversions
- provider active/started/player status fields when present

FTW matches SportsDataIO players to Sleeper players by normalized player name and team. This avoids exposing provider IDs in the UI.

### Refresh behavior
The FTW server route caches projection calls for 5 minutes. This is intentionally much fresher than the daily Sleeper player-map cache and is appropriate for lineup decision periods.

### Fallback behavior
If `SPORTSDATAIO_API_KEY` is missing or the provider is unavailable, FTW clearly switches back to its heuristic decision model rather than displaying fake provider projections.

## Weekly projection-first UI
The lineup optimizer and roster views now display weekly projected fantasy points instead of the internal whole-number FTW score whenever the SportsDataIO feed is connected. If the projection provider is unavailable, the UI shows `PROJ —` rather than presenting the fallback model as a weekly projection.

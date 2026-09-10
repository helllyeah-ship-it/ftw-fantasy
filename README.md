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




## Sleeper weekly projection feed

FTW Fantasy now uses Sleeper's weekly projection service so no separate API key is required.

### Important note
Sleeper's official public documentation does not currently document projections, even though the projection endpoint is available and is used by third-party Sleeper API clients. Because this endpoint is undocumented, Sleeper could change or remove it in the future.

FTW therefore keeps a fallback model and never fabricates a projection if the feed is unavailable.

### Projection display
FTW selects:
- PPR projection for leagues with 1.0 points per reception
- Half-PPR projection for leagues with 0.5 points per reception
- Standard projection for leagues with 0 points per reception

Player matching uses Sleeper player IDs first, which is more reliable than name matching.


## Sleeper projection hotfix
This version corrects the projection host to `api.sleeper.com`, while keeping `api.sleeper.app` as a fallback. It also handles both array responses and object responses keyed by Sleeper player ID. Rows are only accepted when an actual weekly points field (`pts_ppr`, `pts_half_ppr`, or `pts_std`) exists.


## Player headshots
Player avatars now use Sleeper's NFL player headshot CDN, keyed directly by Sleeper player ID:
`https://sleepercdn.com/content/nfl/players/thumb/<player_id>.jpg`

Headshots appear beside players in the roster, optimized lineup, Start/Sit focus cards/results, waiver cards, and selected trade-player chips. If a headshot is unavailable, FTW automatically falls back to the player's initials so the layout never breaks.


## ESPN player headshots
Player avatars now use ESPN's NFL headshot CDN instead of Sleeper's image host.

FTW reads the `espn_id` included in Sleeper player metadata and builds the image URL:
`https://a.espncdn.com/i/headshots/nfl/players/full/<espn_id>.png`

If ESPN has no image for a player, or the player's Sleeper record does not contain an ESPN ID, the UI falls back to the player's initials without breaking the layout.


## Clickable player profile upgrade
Every player can now open a fantasy profile modal. The modal includes:
- ESPN player avatar
- current injury/status information
- FTW Start/Sit recommendation for the active week
- rest-of-season weekly projections
- opponent and schedule difficulty for each remaining regular-season week
- recent ESPN player news

The profile API route is `/api/player/insight`.

Future weekly projections come from the same Sleeper projection adapter used elsewhere in FTW. Schedule and player-news data are requested server-side from ESPN endpoints. Schedule difficulty is intentionally transparent: each matchup is labeled EASY / MEDIUM / HARD based on that player's projected points for that week compared with the player's own average across remaining projected games. This avoids pretending the label is an official ESPN defensive matchup grade.

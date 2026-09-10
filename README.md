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


## Optimize your Lineup accuracy + avatar upgrade
- Renamed the Optimize tab to **Optimize your Lineup**.
- Players listed Out, IR, Inactive, PUP, Suspended, Reserve/NFI, or Doubtful are excluded from suggested starters.
- Questionable and game-time-decision players receive a risk discount instead of being treated as fully healthy.
- Weekly projected points are the primary lineup signal; depth chart and player movement are minor tie-breakers.
- The optimizer fills mandatory position slots before flexible slots to reduce bad roster assignments.
- Player photos now try ESPN first and automatically fall back to Sleeper's player headshot CDN before showing initials.


## Trade Analyzer + 2025 schedule-strength upgrade
- Trade player selection now uses a search bar.
- Only players Sleeper marks active are included.
- Up to six players can be added to each side with a + control and removed with ×.
- Trade results include short "good for your team" and "could hurt your team" sections.
- Player schedule difficulty now uses 2025 opponent defensive statistics rather than comparing projections to the player's own average.
- QB/WR/TE matchups use 2025 pass-yards-allowed rank.
- RB matchups use 2025 rush-yards-allowed rank.
- Other positions use 2025 points-allowed rank.
- Rank #1 is the toughest 2025 defense and #32 the most favorable.
- Tiers: HARD = ranks 1–10, MEDIUM = 11–22, EASY = 23–32.
- Defensive statistics are requested server-side from ESPN's 2025 regular-season team statistics endpoints and ranked by FTW.


## FTW native weekly projection engine
The visible fantasy-point projection is no longer taken directly from Sleeper's precomputed `pts_ppr`, `pts_half_ppr`, or `pts_std` field.

FTW now:
1. reads the projected player stat line (passing, rushing, receiving, turnovers and two-point conversions),
2. calculates fantasy points using the connected Sleeper league's scoring settings,
3. applies a modest matchup adjustment using the opponent's 2025 defensive rank,
4. applies current injury/availability risk,
5. caps malformed outlier results with position-based sanity limits.

2025 opponent-defense adjustment is intentionally small (about +/-8% at the extremes) so projected workload and player talent remain the dominant inputs.

The player profile also displays a floor, expected projection, ceiling, confidence level and projected opportunity when the underlying inputs are available.

Important: FTW projections are model estimates. They are not official NFL projections or guarantees of fantasy performance.


## 2025 defense strength-of-schedule color upgrade
FTW now shows matchup difficulty as a color instead of a word:
- Green = great matchup (opponent defense rank 23–32)
- Yellow = okay matchup (rank 11–22)
- Red = bad matchup (rank 1–10)

Position-specific matchup source:
- RB uses the opponent's 2025 rush-defense rank.
- QB and WR use the opponent's 2025 pass-defense rank.
- TE also uses 2025 pass-defense rank.
- Rank #1 is the toughest defense and #32 is the most favorable matchup.

The defense API now retains the complete available 2025 ESPN team-stat payload and exposes additional passing, rushing, scoring and situational defensive fields for future FTW models. Player cards display the relevant defense rank and available supporting metrics such as yards allowed per game, touchdowns allowed, interceptions, sacks and yards per carry.


## nflverse 2025 defense model
The previous ESPN defensive-stat parser has been removed from the strength-of-schedule ranking.

FTW now loads a public 2025 defense dataset derived from nflverse regular-season play-by-play and creates two independent 1–32 rankings:
- PASS DEF: used for QB, WR and TE matchups.
- RUSH DEF: used for RB matchups.

Pass-defense composite:
- EPA/play allowed: 30%
- offensive success rate allowed: 20%
- yards/play allowed: 20%
- TD rate allowed: 12%
- pressure rate: 8%
- sack rate: 5%
- interception rate: 5%

Rush-defense composite:
- EPA/play allowed: 30%
- offensive success rate allowed: 25%
- yards/play allowed: 25%
- TD rate allowed: 12%
- first-down rate allowed: 8%

Rank #1 is toughest and #32 is most favorable.
- Red: #1–10
- Yellow: #11–22
- Green: #23–32

This guarantees the color distribution comes from a complete league-wide ranking instead of independently classifying raw ESPN fields. The API rejects incomplete data unless all 32 NFL teams are present.

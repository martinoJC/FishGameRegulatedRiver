# Project Plan — Fish Game: Regulated River

## Game concept (from CONTEXT.md)
- Top-down 2D pixel game. You play a fish swimming up a river.
- Fish auto-scrolls forward; player uses left/right (arrows on desktop, tap zones on mobile) to dodge barriers (logs, etc).
- Multiple levels planned, each a "more regulated" river (more/harder obstacles). Level 1 only for the first version.
- Simple, pixelated art style to start.
- Must work on desktop and mobile.
- Hosted on GitHub Pages, auto-deployed on push to main.

## Decisions made
| Area | Decision | Why |
|---|---|---|
| Tech stack | Plain JavaScript + HTML5 Canvas, no framework/build step | Fast to scaffold, deploys as static files, full control for a simple game |
| Mobile input | On-screen tap zones (left half / right half of screen) | Simple, reliable, no gesture ambiguity |
| Deployment | GitHub Actions workflow → GitHub Pages, triggered on push to main | Automatic deploys; leaves room for a build step later without changing the workflow |
| Project structure | Single `index.html` + `game.js` + `style.css` at repo root | Matches the no-build-step decision; nothing to bundle |
| Screen size handling | Fixed internal canvas resolution (240×360) scaled responsively via CSS (`image-rendering: pixelated`) | Keeps pixel art crisp at any screen size, including mobile |
| Collision + game over | Instant game over on any obstacle contact, tap/Space/button to restart | Simplest to build for level 1; easy to change to a lives system later |
| Scoring | Score = distance survived (time-based), best score stored in `localStorage` | No backend needed, gives players a reason to replay |
| Difficulty curve | River scroll speed ramps up gradually over time (capped), obstacle spawn interval shortens as you survive longer | Matches "more regulated river" theme — level 1 should still get harder over a run |
| Asset pipeline | Hand-authored pixel-grid sprites drawn directly on canvas (no external image-generation tool available in this environment) | Achieves genuine pixel art without needing PNG assets or an asset loader; kept the "AI-drawn pixel art" look by hand-designing the sprite grids |
| Obstacle spawning | Weighted random spawning across 6 obstacle types (see below) | Keeps runs varied and replayable rather than one fixed pattern |

## Obstacle types (level 1)
| Type | Behaviour | Visual |
|---|---|---|
| Log | Solid floating obstacle of variable width/position, dodge either side | Procedural pixel rect with wood grain + log-end caps |
| Weir | Spans just over half the river from one bank, single gap on the other side | Procedural pixelated concrete/spillway texture |
| Fishing net | Spans further across the river than the weir (narrower gap = harder), spans from one bank | Procedural mesh texture with buoys at each end |
| Predator bird | Smaller hazard that drifts side-to-side (sine wave) as it scrolls down | Hand-authored pixel sprite, top-down silhouette with spread wings |
| Floating debris | Small, faster-than-river-flow hazard (tyre / bottle / can, randomly chosen) | Hand-authored pixel sprites, 3 variants |
| Motorboat | Larger, fastest-moving hazard | Hand-authored pixel sprite with hull stripe + wake |

**Backlog for later, more-regulated levels** (not built yet): irrigation pump intakes, fish ladder gates, lock chamber gates, pollution/turbidity zones. Revisit once level 1 is tuned and level 2+ design starts.

## Open questions still to decide
None blocking further scaffolding right now — the list above covers the core decisions for level 1. Revisit tuning (obstacle spawn weights, gap widths, difficulty ramp pace) once the game has been played a few times.

## Proposed process to work through this
1. Lock in the open questions above (quick answers, doesn't need to be perfect — level 1 is meant to be simple).
2. Scaffold the repo: `index.html`, `game.js`, `style.css`, `.github/workflows/deploy.yml`.
3. Build the game loop: canvas setup, fish entity, auto-scroll, keyboard input.
4. Add mobile tap-zone input alongside keyboard input.
5. Add obstacle spawning + collision detection.
6. Add game over / restart state.
7. Wire up GitHub Actions deploy workflow, verify it publishes to GitHub Pages on push to main.
8. Playtest on desktop and a real mobile device (or browser dev-tools mobile emulation), tune scroll speed / obstacle spacing.
9. Once level 1 feels good, revisit CONTEXT.md's "Planned workflow" section and plan level 2+ (more regulation = more/faster obstacles).

## Planned workflow (from CONTEXT.md, to fill in as we go)
1. Scaffold repo + deploy pipeline
2. Build level 1 core gameplay
3. Playtest, tune, expand to further levels

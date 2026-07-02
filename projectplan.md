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
| Obstacle spawning | Weighted random spawning across 4 obstacle types (see below) | Keeps runs varied and replayable rather than one fixed pattern |
| Fish species | Golden perch (recoloured from the original Murray cod concept) | User preference — golden/pastel tones read better against the pastel palette |
| Colour palette | Pastel tones across river, banks, obstacles, and UI chrome (grey neutral for page/UI chrome, not purple) | User preference — softer, friendlier look; purple was tried and rejected in favour of grey |
| Sprite readability | Every hand-authored creature sprite gets an auto-generated 1px outline (dark shade of its own palette) plus eyes, drawn via a generic `drawSprite(..., outline)` helper | User found the bird/turtle hard to identify at the original small scale; outlining + slightly larger pixel size (2 → 2.4) fixed legibility without hand-redrawing every sprite from scratch |

## Obstacle types (level 1)
| Type | Behaviour | Visual |
|---|---|---|
| Log | Solid floating obstacle of variable width/position, dodge either side | Procedural pixel rect, pastel wood tones with grain + log-end caps |
| Weir | Spans just over half the river from one bank, single gap on the other side | Procedural pixelated pastel concrete/spillway texture |
| Predator bird | Smaller hazard that drifts side-to-side (sine wave) as it scrolls down | Hand-authored pixel sprite, white/pastel-grey with outline, distinct head/beak/eyes and swept wingtips (redesigned so it reads as a bird, not a bat) |
| Turtle | Larger, fastest-moving hazard (same movement mechanism as the earlier motorboat concept) | Hand-authored pixel sprite, pastel green shell with outline, head/eyes/legs/tail |

**Removed from level 1**: fishing net and floating debris obstacles — user found them didn't add to the gameplay; dropped rather than kept as unused code.

**Backlog for later, more-regulated levels** (not built yet): irrigation pump intakes, fish ladder gates, lock chamber gates, pollution/turbidity zones. Revisit once level 1 is tuned and level 2+ design starts.

## Fish ladder section
A timed sub-section within a run rather than a separate obstacle: a curvy pool-and-weir channel with no hard obstacles, just walls that cost health (not an instant death) if you drift into them.

| Aspect | Decision |
|---|---|
| Trigger | Starts at 10 seconds survived, lasts 7 seconds, then returns automatically to the normal river with obstacles |
| Structure | Winding S-curve channel (~55% of river width) rendered as pastel concrete banks around pastel water, with periodic lighter "step" lines suggesting pool-and-weir pools — purely decorative, not collidable |
| Health | Starts at 5 on entry; drifting outside the channel costs 1 health with a 0.6s grace window (so resting against a wall doesn't instantly drain you); reaching 0 ends the run |
| Normal obstacles | Cleared and paused for the duration of the ladder section, resuming with a short grace period afterwards |
| Feedback | On-screen banner announces entering ("Fish ladder ahead — stay in the channel!") and leaving ("Back to the river"); a Health HUD readout only shows during the ladder section |

## Open questions still to decide
None blocking further scaffolding right now — the list above covers the core decisions for level 1. Revisit tuning (obstacle spawn weights, gap widths, difficulty ramp pace, fish-ladder channel width/curviness) once the game has been played a few times.

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

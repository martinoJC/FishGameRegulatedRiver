# Project Plan — Regulated Waters

## Game concept (from CONTEXT.md)
- Top-down 2D pixel game. You play a fish swimming up a river.
- Fish auto-scrolls forward; player uses left/right (arrows on desktop, tap zones on mobile) to dodge barriers (logs, etc).
- Multiple levels planned, each a "more regulated" river (more/harder obstacles). Level 1 shipped first; levels 2 and 3 (see "Levels 2 & 3" section below) completed the planned 3-level arc.
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
| Collision + game over | Shared health bar (5 max) across the whole run: normal obstacles cost 2 health, fish-ladder walls cost 1, both with a 0.6s invulnerability window (fish flickers) after a hit; game over only when health hits 0 | Originally instant-death on any contact; changed so the open river and the fish-ladder section feel consistent rather than a jarring difficulty swing between them |
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
| Predator bird | Smaller hazard that drifts side-to-side (sine wave) as it scrolls down | Hand-authored pixel sprite, redesigned as a symmetric "flying M" silhouette — beak, rounded head, wings swept back to pointed tips with gaps separating them from the body, tail fan |
| Turtle | Larger, fastest-moving hazard (same movement mechanism as the earlier motorboat concept) | Hand-authored pixel sprite, redesigned rounder/more oval (was too elongated) — small head, patterned oval shell, two pairs of legs poking out the sides, small tail |

**Removed from level 1**: fishing net and floating debris obstacles — user found them didn't add to the gameplay; dropped rather than kept as unused code.

## Levels 2 & 3

The game is now a 3-level arc, each level a different native fish species
facing a different kind of river regulation, "more regulated" than the last.
Built as a `LEVELS` config array in `game.js` — the game loop, collision,
scoring, and set-piece channel mechanics are written once and read from
whichever level is active, rather than being duplicated per level.

| Level | Species | Theme | Obstacles | Set-piece |
|---|---|---|---|---|
| 1 | Golden perch | Open regulated river | log / weir / bird / turtle | Fish ladder ("Pipe fishway ahead!") |
| 2 | Murray cod | Human trash / pollution | tire (solid) / fishing net (gap) / toxic waste pipe (drifting plume) | Storm drain gauntlet ("Storm drain ahead!"), pickup: recyclable bottle |
| 3 | Australian longfin eel | Dam/turbine, at night | turbine intake grate (solid) / sluice gate (gap) / spillway eddy (fast) | Turbine bypass channel ("Turbine bypass ahead!"), pickup: glass eel |

Every obstacle in every level is one of four reusable behavioral roles —
solid-floating, gap-with-a-side, side-to-side drifter, fast-mover — so
levels 2/3 reuse level 1's proven physics with new art rather than new
obstacle logic. Same for the set-piece: level 1's winding-channel mechanic
(entry/exit sweep transitions, wall collision, a themed pickup) is reused
for all three, just recolored/retextured/retitled per level.

**Progression**: health resets to full at the start of each level (fresh
start per level), but score accumulates across the whole run
(`totalScore`, folded in exactly once per level — see bug note below).
Every level — not just the last — ends with the same swim-in scene
(`enterEndingScene()`): banks recede, the fish glides to center, and it
comes to rest among a school of 7 others of its own species. What differs
per level is only the water color it settles into (`level.ending`, falls
back to the level's normal `theme.waterColor` if unset): levels 1 and 2
settle into a floodplain (their normal palette, just with banks gone),
level 3 settles into a much darker "ocean" blue — an eel's real migration
ends at sea, not a floodplain, so it gets its own ending color. After the
swim-in finishes, levels 1–2 show a "Level Complete" overlay introducing
the next level's species/theme with a "Continue" button; level 3 shows the
whole-game win screen instead.

**Swimming animation**: every fish species wiggles while swimming, not
just the eel. It's drawn as a single `drawSprite` call with a per-row x
offset function (`rowOffsetFn`), not by slicing the sprite into separately
-drawn chunks — chunking was the first approach and it broke outline
continuity at each chunk boundary (the outline algorithm only checks for
neighbors within the rows it's given), leaving a visible seam that made
tails look detached from the body even at rest. The eel S-curves its whole
body (`fromRow: 0`, per-row phase offset via `rowPhase`); the perch/cod —
round-bodied fish that don't flex like an eel — only flick their tail fin
(`fromRow` near the last few rows), with the offset tapering from 0 right
at the attachment point up to full amplitude at the tip, so the motion
blends into the static body instead of jumping. Collision still uses one
plain bounding rect like every other creature — the eel's longer sprite
naturally gives it a taller hitbox, which is the actual difficulty lever.

**Dev/testing shortcut**: append `?level=2` (or `3`) to the URL to jump
straight into that level without playing through the ones before it, or
press `1`/`2`/`3` on any start/game-over/win/level-complete screen — added
specifically so individual levels can be tested in isolation.

**Bugs found and fixed while building levels 2 & 3** (all the same root
cause — code that force-cleared an array or added to a score total the
instant a transition *started*, rather than when it actually finished):
- Obstacles and set-piece pickups (crabs/bottles/glass eels) were being
  wiped with `= []` the instant the set-piece's exit sweep began, so ones
  still visible mid-screen vanished abruptly instead of scrolling off
  naturally. Fixed by leaving them alone and letting the existing
  move/collide/cull logic finish the job — same fix applied to both.
- A pickup could still be mid-screen at the exact moment the exit sweep
  finished and `updateSetpiece`/`updateObstacles` stopped being called for
  it, leaving it stuck on screen forever with nothing left to move or
  remove it. Fixed with a safety-net clear at that exact transition point.
- The final level's score was briefly double-counted in `winGame()`
  (added once when the level finished, then added again via
  `totalScore + score`). Fixed by folding each level's score into
  `totalScore` exactly once, at the moment its swim-in scene completes.

**Pickup feedback**: collecting a set-piece pickup (crab/bottle/glass eel)
pops up a small "+ HEALTH" label anchored to its top-right corner, floating
upward and fading out over ~1.1s. It's drawn with a hand-built 3x5 pixel
font (`PIXEL_FONT`, only the handful of glyphs `+ HEALTH` needs) rendered
via `fillRect` on rounded coordinates, not `ctx.fillText` — plain canvas
text is anti-aliased and looked blurry once blown up by the game's
`image-rendering: pixelated` scaling, inconsistent with every other
hand-authored pixel-grid sprite in the game.

**Level 3 difficulty tuning** (post-playtest, iterative): the spillway eddy
(the fast-mover hazard) started at the same weight as the other two
obstacle types (25) and felt too rare, so it went through several rounds —
doubled to 50, then to 100 (4x original) — while turbineGrate/sluiceGate
weights stayed untouched throughout, since the ask was specifically "more
eddies," not "harder overall." Still felt too sparse right at the end of
the level, so two more changes landed together: the final river stretch
(after the set-piece exits, before the ending scene) was extended from the
default 10s to 20s via a new `level.finalRiverDuration` field, and a
`finalSectionWeightMultiplier: 2` on the eddy type doubles its weight again
specifically during that final stretch — obstacle picking now takes a
`finalSection` flag through `spawnObstacle`/`pickObstacleType` so per-type
weight boosts can apply only there without affecting the rest of the level
or the other two levels.

**Backlog for possible later levels** (not built): irrigation pump intakes,
lock chamber gates, urban stormwater/turbidity zones beyond what level 2
already covers. Revisit only if the game grows past 3 levels.

## Health system
A shared resource across the whole run (max 5), not just the fish-ladder section — see the Decisions table above for damage amounts. Displayed as a colour-shifting bar (green → yellow → red) that's always visible in the HUD, and the fish flickers while invulnerable after a hit so damage is felt.

## Fish ladder section
A timed sub-section within a run rather than a separate obstacle: a curvy pool-and-weir channel with no hard obstacles, just walls that damage the shared health bar (see above) if you drift into them.

| Aspect | Decision |
|---|---|
| Trigger | Starts at 10 seconds survived, lasts 10 seconds, then returns automatically to the normal river with obstacles |
| Structure | Winding S-curve channel (~55% of river width) rendered as pastel concrete banks around pastel water, with periodic lighter "step" lines suggesting pool-and-weir pools — purely decorative, not collidable |
| Crabs | Spawn periodically within the channel's safe width during the ladder section; touching one "eats" it, healing 1 health (capped at max) and adding 20 bonus score; first crab triggers a one-time "Eat the crabs!" banner (delayed so it doesn't collide with the section's entry banner) |
| Normal obstacles | Cleared and paused for the duration of the ladder section, resuming with a short grace period afterwards |
| Feedback | On-screen banner announces entering ("Fish ladder ahead — stay in the channel!"), the first crab ("Eat the crabs!"), and leaving ("Back to the river") |

## Level structure and end state
Each level (all 3, not just level 1) has a defined beginning, middle, and end rather than being an endless runner. This table shows level 1's timings; levels 2/3 follow the identical pacing with their own species/theme (see "Levels 2 & 3" above):

| Phase | Timing | What happens |
|---|---|---|
| Start screen | Before play begins | Static overlay: title + 3 short lines ("Migrate as native Australian fish through highly modified rivers." / "Dodge obstacles and collect objects." / "Reach the spawning grounds to win!"), "tap or press Space to start"; the river renders statically behind it as a backdrop, and a small canvas draws all 3 playable species lined up side by side (see UI/assets section below) |
| River | 0s–10s | Normal obstacles (log/weir/bird/turtle) |
| Fish ladder (set-piece) | 10s–20s | See Fish ladder section above / "Levels 2 & 3" for the generalized version |
| River | 20s–30s | Normal obstacles resume |
| Entering the ending scene | 30s–32.5s | A visible transition, not a hard cut: banks recede (interpolated bank width → 0), river current eases to a stop, the fish glides to horizontal center, and a school of 7 others of its own species gradually fades in |
| Ending scene | 32.5s+ | Fish has come to rest among the school; for level 1/2 this reads as a floodplain, level 3 as the ocean (darker water color). Levels 1–2 then show a "Level Complete" overlay (next level's intro + Continue button); level 3 shows the whole-game win overlay with final score and "play again" |

Game states are `start` → `playing` → `entering` → (`gameover`, `levelcomplete`, or `win`), all of which loop back to `playing` via the same restart flow (Space, tapping the touch layer, or the relevant button — `levelcomplete`'s button starts the next level instead of a full restart). The "entering" transition was added because originally the win overlay appeared the instant the level ended, hiding the ending scene behind it entirely — the fix was to hold off showing the overlay until the swim-in animation finishes.

**Bug fixed while adding the win screen**: `#touch-controls` (the invisible full-screen tap-zone layer) had no `z-index`, so as the last element in the DOM it stacked on top of every overlay screen and silently absorbed mouse clicks intended for the Start/Restart/Play-again buttons — only Space-to-restart reliably worked before. Fixed by giving `.overlay-screen` a higher `z-index` than `#touch-controls`.

## UI/assets and game name

The game was named "Fish Game: Regulated River" while scaffolding, then
renamed in turn to "Passage", "River Fish Go Go", and finally
**Regulated Waters** — updated in `index.html`'s `<title>`/start-screen
`<h1>` and `README.md` each time.

Overlay screens (start/game-over/level-complete/win) and buttons moved from
flat CSS-colored boxes to real pixel-art panels: `assets/ui-panel.png`
(`panel_brown.png`) and `assets/ui-button.png`
(`panel_brown_dark_corners_a.png`), both from Kenney's CC0
[UI Pack: Adventure](https://kenney.nl/assets/ui-pack-adventure). Applied
via CSS `border-image` (9-slice: `border-image-slice: 8` for the card,
`16` for the button to fully capture its corner bracket art) so each
stretches cleanly to fit its content rather than being one fixed-size
image. Picking the exact right tiles took a few rounds — Kenney has
multiple similarly-themed UI packs ("UI Pack", "UI Pack: Pixel Adventure",
"UI Pack: Adventure") with different tile sets, and the first two rounds
pulled tiles from the wrong pack entirely before landing on the correct
one, matched directly against the pack's own named files.

The start screen also draws a small canvas (`#title-fish-canvas`) showing
all 3 playable species — golden perch, Murray cod, longfin eel —
side-by-side, bottom-aligned, at a shared display scale independent of
each species' in-game pixel size, so the eel's real length reads clearly
against the other two.

## Open questions still to decide
None blocking further scaffolding right now — the list above covers the core decisions for level 1. Revisit tuning (obstacle spawn weights, gap widths, difficulty ramp pace, fish-ladder channel width/curviness, floodplain fish count/transition timing) once the game has been played a few times.

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

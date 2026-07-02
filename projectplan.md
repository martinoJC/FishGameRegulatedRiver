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

## Open questions still to decide
These need a decision before or during initial scaffolding:

1. **Project structure** — single `index.html` + `game.js` + `style.css` at repo root, or an `src/` + `public/` split?
2. **Rendering approach** — draw simple pixel sprites (rectangles/circles first, real sprite art later), or hand/AI-drawn pixel art sprites from the start?
3. **Obstacle spawning** — fixed hand-designed obstacle pattern for level 1, or randomized/procedural spawning?
4. **Difficulty/speed curve** — does the river scroll speed increase over time, or stay constant for level 1?
5. **Collision + game over** — what happens on hitting a barrier: instant game over, lose a life, or bounce/slow down?
6. **Scoring** — is there a score (distance survived, time, etc.) and is it shown/stored anywhere (e.g. localStorage high score)?
7. **Screen size handling** — fixed canvas resolution scaled to fit, or fully responsive canvas that resizes with the window/viewport?
8. **Asset pipeline** — plain colored shapes to start (fastest), vs. importing actual pixel-art PNG sprites (needs an assets folder + loader)?

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

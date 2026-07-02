# Project Context

# preferences
- deploy to git hub pages
- deploy automatically when we push to main
- i want it to be used on a computer and mobile


We want to create a simple game in 2D. It will have multiple levels, each level is a more and more regulated river. to start with lets just do one level. i am a fish moving through a river that has some barriers like logs. in level 1 the fish. fish moves automatically forward and we use the left and right arrows to avoid the barriers. This first version can be very simple and pixelated. the point of view would be from above as if im looking down on the river.

## Planned workflow
1. Scaffold the repo, tech stack, and deploy pipeline.
2. Build level 1 (golden perch, open regulated river) end-to-end.
3. Expand to a 3-level arc, each level a different native fish species facing a different kind of river regulation, "more regulated" than the last — see `projectplan.md` for the full design.

## Current status
Game is named **River Fish Go Go**. All 3 planned levels are built:
- Level 1 — golden perch, open regulated river (logs/weir/bird/turtle, fish ladder set-piece).
- Level 2 — Murray cod, human trash/pollution theme (tire/net/toxic waste pipe, storm drain set-piece).
- Level 3 — Australian longfin eel, dam/turbine theme at night (turbine grate/sluice gate/spillway eddy, turbine bypass set-piece); the eel is longer than the other two fish and has a swimming wiggle animation.

Tech stack: plain JavaScript + HTML5 Canvas, no framework or build step (see `projectplan.md` decisions table). Deployed to GitHub Pages via GitHub Actions on push to `main`. UI (start/game-over/level-complete/win screens, buttons) uses Kenney's CC0 "UI Pack: Adventure" pixel-art panels. Full design history and decisions are tracked in `projectplan.md`.



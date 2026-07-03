(() => {
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const levelLabelEl = document.getElementById("level-label");
  const healthBarFillEl = document.getElementById("health-bar-fill");
  const bannerEl = document.getElementById("banner");
  const startScreenEl = document.getElementById("start-screen");
  const startButton = document.getElementById("start-button");
  const gameOverScreen = document.getElementById("game-over-screen");
  const finalScoreEl = document.getElementById("final-score");
  const restartButton = document.getElementById("restart-button");
  const levelCompleteScreen = document.getElementById("level-complete-screen");
  const levelCompleteTitleEl = document.getElementById("level-complete-title");
  const levelCompleteBodyEl = document.getElementById("level-complete-body");
  const continueButton = document.getElementById("continue-button");
  const winScreenEl = document.getElementById("win-screen");
  const winScoreEl = document.getElementById("win-score");
  const winRestartButton = document.getElementById("win-restart-button");
  const touchLeft = document.getElementById("touch-left");
  const touchRight = document.getElementById("touch-right");

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const BANK_WIDTH = 24;
  const RIVER_LEFT = BANK_WIDTH;
  const RIVER_RIGHT = WIDTH - BANK_WIDTH;
  const RIVER_WIDTH = RIVER_RIGHT - RIVER_LEFT;

  // ---------------------------------------------------------------------
  // Pixel-art sprites (hand-authored pixel grids, drawn as crisp blocks)
  // ---------------------------------------------------------------------
  // `outline` (optional) stamps a 1-cell border color around the sprite's
  // silhouette first, which makes small pixel-art creatures read clearly
  // against a similarly-toned background. `targetCtx` defaults to the main
  // game canvas's context; the title screen's fish-lineup canvas is the
  // only other caller. `rowOffsetFn` (optional), if given, is called with
  // a row index and returns an extra x offset for that row — used to draw
  // a swimming wiggle in one call (see drawSwimmingFish) so the outline is
  // computed against the whole sprite's real connectivity instead of
  // being split across separate calls, which left a visible seam.
  function drawSprite(rows, palette, x, y, pixelSize, outline, targetCtx, rowOffsetFn) {
    const c2d = targetCtx || ctx;
    // Round the left/top and right/bottom edges independently (rather than
    // rounding position and using the raw fractional pixelSize as width),
    // so adjacent cells always share an exact boundary — otherwise
    // fractional pixelSize leaves stray sub-pixel gaps between cells that
    // let the background show through.
    function cellRect(gx, gy) {
      const rowX = rowOffsetFn ? x + rowOffsetFn(gy) : x;
      const left = Math.round(rowX + gx * pixelSize);
      const top = Math.round(y + gy * pixelSize);
      const right = Math.round(rowX + (gx + 1) * pixelSize);
      const bottom = Math.round(y + (gy + 1) * pixelSize);
      return [left, top, right - left, bottom - top];
    }

    if (outline) {
      c2d.fillStyle = outline;
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        for (let c = 0; c < row.length; c++) {
          if (row[c] === ".") continue;
          const neighbors = [
            [r - 1, c],
            [r + 1, c],
            [r, c - 1],
            [r, c + 1],
          ];
          for (const [nr, nc] of neighbors) {
            const nRow = rows[nr];
            const filled = nRow && nRow[nc] && nRow[nc] !== ".";
            if (!filled) {
              c2d.fillRect(...cellRect(nc, nr));
            }
          }
        }
      }
    }

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === ".") continue;
        c2d.fillStyle = palette[ch];
        c2d.fillRect(...cellRect(c, r));
      }
    }
  }

  function spriteDims(rows, pixelSize) {
    return { width: rows[0].length * pixelSize, height: rows.length * pixelSize };
  }

  // ---------------------------------------------------------------------
  // Player fish species (one per level)
  // ---------------------------------------------------------------------
  const PERCH_SPRITE = [
    "....B....",
    "...BBB...",
    "..BDBDB..",
    ".BEBDBEB.",
    ".BBDBDBB.",
    "CBBDBDBBC",
    "CBDBBBDBC",
    "CBBDBDBBC",
    "CCBDBDBCC",
    ".CBBBBBC.",
    ".CCBBBCC.",
    "..CCBCC..",
    "..CFBFC..",
    "...F.F...",
    "..F...F..",
    ".F.....F.",
  ];
  const PERCH_PALETTE = {
    B: "#f0d78c", // golden body
    D: "#c9a35a", // muted golden-brown mottling
    C: "#fbf3d9", // pale belly
    E: "#4a3a1c", // eye
    F: "#eab868", // fins/tail
  };

  // Murray cod: broader/stockier than the perch, mottled olive-green
  // camouflage pattern instead of smooth bands — reads as a different
  // species at a glance even reusing the same overall body plan.
  const COD_SPRITE = [
    "....BBB....",
    "...BMBMB...",
    "..BBEBEBB..",
    ".BBMBBBMBB.",
    "CBBBMBMBBBC",
    "CBMBBBBBMBC",
    "CBBBMBMBBBC",
    "CCBMBBBMBCC",
    "CCBBMBMBBCC",
    ".CBBBBBBBC.",
    ".CCBBBBBCC.",
    "..CCBBBCC..",
    "..CFBBBFC..",
    "...F.B.F...",
    "..F..B..F..",
    ".F...B...F.",
  ];
  const COD_PALETTE = {
    B: "#7a8c4f", // base olive-green
    M: "#4f5c34", // dark mottle spot
    C: "#d9d4a8", // pale belly
    E: "#2a2a1a", // eye
    F: "#6b7a45", // fins
  };

  // Longfin eel: much longer/slenderer than the other two fish, small
  // pectoral fins near the head only (no pelvic fins, matching real eel
  // anatomy). Drawn in short chunks with an alternating sine offset (see
  // drawPlayerFish) for a swimming S-curve — the sprite itself stays a
  // straight rigid grid, same as every other creature in the game.
  const EEL_SPRITE = [
    "..B..",
    ".BBB.",
    ".EBE.",
    ".BBB.",
    "FBBBF",
    ".BCB.",
    ".BCB.",
    ".DBD.",
    ".BCB.",
    ".DBD.",
    ".BCB.",
    ".DBD.",
    ".BCB.",
    ".DBD.",
    ".BCB.",
    ".DBD.",
    ".BCB.",
    ".DBD.",
    ".BBB.",
    "..B..",
  ];
  const EEL_PALETTE = {
    B: "#5c5230", // base dark olive-brown
    D: "#443c22", // shading
    C: "#8a7d4a", // highlight down the back
    E: "#1a1710", // eye
    F: "#6b6038", // pectoral fins
  };

  // ---------------------------------------------------------------------
  // Obstacle art shared by every level's obstacle roles: "solid" (floats
  // in place, dodge either side), "gap" (spans from one bank leaving a
  // single gap), "drifter" (sways side-to-side as it scrolls), and "fast"
  // (scrolls faster than everything else). The factories below build the
  // *behavior*; each level supplies its own art for each role.
  // ---------------------------------------------------------------------
  function makeSolidObstacle(type, minWidth, maxWidth, height) {
    const width = minWidth + Math.random() * (maxWidth - minWidth);
    const x = RIVER_LEFT + Math.random() * (RIVER_WIDTH - width);
    return { type, x, y: -height, width, height };
  }

  // Spans from one bank partway across the river, leaving a gap on the
  // other side.
  function makeGapObstacle(type, widthFrac, height) {
    const width = RIVER_WIDTH * widthFrac;
    const gapLeft = Math.random() < 0.5; // true = gap is on the left bank
    const x = gapLeft ? RIVER_RIGHT - width : RIVER_LEFT;
    return { type, x, y: -height, width, height, gapLeft };
  }

  function makeDrifterObstacle(type, width, height) {
    const baseX = RIVER_LEFT + Math.random() * (RIVER_WIDTH - width);
    return { type, x: baseX, baseX, y: -height, width, height, drifts: true, phase: Math.random() * Math.PI * 2 };
  }

  function makeFastObstacle(type, width, height, speedMult) {
    const x = RIVER_LEFT + Math.random() * (RIVER_WIDTH - width);
    return { type, x, y: -height, width, height, speedMult };
  }

  // --- Level 1: log / weir / bird / turtle ---------------------------
  function drawLog(o) {
    ctx.fillStyle = "#8a6a42";
    ctx.fillRect(o.x, o.y, o.width, o.height);
    ctx.fillStyle = "#c9a876";
    ctx.fillRect(o.x, o.y + 1, o.width, o.height - 2);
    ctx.fillStyle = "#e0c397";
    ctx.fillRect(o.x + 2, o.y + 1, o.width - 4, 2);
    ctx.fillStyle = "#a9835a";
    for (let gx = o.x + 6; gx < o.x + o.width - 6; gx += 9) {
      ctx.fillRect(gx, o.y + 3, 2, o.height - 6);
    }
    ctx.fillStyle = "#dbb98a";
    ctx.beginPath();
    ctx.arc(o.x + 5, o.y + o.height / 2, 4, 0, Math.PI * 2);
    ctx.arc(o.x + o.width - 5, o.y + o.height / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a9835a";
    ctx.beginPath();
    ctx.arc(o.x + 5, o.y + o.height / 2, 1.6, 0, Math.PI * 2);
    ctx.arc(o.x + o.width - 5, o.y + o.height / 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWeir(o) {
    ctx.fillStyle = "#b7b7af";
    ctx.fillRect(o.x, o.y, o.width, o.height);
    ctx.fillStyle = "#d8d8d2";
    ctx.fillRect(o.x, o.y + 1, o.width, o.height - 2);
    ctx.fillStyle = "#bcbcb4";
    for (let px = o.x; px < o.x + o.width; px += 10) {
      ctx.fillRect(px, o.y, 3, o.height);
    }
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let px = o.x; px < o.x + o.width; px += 8) {
      ctx.fillRect(px, o.y + o.height - 5, 4, 3);
    }
    ctx.fillStyle = "#eaeae4";
    ctx.fillRect(o.x, o.y, o.width, 2);
  }

  const BIRD_OUTLINE = "#8a94a0";
  const BIRD_PALETTE = {
    Y: "#f0b25c", // beak
    H: "#f7f7f5", // head/body
    E: "#2a2a28", // eye
    S: "#e2e6ea", // tail shading
    W: "#f2f2f0", // wing
  };
  // Flipped so the beak points down the river toward the fish, since the
  // bird spawns above and scrolls down.
  const BIRD_SPRITE = [
    "....SSSSS....",
    "WWW...H...WWW",
    ".WWW.HHH.WWW.",
    "..WWHHHHHWW..",
    "...WHHHHHW...",
    "....HHHHH....",
    ".....EHE.....",
    "......Y......",
  ];

  const TURTLE_OUTLINE = "#4f6b52";
  const TURTLE_PALETTE = {
    H: "#8a9c5e", // head
    E: "#2a2a1a", // eye
    K: "#a8b571", // legs/skin
    S: "#a9d6ab", // shell
    P: "#5f8f63", // shell pattern
  };
  const TURTLE_SPRITE = [
    "......HHH......",
    ".....SSSSS.....",
    ".KK.SSSSSSS.KK.",
    "....SSSSSSS....",
    "....SPPPPPS....",
    "....SSSSSSS....",
    "....SPPPPPS....",
    "....SSSSSSS....",
    ".KK.SSSSSSS.KK.",
    ".....SSSSS.....",
    "......E.E......",
    "......HHH......",
  ];

  // --- Level 2: tire (solid) / net (gap) / toxic waste plume (drifter) ---
  function drawTire(o) {
    const cx = o.x + o.width / 2;
    const cy = o.y + o.height / 2;
    const r = o.width / 2;
    const holeR = r * 0.3;
    // The hole is a true gap in the fill path (outer ring wound one way,
    // hole wound the other way cancels it out under the nonzero rule) so
    // the water already painted underneath this frame shows through,
    // instead of being covered by an opaque circle.
    ctx.fillStyle = "#2a2a2a";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.arc(cx, cy, holeR, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.fillStyle = "#55555a";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    ctx.arc(cx, cy, holeR, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.fillStyle = "#161616";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.fillRect(cx + Math.cos(a) * r * 0.8 - 1, cy + Math.sin(a) * r * 0.8 - 1, 2, 2);
    }
  }

  function drawNet(o) {
    ctx.fillStyle = "rgba(210,210,196,0.35)";
    ctx.fillRect(o.x, o.y, o.width, o.height);
    ctx.strokeStyle = "#8a8a78";
    ctx.lineWidth = 1;
    for (let px = o.x - o.height; px < o.x + o.width; px += 6) {
      ctx.beginPath();
      ctx.moveTo(px, o.y);
      ctx.lineTo(px + o.height, o.y + o.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px, o.y + o.height);
      ctx.lineTo(px + o.height, o.y);
      ctx.stroke();
    }
    ctx.strokeStyle = "#5a5a4a";
    ctx.strokeRect(o.x, o.y, o.width, o.height);
  }

  const PLUME_OUTLINE = "#4d6a1e";
  const PLUME_PALETTE = {
    G: "#8fae3a", // toxic green
    D: "#5f7a24", // dark shading
    Y: "#c8d84a", // sickly highlight
  };
  const PLUME_SPRITE = [
    ".G..Y..G.",
    "GGG.G.GGG",
    "GDGGGGGDG",
    "GGGDYDGGG",
    "GDGGGGGDG",
    ".GGGGGGG.",
  ];

  // --- Level 3: turbine grate (solid) / irrigation pump pipe (gap) / spillway eddy (fast) ---
  // A recessed, hazard-striped trash-rack — the intake screen in front of a
  // turbine — with pale streaks of water rushing between the bars. The
  // yellow/black stripe frame (a real hydro-infrastructure convention) is
  // what sets it apart from the pump pipe below at a glance, rather than
  // both obstacles reading as similar grey bar patterns.
  function drawTurbineGrate(o) {
    ctx.fillStyle = "#12181c";
    ctx.fillRect(o.x, o.y, o.width, o.height);

    const stripe = 4;
    ctx.fillStyle = "#e8c53a";
    ctx.fillRect(o.x, o.y, o.width, stripe);
    ctx.fillRect(o.x, o.y + o.height - stripe, o.width, stripe);
    ctx.fillStyle = "#22262a";
    for (let px = o.x; px < o.x + o.width; px += stripe * 2) {
      ctx.fillRect(px, o.y, stripe, stripe);
      ctx.fillRect(px, o.y + o.height - stripe, stripe, stripe);
    }

    ctx.strokeStyle = "#7a848d";
    ctx.lineWidth = 2;
    for (let px = o.x + 4; px < o.x + o.width; px += 7) {
      ctx.beginPath();
      ctx.moveTo(px, o.y + stripe);
      ctx.lineTo(px, o.y + o.height - stripe);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(180,205,215,0.5)";
    for (let px = o.x + 2; px < o.x + o.width; px += 7) {
      ctx.fillRect(px, o.y + o.height / 2 - 1, 3, 2);
    }
  }

  // An irrigation pump's intake pipe, jutting out from whichever bank it's
  // mounted to (reusing makeGapObstacle's `gapLeft` — true means the solid
  // mass sits against the right bank — to know which end is bolted down
  // and which end is the open mouth facing the river) with animated water
  // streaks visibly sliding into its open mouth, rather than a static
  // dead end or ambiguous decorative rings.
  function drawIrrigationPipe(o) {
    const mountRight = o.gapLeft;
    const midY = o.y + o.height / 2;
    const pipeH = Math.min(16, o.height * 0.6);
    const topY = midY - pipeH / 2;
    const mouthX = mountRight ? o.x : o.x + o.width;
    const mouthDir = mountRight ? -1 : 1; // which way open water extends from the mouth

    ctx.fillStyle = "#6b6258";
    ctx.fillRect(o.x, topY, o.width, pipeH);
    ctx.fillStyle = "#8f8474";
    ctx.fillRect(o.x, topY, o.width, 2);
    ctx.fillStyle = "#3f392f";
    ctx.fillRect(o.x, topY + pipeH - 2, o.width, 2);

    // Rivet/joint bands along the pipe
    ctx.fillStyle = "#332f28";
    for (let px = o.x + 4; px < o.x + o.width - 4; px += 9) {
      ctx.fillRect(px, topY, 2, pipeH);
    }

    // Mounting flange bolted to the bank
    const flangeX = mountRight ? o.x + o.width - 6 : o.x;
    ctx.fillStyle = "#4a4238";
    ctx.fillRect(flangeX, topY - 3, 6, pipeH + 6);

    // Open intake mouth
    const mouthR = pipeH / 2 + 1;
    ctx.fillStyle = "#dfe6ea";
    ctx.beginPath();
    ctx.arc(mouthX, midY, mouthR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#161a1c";
    ctx.beginPath();
    ctx.arc(mouthX, midY, mouthR - 2, 0, Math.PI * 2);
    ctx.fill();

    // Small ">"-shaped arrows visibly traveling toward the mouth and
    // vanishing into it, rather than static rings or thin streak lines —
    // an arrow pointing the way water is flowing is about as unambiguous
    // as this can read at a glance. Each one starts out in open water,
    // slides inward over a short loop, and converges toward dead-center on
    // the mouth as it gets close, reinforcing the "pulled in" motion.
    const t = performance.now() / 1000;
    const maxDist = 26;
    const period = 0.9;
    const arrowDir = -mouthDir; // points toward the mouth, the direction water is flowing
    const rowOffsets = [-10, -5, 0, 5, 10];
    ctx.strokeStyle = "#eafcff";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    rowOffsets.forEach((dy, i) => {
      const phase = (((t + (i * period) / rowOffsets.length) % period) + period) % period;
      const distFrac = 1 - phase / period; // 1 = just spawned far out, 0 = reaching the mouth
      const x = mouthX + mouthDir * maxDist * distFrac;
      const y = midY + dy * distFrac;
      const size = 4 + 2 * distFrac; // shrinks slightly as it nears the mouth
      ctx.globalAlpha = 0.55 + 0.45 * distFrac;
      ctx.beginPath();
      ctx.moveTo(x - arrowDir * size * 0.5, y - size * 0.7);
      ctx.lineTo(x + arrowDir * size * 0.5, y);
      ctx.lineTo(x - arrowDir * size * 0.5, y + size * 0.7);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  const EDDY_OUTLINE = "#345a70";
  const EDDY_PALETTE = {
    W: "#dfeef5", // foam white
    B: "#6fa8c2", // water blue
    D: "#4a7d96", // dark water shading
  };
  const EDDY_SPRITE = [
    "..BBBBB..",
    ".BWWWWWB.",
    "BWWBBBWWB",
    "BWBDDDBWB",
    "BWBDWDBWB",
    "BWBDDDBWB",
    "BWWBBBWWB",
    ".BWWWWWB.",
    "..BBBBB..",
  ];

  // ---------------------------------------------------------------------
  // Bank vegetation / litter — decorative only, scrolls the banks. Each
  // level supplies a list of weighted "kinds"; level 3 supplies none
  // (bare industrial banks fits its theme).
  // ---------------------------------------------------------------------
  const BUSH_PIXEL = 2.4;
  const BUSH_OUTLINE = "#5c7a56";
  const BUSH_PALETTE = {
    B: "#99c38d", // base green — blended close to the bank color to sit in the background
    D: "#8db484", // shading
  };
  const BUSH_SPRITES = [
    [".B..B..B.", "BB.BBB.BB", ".BBBBBBB.", "BBBDBDBBB", "BBDBBBDBB", ".BBBBBBB."],
    ["..B.B.B..", ".BB.BBB..", ".BBBBBBB.", "BBBDBDBBB", "BBDBBBDBB", ".BBBBBBB."],
    ["...B.....", "..BBB.B..", ".BBBBBBB.", "BBBDBDBBB", "BBDBBBDBB", ".BBBBBBB."],
  ];

  const TREE_PIXEL = 2.5;
  const TREE_OUTLINE = "#657a5c";
  const TREE_PALETTE = {
    C: "#91bb89", // canopy — blended close to the bank color to sit in the background
    D: "#85ad7f", // canopy shading
    T: "#97885e", // trunk — desaturated, muted brown
  };
  const TREE_SPRITE = [
    "..C..C...",
    ".CCC.CCC.",
    "CCCCCCCCC",
    "CCCCCCCCC",
    "CCDCCCDCC",
    "CCCDCDCCC",
    ".CCCCCCC.",
    "..CCCCC..",
    "...TTT...",
    "...TTT...",
    "...TTT...",
    "..TTTTT..",
  ];

  const LITTER_PIXEL = 2.4;
  const BAG_OUTLINE = "#1a1a1c";
  const BAG_PALETTE = { K: "#3a3a3a", D: "#26262a", H: "#54545a" };
  const BAG_SPRITE = [
    "..K..K...",
    ".KK.KKK..",
    ".KKKKKKK.",
    "KKDKHKDKK",
    "KDKKKKKDK",
    ".KKKKKKK.",
  ];

  const BARREL_OUTLINE = "#4a2818";
  const BARREL_PALETTE = { R: "#a85a3a", D: "#7a3f26", H: "#c47850" };
  const BARREL_SPRITE = [
    ".RRRRRR.",
    "RDDDDDDR",
    "RHRRRRHR",
    "RRRRRRRR",
    "RDDDDDDR",
    "RHRRRRHR",
    "RRRRRRRR",
    "RDDDDDDR",
    ".RRRRRR.",
  ];

  // ---------------------------------------------------------------------
  // Set-piece pickups (one per level, replaces the level-1 crab)
  // ---------------------------------------------------------------------
  const CRAB_OUTLINE = "#8a4a30";
  const CRAB_PALETTE = { C: "#d97350", B: "#eb9a78", E: "#2a1a12", L: "#c96a45" };
  const CRAB_SPRITE = [
    "C.........C",
    ".C.......C.",
    "..BBBBBBB..",
    "L.BEBBBEB.L",
    ".LBBBBBBBL.",
    "..BBBBBBB..",
    ".LBBBBBBBL.",
    "...BBBBB...",
  ];

  const BOTTLE_OUTLINE = "#3a6b52";
  const BOTTLE_PALETTE = { G: "#8fc9a8", D: "#5a9c7c", C: "#e8f4ee" };
  const BOTTLE_SPRITE = [".CC.", ".GG.", "GGGG", "GDGG", "GGDG", "GGGG", ".GG."];

  const GLASS_EEL_OUTLINE = "#5a6650";
  const GLASS_EEL_PALETTE = { B: "#cfd8c0", D: "#a8b494", E: "#3a3a2a" };
  const GLASS_EEL_SPRITE = [".B.", "BEB", ".B.", ".D.", ".B.", ".D.", ".B."];

  // ---------------------------------------------------------------------
  // Levels — everything that varies level-to-level lives here. The game
  // loop below (state machine, scrolling, collision, the winding
  // set-piece channel, vegetation scroll/cull) is written once and reads
  // from `level`, the currently active entry.
  // ---------------------------------------------------------------------
  const LEVELS = [
    {
      id: 1,
      introTitle: "Level 1: The Open River",
      introBody: "A golden perch swims upstream through a regulated river.",
      fish: {
        sprite: PERCH_SPRITE,
        palette: PERCH_PALETTE,
        pixel: 2.4,
        outline: "#8a6a30",
        // Round-bodied fish don't flex like an eel — just a tail flick.
        // Rows 12-15 are the tail fin (see PERCH_SPRITE); the offset
        // tapers across them so it visibly attaches to the static body.
        wiggle: { fromRow: 12, amplitude: 2.2, speed: 5 },
      },
      theme: { bankColor: "#bfe3b4", waterColor: "#a9d8e6", waterLineColor: "rgba(255,255,255,0.4)" },
      vegetationKinds: [
        { sprites: BUSH_SPRITES, palette: BUSH_PALETTE, outline: BUSH_OUTLINE, pixel: BUSH_PIXEL, weight: 75 },
        { sprites: [TREE_SPRITE], palette: TREE_PALETTE, outline: TREE_OUTLINE, pixel: TREE_PIXEL, weight: 25 },
      ],
      obstacleTypes: [
        { type: "log", weight: 40, make: () => makeSolidObstacle("log", 28, 62, 12), draw: drawLog },
        { type: "weir", weight: 15, make: () => makeGapObstacle("weir", 0.52, 24), draw: drawWeir },
        {
          type: "bird",
          weight: 25,
          make: () => makeDrifterObstacle("bird", spriteDims(BIRD_SPRITE, 2.4).width, spriteDims(BIRD_SPRITE, 2.4).height),
          draw: (o) => drawSprite(BIRD_SPRITE, BIRD_PALETTE, o.x, o.y, 2.4, BIRD_OUTLINE),
        },
        {
          type: "turtle",
          weight: 20,
          make: () => makeFastObstacle("turtle", spriteDims(TURTLE_SPRITE, 2).width, spriteDims(TURTLE_SPRITE, 2).height, 1.6),
          draw: (o) => drawSprite(TURTLE_SPRITE, TURTLE_PALETTE, o.x, o.y, 2, TURTLE_OUTLINE),
        },
      ],
      setpiece: {
        name: "fish ladder",
        enterBanner: "Dam ahead — climb the fish ladder!",
        wallColor: "#d8d8d2",
        channelColor: "#a9d8e6",
        channelWidthFrac: 0.55,
        // A concrete dam wall drawn once at the very front of the
        // set-piece (see drawDamFace) so the fish ladder reads as a notch
        // cut through an actual barrier, not just a wandering channel.
        damFace: {
          color: "#9a9a92", // main concrete face
          darkColor: "#63635c", // pier/buttress shadow + notch frame
          crestColor: "#c8c8c0", // crest/roadway lip along the top (upstream) edge
          foamColor: "rgba(255,255,255,0.85)", // spillway water sheeting down the face
          turbulentColor: "rgba(255,255,255,0.8)", // churning whitewater at the base
          height: 56,
        },
        pickup: {
          sprite: CRAB_SPRITE,
          palette: CRAB_PALETTE,
          pixel: 2.2,
          outline: CRAB_OUTLINE,
          heal: 1,
          score: 20,
          introBanner: "Eat the crabs!",
        },
      },
    },
    {
      id: 2,
      introTitle: "Level 2: Human Trash",
      introBody: "A Murray cod picks its way through litter and pollution.",
      fish: {
        sprite: COD_SPRITE,
        palette: COD_PALETTE,
        pixel: 2.4,
        outline: "#3e4a29",
        // Same tail-only flick as the perch — rows 12-15 are the tail fin.
        wiggle: { fromRow: 12, amplitude: 2.2, speed: 5 },
      },
      theme: { bankColor: "#a8bf94", waterColor: "#8fada2", waterLineColor: "rgba(255,255,255,0.3)" },
      vegetationKinds: [
        { sprites: [BAG_SPRITE], palette: BAG_PALETTE, outline: BAG_OUTLINE, pixel: LITTER_PIXEL, weight: 65 },
        { sprites: [BARREL_SPRITE], palette: BARREL_PALETTE, outline: BARREL_OUTLINE, pixel: LITTER_PIXEL, weight: 35 },
      ],
      obstacleTypes: [
        { type: "tire", weight: 40, make: () => makeSolidObstacle("tire", 34, 34, 34), draw: drawTire },
        { type: "net", weight: 35, make: () => makeGapObstacle("net", 0.52, 20), draw: drawNet },
        {
          type: "wastePipe",
          weight: 25,
          make: () => makeDrifterObstacle("wastePipe", spriteDims(PLUME_SPRITE, 2.6).width, spriteDims(PLUME_SPRITE, 2.6).height),
          draw: (o) => drawSprite(PLUME_SPRITE, PLUME_PALETTE, o.x, o.y, 2.6, PLUME_OUTLINE),
        },
      ],
      setpiece: {
        name: "storm drain",
        wallColor: "#8a9088",
        channelColor: "#8fada2",
        channelWidthFrac: 0.5,
        // Same concrete-wall treatment as level 1's dam (see drawDamFace),
        // recolored grimier/greyer to read as a storm drain outfall wall
        // rather than a rural dam.
        damFace: {
          color: "#83887e",
          darkColor: "#52564c",
          crestColor: "#a3a898",
          foamColor: "rgba(213,221,206,0.85)",
          turbulentColor: "rgba(206,214,198,0.8)",
          height: 56,
        },
        pickup: {
          sprite: BOTTLE_SPRITE,
          palette: BOTTLE_PALETTE,
          pixel: 2.6,
          outline: BOTTLE_OUTLINE,
          heal: 1,
          score: 20,
          introBanner: "Recycle the bottles!",
        },
      },
    },
    {
      id: 3,
      introTitle: "Level 3: The Dam",
      introBody: "A longfin eel migrates downstream<br>past the turbines, at night.",
      fish: {
        sprite: EEL_SPRITE,
        palette: EEL_PALETTE,
        pixel: 2.6,
        outline: "#2a2515",
        // Anguilliform swimmer — the whole body S-curves smoothly (no
        // fromRow taper, and rowPhase staggers each row's phase down the
        // length of the body) rather than just the tail flicking.
        wiggle: { fromRow: 0, amplitude: 3, speed: 3.5, rowPhase: 0.5 },
      },
      theme: { bankColor: "#5a5f5c", waterColor: "#3d5a68", waterLineColor: "rgba(200,220,230,0.3)" },
      // Level 3's ending is the ocean rather than a floodplain (see
      // drawRiverScene's `endingColors` param) — an eel's real migration
      // ends at sea, not in a floodplain like the other two species.
      ending: { waterColor: "#182c40" },
      vegetationKinds: [],
      // The final river stretch (after the set-piece, before the ending
      // scene) runs 20s here instead of the usual 10s, giving the doubled
      // eddy weight below more room to actually show up.
      finalRiverDuration: 20,
      // Extra eddy spawns layered on *top* of the normal weighted pick
      // during the final river stretch — additive rather than a further
      // reweighting, so turbineGrate/irrigationPipe keep spawning exactly
      // as often as they do everywhere else in the level instead of being
      // crowded out. See updateObstacles(). Tuned to roughly double the
      // eddy count there on top of its existing finalSectionWeightMultiplier
      // share, per a difficulty-tuning request.
      finalSectionBonusObstacle: { type: "spillwayEddy", interval: 900 },
      obstacleTypes: [
        { type: "turbineGrate", weight: 40, make: () => makeSolidObstacle("turbineGrate", 28, 58, 14), draw: drawTurbineGrate },
        { type: "irrigationPipe", weight: 35, make: () => makeGapObstacle("irrigationPipe", 0.5, 22), draw: drawIrrigationPipe },
        {
          // 4x the original weight (was 25, same as turbineGrate's and
          // irrigationPipe's own unchanged weights) so a lot more of these
          // fast-moving hydraulic hazards come down the channel, without
          // reducing how often the other two show up. Doubled again on
          // top of that during the final river stretch (after the
          // set-piece exits), via finalSectionWeightMultiplier.
          type: "spillwayEddy",
          weight: 100,
          finalSectionWeightMultiplier: 2,
          make: () =>
            makeFastObstacle("spillwayEddy", spriteDims(EDDY_SPRITE, 2.4).width, spriteDims(EDDY_SPRITE, 2.4).height, 1.7),
          draw: (o) => drawSprite(EDDY_SPRITE, EDDY_PALETTE, o.x, o.y, 2.4, EDDY_OUTLINE),
        },
      ],
      setpiece: {
        name: "turbine bypass",
        wallColor: "#333c42",
        channelColor: "#3d5a68",
        channelWidthFrac: 0.45,
        // Same treatment as level 1's dam (see drawDamFace), recolored
        // dark industrial concrete to match the night/hydro theme.
        damFace: {
          color: "#4a5158",
          darkColor: "#282e33",
          crestColor: "#6b747c",
          foamColor: "rgba(220,235,245,0.85)",
          turbulentColor: "rgba(200,225,240,0.8)",
          height: 56,
        },
        pickup: {
          sprite: GLASS_EEL_SPRITE,
          palette: GLASS_EEL_PALETTE,
          pixel: 2.8,
          outline: GLASS_EEL_OUTLINE,
          heal: 1,
          score: 20,
          introBanner: "Join the glass eels!",
        },
      },
    },
  ];

  const FISH_SPEED = 150; // px/sec
  const FISH_Y = HEIGHT - 80;

  const BASE_SCROLL_SPEED = 80; // px/sec
  const MAX_SCROLL_SPEED = 260;
  const SCROLL_ACCEL = 2; // px/sec added per second survived

  const BASE_SPAWN_INTERVAL = 1200; // ms
  const MIN_SPAWN_INTERVAL = 550;

  const BEST_SCORE_KEY = "fishGameBestScore";

  // Health: a shared resource within a level (resets fresh at the start of
  // each level, but total score carries across all 3 — see LEVEL_COMPLETE
  // handling below). Normal obstacles and set-piece walls both damage it
  // rather than obstacles being an instant death.
  const MAX_HEALTH = 5;
  const HIT_COOLDOWN = 0.6; // seconds of invulnerability after taking damage
  const OBSTACLE_DAMAGE = 2;
  const SETPIECE_WALL_DAMAGE = 1;

  // Every level follows the same pacing: river, set-piece, river, ending.
  const SETPIECE_START_TIME = 10; // seconds survived
  const SETPIECE_DURATION = 10; // seconds
  const SETPIECE_WAVELENGTH = 300; // px of scroll distance per full S-curve
  const SETPIECE_STEP_SPACING = 90; // px between decorative flow-highlight lines

  // Level ends with the river opening into the ending scene: 10s river,
  // 10s set-piece, then a final river stretch (length varies per level —
  // see level.finalRiverDuration, default 10s) before the swim-in
  // transition. Recomputed by startLevel() since it's level-dependent.
  let LEVEL_END_TIME = 0;
  const FLOODPLAIN_FISH_COUNT = 7;
  // Bimodal rather than one continuous random range — a couple of clearly
  // large adults among a bunch of clearly small babies reads as "a family,"
  // where the old 0.7x-1.4x spread (everything closer to the same size)
  // didn't.
  const FLOODPLAIN_ADULT_COUNT = 2;
  const ENTER_FLOODPLAIN_DURATION = 2.5; // seconds — banks recede, fish glides to center

  const PICKUP_FIRST_SPAWN_DELAY = 2500; // ms — let the entry banner clear first
  const PICKUP_SPAWN_INTERVAL = 1800; // ms

  // Bank vegetation/litter is purely decorative — spawn interval is
  // randomized per-item (rather than a fixed cadence) so they dot the
  // banks sporadically instead of in a visible rhythm.
  const VEGETATION_MIN_INTERVAL = 250; // ms
  const VEGETATION_MAX_INTERVAL = 700; // ms

  let currentLevel = 1;
  let level = LEVELS[0];

  // Recomputed by startLevel() since fish size differs per species (the
  // eel is much longer than the perch/cod).
  let FISH_WIDTH = 0;
  let FISH_HEIGHT = 0;

  let state = "start"; // "start" | "playing" | "entering" | "gameover" | "levelcomplete" | "win"
  let fishX = WIDTH / 2;
  let moveLeft = false;
  let moveRight = false;

  let obstacles = [];
  let scrollSpeed = BASE_SCROLL_SPEED;
  let spawnTimer = 0;
  let bonusSpawnTimer = 0; // see level.finalSectionBonusObstacle
  let elapsed = 0; // seconds survived within the current level
  let score = 0; // current level's live score
  let totalScore = 0; // completed levels' accumulated score
  let bestScore = Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;

  let waterLineOffset = 0;

  let health = MAX_HEALTH;
  let hitCooldown = 0;

  let setpieceActive = false;
  let setpieceDistance = 0;
  // How far down the screen the set-piece channel has scrolled into view —
  // grows from 0 (nothing visible yet) to HEIGHT (fully entered) at
  // scrollSpeed, so the channel walls sweep down from the top like any
  // other obstacle instead of the whole screen switching over instantly.
  let setpieceRevealY = 0;
  // Mirror of setpieceRevealY for leaving the set-piece: grows from 0 to
  // HEIGHT once the duration ends, and the channel is drawn below this
  // line (river above it) so it recedes down and off screen instead of
  // the whole canvas reverting to open river in one frame.
  let setpieceExiting = false;
  let setpieceExitY = 0;
  let bannerTimer = 0;
  let bonusScore = 0;

  let pickups = [];
  let pickupSpawnTimer = 0;
  let pickupIntroShown = false;

  // Small "Health increased!" labels that pop up near a just-collected
  // pickup and float upward while fading out.
  let floatingTexts = [];
  const FLOATING_TEXT_DURATION = 1.1;
  const FLOATING_TEXT_RISE = 18; // px over the label's lifetime

  let floodplainFish = [];
  let enterTimer = 0;

  let vegetation = [];
  let vegetationSpawnTimer = 0;

  bestEl.textContent = `Best: ${bestScore}`;

  // Resolves `level`, recomputes level-dependent dims, and resets all
  // per-level run state. `n` is 1-based (matches the level id/HUD label).
  function startLevel(n) {
    currentLevel = n;
    level = LEVELS[n - 1];
    FISH_WIDTH = spriteDims(level.fish.sprite, level.fish.pixel).width;
    FISH_HEIGHT = spriteDims(level.fish.sprite, level.fish.pixel).height;
    LEVEL_END_TIME = SETPIECE_START_TIME + SETPIECE_DURATION + (level.finalRiverDuration || 10);

    fishX = WIDTH / 2;
    obstacles = [];
    scrollSpeed = BASE_SCROLL_SPEED;
    spawnTimer = 0;
    bonusSpawnTimer = 0;
    elapsed = 0;
    score = 0;
    waterLineOffset = 0;
    health = MAX_HEALTH; // fresh health each level
    hitCooldown = 0;
    setpieceActive = false;
    setpieceDistance = 0;
    setpieceRevealY = 0;
    setpieceExiting = false;
    setpieceExitY = 0;
    bannerTimer = 0;
    bonusScore = 0;
    pickups = [];
    pickupSpawnTimer = 0;
    pickupIntroShown = false;
    floatingTexts = [];
    floodplainFish = [];
    enterTimer = 0;
    scatterInitialVegetation();
    vegetationSpawnTimer = 0;

    bannerEl.classList.add("hidden");
    state = "playing";
    startScreenEl.classList.add("hidden");
    gameOverScreen.classList.add("hidden");
    levelCompleteScreen.classList.add("hidden");
    winScreenEl.classList.add("hidden");
    levelLabelEl.textContent = `Level ${n}`;
    updateHealthDisplay();
  }

  // Full restart: clears the accumulated total and begins at level 1.
  function resetGame() {
    totalScore = 0;
    startLevel(1);
  }

  // From the start screen only: shows level 1's intro card (same
  // level-complete-screen used between every other level) before gameplay
  // begins, instead of dropping straight into it. Setting currentLevel to
  // 0 lets showLevelCompleteScreen's existing "LEVELS[currentLevel]" /
  // "currentLevel + 1" lookups resolve to level 1 unchanged, and
  // continueToNextLevel's startLevel(currentLevel + 1) then correctly
  // starts level 1 when the player continues.
  function beginGame() {
    totalScore = 0;
    currentLevel = 0;
    startScreenEl.classList.add("hidden");
    showLevelCompleteScreen();
  }

  // Rejection-samples a position that doesn't overlap any fish already
  // placed — includes the bob animation's amplitude in the spacing so two
  // fish can't be nudged into touching as they bob up and down.
  function placeFloodplainFish(existing, isAdult) {
    const scale = isAdult ? 1.5 + Math.random() * 0.4 : 0.45 + Math.random() * 0.25;
    const halfW = (FISH_WIDTH * scale) / 2;
    const halfH = (FISH_HEIGHT * scale) / 2 + 4;
    let x, y;
    for (let attempt = 0; attempt < 40; attempt++) {
      x = 16 + Math.random() * (WIDTH - 32);
      y = 30 + Math.random() * (HEIGHT - 100);
      const tooClose = existing.some(
        (f) => Math.abs(f.x - x) < halfW + f.halfW + 6 && Math.abs(f.y - y) < halfH + f.halfH + 6
      );
      if (!tooClose) break;
    }
    return { x, y, halfW, halfH, phase: Math.random() * Math.PI * 2, scale };
  }

  // The channel opens up and the fish glides to a stop among a school of
  // its own species before the level's ending screen appears — every
  // level ends this way now (see updateEntering()/draw()), not just the
  // final one. What the school gathers in differs only by water color:
  // a floodplain for levels 1-2, the ocean for level 3 (see `level.ending`
  // and drawRiverScene's `endingColors` param).
  function enterEndingScene() {
    state = "entering";
    enterTimer = 0;
    obstacles = [];
    pickups = [];
    vegetation = [];
    floodplainFish = [];
    for (let i = 0; i < FLOODPLAIN_FISH_COUNT; i++) {
      floodplainFish.push(placeFloodplainFish(floodplainFish, i < FLOODPLAIN_ADULT_COUNT));
    }
  }

  function showLevelCompleteScreen() {
    state = "levelcomplete";
    const next = LEVELS[currentLevel]; // 0-based lookup for currentLevel+1
    levelCompleteTitleEl.textContent = next.introTitle;
    // innerHTML (not textContent) so introBody's <br> — used to force a
    // two-line break for the longer level-3 sentence — actually renders
    // as a line break. Safe here since introBody is our own hardcoded
    // config text, never user input.
    levelCompleteBodyEl.innerHTML = next.introBody;
    continueButton.textContent = `Continue to Level ${currentLevel + 1}`;
    levelCompleteScreen.classList.remove("hidden");
  }

  function continueToNextLevel() {
    startLevel(currentLevel + 1);
  }

  function winGame() {
    state = "win";
    if (totalScore > bestScore) {
      bestScore = totalScore;
      localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
      bestEl.textContent = `Best: ${bestScore}`;
    }
    winScoreEl.textContent = `Score: ${totalScore}`;
    winScreenEl.classList.remove("hidden");
  }

  function updateHealthDisplay() {
    const pct = Math.max(0, (health / MAX_HEALTH) * 100);
    healthBarFillEl.style.width = `${pct}%`;
    healthBarFillEl.style.background =
      health >= 4 ? "#9ecfa0" : health >= 2 ? "#f0d78c" : "#e2726f";
  }

  function takeDamage(amount) {
    health -= amount;
    hitCooldown = HIT_COOLDOWN;
    updateHealthDisplay();
    if (health <= 0) endGame();
  }

  function showBanner(text, duration) {
    bannerEl.textContent = text;
    bannerEl.classList.remove("hidden");
    bannerTimer = duration;
  }

  // `finalSection` is true once the level's final river stretch (after the
  // set-piece has fully exited) begins — some obstacle types boost their
  // weight there via `finalSectionWeightMultiplier` (e.g. level 3's
  // spillwayEddy) without changing how often they show up earlier in the
  // level.
  function pickObstacleType(finalSection) {
    const types = level.obstacleTypes;
    const weights = types.map(
      (o) => o.weight * (finalSection && o.finalSectionWeightMultiplier ? o.finalSectionWeightMultiplier : 1)
    );
    const total = weights.reduce((sum, w) => sum + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < types.length; i++) {
      if (r < weights[i]) return types[i];
      r -= weights[i];
    }
    return types[0];
  }

  function spawnObstacle(finalSection) {
    obstacles.push(pickObstacleType(finalSection).make());
  }

  // ---------------------------------------------------------------------
  // Bank vegetation/litter scrolls alongside obstacles but never enters
  // the river, so it doesn't need collision handling — just spawn, move
  // down, and cull off-screen, independent of whether the set-piece is
  // active. `y` defaults to just above the screen (the normal spawn
  // point); passing it explicitly lets scatterInitialVegetation() place
  // items already in view.
  // ---------------------------------------------------------------------
  function pickVegetationKind() {
    const kinds = level.vegetationKinds;
    if (kinds.length === 0) return null;
    const total = kinds.reduce((sum, k) => sum + k.weight, 0);
    let r = Math.random() * total;
    for (const k of kinds) {
      if (r < k.weight) return k;
      r -= k.weight;
    }
    return kinds[0];
  }

  function spawnVegetation(y) {
    const kind = pickVegetationKind();
    if (!kind) return;
    const sprite = kind.sprites[Math.floor(Math.random() * kind.sprites.length)];
    const dims = spriteDims(sprite, kind.pixel);
    const onLeftBank = Math.random() < 0.5;
    const margin = BANK_WIDTH - dims.width;
    const x = onLeftBank ? Math.random() * margin : WIDTH - BANK_WIDTH + Math.random() * margin;
    vegetation.push({
      kind,
      sprite,
      x,
      y: y === undefined ? -dims.height : y,
      width: dims.width,
      height: dims.height,
    });
  }

  // Pre-populates the banks so they aren't bare on the start screen or
  // right after a level begins — otherwise vegetation would only appear
  // once it's had time to organically scroll in from above.
  function scatterInitialVegetation() {
    vegetation = [];
    if (level.vegetationKinds.length === 0) return;
    let y = 10;
    while (y < HEIGHT) {
      if (Math.random() < 0.75) spawnVegetation(y);
      y += 25 + Math.random() * 45;
    }
  }

  function updateVegetation(dt) {
    if (level.vegetationKinds.length === 0) return;
    vegetationSpawnTimer -= dt * 1000;
    if (vegetationSpawnTimer <= 0) {
      spawnVegetation();
      if (Math.random() < 0.5) spawnVegetation(); // roughly 50% more density
      vegetationSpawnTimer =
        VEGETATION_MIN_INTERVAL + Math.random() * (VEGETATION_MAX_INTERVAL - VEGETATION_MIN_INTERVAL);
    }

    for (const v of vegetation) {
      v.y += scrollSpeed * dt;
    }
    vegetation = vegetation.filter((v) => v.y < HEIGHT + v.height);
  }

  function updateFloatingTexts(dt) {
    for (const f of floatingTexts) f.age += dt;
    floatingTexts = floatingTexts.filter((f) => f.age < FLOATING_TEXT_DURATION);
  }

  // A DOM popup (see .score-popup in style.css) next to the score HUD
  // text — the running total already ticks up every frame from elapsed
  // time, so a pickup's score bump is easy to miss in there; this makes
  // that specific moment obvious. Appended as a sibling in #hud (via
  // scoreEl.parentElement), positioned using scoreEl's own offset, rather
  // than as a child of scoreEl itself — scoreEl.textContent is overwritten
  // every frame (see update()), which would silently delete a child
  // element the instant it's added. `el.remove()` on animationend rather
  // than a timer, so it can't drift out of sync with the CSS duration.
  function showScorePopup(amount) {
    const el = document.createElement("span");
    el.className = "score-popup";
    el.textContent = `+${amount}`;
    el.style.left = `${scoreEl.offsetLeft + scoreEl.offsetWidth + 6}px`;
    el.style.top = `${scoreEl.offsetTop}px`;
    el.addEventListener("animationend", () => el.remove());
    scoreEl.parentElement.appendChild(el);
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  // `allowSpawn` is false while the set-piece is active: existing
  // obstacles still need to keep moving/colliding/culling so they scroll
  // off screen naturally instead of vanishing the instant it starts, but
  // no new ones should spawn while it's active.
  function updateObstacles(dt, allowSpawn, finalSection) {
    if (allowSpawn !== false) {
      spawnTimer -= dt * 1000;
      if (spawnTimer <= 0) {
        spawnObstacle(finalSection);
        const interval = Math.max(MIN_SPAWN_INTERVAL, BASE_SPAWN_INTERVAL - elapsed * 15);
        spawnTimer = interval;
      }

      // An extra, independent spawn stream layered on top of the normal
      // weighted pick above (not a substitute for it) — see
      // level.finalSectionBonusObstacle. Boosting an obstacle's share of
      // the weighted pick necessarily crowds out the others, since only
      // one type spawns per normal tick; spawning this one on its own
      // separate timer instead adds more of it without touching how often
      // anything else spawns.
      const bonus = level.finalSectionBonusObstacle;
      if (finalSection && bonus) {
        bonusSpawnTimer -= dt * 1000;
        if (bonusSpawnTimer <= 0) {
          const bonusType = level.obstacleTypes.find((o) => o.type === bonus.type);
          obstacles.push(bonusType.make());
          bonusSpawnTimer = bonus.interval;
        }
      }
    }

    for (const o of obstacles) {
      const speedMult = o.speedMult || 1;
      o.y += scrollSpeed * speedMult * dt;
      if (o.drifts) {
        o.phase += dt * 2.2;
        o.x = Math.max(RIVER_LEFT, Math.min(RIVER_RIGHT - o.width, o.baseX + Math.sin(o.phase) * 40));
      }
    }
    obstacles = obstacles.filter((o) => o.y < HEIGHT + o.height);

    // Collision check (small inset for a fairer hitbox than the sprite art)
    const fishRect = {
      x: fishX - FISH_WIDTH / 2 + 2,
      y: FISH_Y - FISH_HEIGHT / 2 + 2,
      width: FISH_WIDTH - 4,
      height: FISH_HEIGHT - 4,
    };
    if (hitCooldown <= 0) {
      for (const o of obstacles) {
        if (rectsOverlap(fishRect, o)) {
          takeDamage(OBSTACLE_DAMAGE);
          break;
        }
      }
    }
  }

  // Center-x of the set-piece's winding channel at a given "world"
  // position (distance already scrolled minus the canvas row). Phase is
  // shifted so the channel starts centered under wherever the fish
  // already is, for a smooth hand-off from the open river.
  function setpieceChannelCenter(worldPos) {
    const phase = ((worldPos + FISH_Y) / SETPIECE_WAVELENGTH) * Math.PI * 2;
    const amplitude = (RIVER_WIDTH - RIVER_WIDTH * level.setpiece.channelWidthFrac) / 2;
    return WIDTH / 2 + Math.sin(phase) * amplitude;
  }

  // Pickups spawn within the channel's safe inner span at their spawn
  // row, so they're reachable when they scroll down (the channel may have
  // curved by the time they reach the fish, same as any other obstacle).
  function spawnPickup() {
    const pickup = level.setpiece.pickup;
    const dims = spriteDims(pickup.sprite, pickup.pixel);
    const channelWidth = RIVER_WIDTH * level.setpiece.channelWidthFrac;
    const spawnWorldPos = setpieceDistance + dims.height;
    const channelCenter = setpieceChannelCenter(spawnWorldPos);
    const halfInner = Math.max(0, channelWidth / 2 - dims.width / 2 - 4);
    const centerX = channelCenter + (Math.random() * 2 - 1) * halfInner;
    pickups.push({
      x: centerX - dims.width / 2,
      y: -dims.height,
      width: dims.width,
      height: dims.height,
    });
    if (!pickupIntroShown) {
      pickupIntroShown = true;
      showBanner(pickup.introBanner, 2);
    }
  }

  function updateSetpiece(dt) {
    setpieceDistance += scrollSpeed * dt;
    setpieceRevealY = Math.min(HEIGHT, setpieceRevealY + scrollSpeed * dt);
    if (setpieceExiting) {
      setpieceExitY = Math.min(HEIGHT, setpieceExitY + scrollSpeed * dt);
    }

    // Spawn pickups — stops once exiting, since updateSetpiece (and with
    // it this whole pickup lifecycle) stops being called once
    // setpieceActive goes false, so anything spawned too late would never
    // move or get cleaned up again.
    if (!setpieceExiting) {
      pickupSpawnTimer -= dt * 1000;
      if (pickupSpawnTimer <= 0) {
        spawnPickup();
        pickupSpawnTimer = PICKUP_SPAWN_INTERVAL;
      }
    }

    const fishRect = {
      x: fishX - FISH_WIDTH / 2 + 2,
      y: FISH_Y - FISH_HEIGHT / 2 + 2,
      width: FISH_WIDTH - 4,
      height: FISH_HEIGHT - 4,
    };

    // Move pickups, collect on contact (heals + scores instead of damaging)
    for (const p of pickups) {
      p.y += scrollSpeed * dt;
    }
    pickups = pickups.filter((p) => {
      if (rectsOverlap(fishRect, p)) {
        health = Math.min(MAX_HEALTH, health + level.setpiece.pickup.heal);
        bonusScore += level.setpiece.pickup.score;
        updateHealthDisplay();
        floatingTexts.push({ x: p.x + p.width, y: p.y, text: "+ health", age: 0 });
        showScorePopup(level.setpiece.pickup.score);
        return false;
      }
      return p.y < HEIGHT + p.height;
    });

    // Wall collision (damage) — gated to match what's actually drawn at
    // the fish's row: not yet active while the channel is still sweeping
    // in from the top (entering), and no longer active once it's swept
    // past the fish on the way out (exiting).
    const channelWidth = RIVER_WIDTH * level.setpiece.channelWidthFrac;
    const fishWorldPos = setpieceDistance - FISH_Y;
    const center = setpieceChannelCenter(fishWorldPos);
    const wallLeft = center - channelWidth / 2;
    const wallRight = center + channelWidth / 2;
    const wallVisibleAtFish = setpieceRevealY >= FISH_Y && (!setpieceExiting || setpieceExitY <= FISH_Y);

    if (
      wallVisibleAtFish &&
      (fishRect.x < wallLeft || fishRect.x + fishRect.width > wallRight) &&
      hitCooldown <= 0
    ) {
      takeDamage(SETPIECE_WALL_DAMAGE);
    }
  }

  // Banks recede, the fish eases to center and the river current slows to
  // a stop, then the ending appears — run during the "entering" state.
  function updateEntering(dt) {
    enterTimer += dt;
    const t = Math.min(1, enterTimer / ENTER_FLOODPLAIN_DURATION);
    fishX += (WIDTH / 2 - fishX) * Math.min(1, dt * 3);
    scrollSpeed = BASE_SCROLL_SPEED * (1 - t);
    waterLineOffset = (waterLineOffset + scrollSpeed * dt) % 24;
    if (t >= 1) {
      // Fold this level's score into the running total exactly once, here
      // — not in winGame()/showLevelCompleteScreen(), which would double
      // it if it were also added back when this level started.
      totalScore += score;
      if (currentLevel < LEVELS.length) {
        showLevelCompleteScreen();
      } else {
        winGame();
      }
    }
  }

  function update(dt) {
    if (state === "entering") {
      updateEntering(dt);
      return;
    }
    if (state !== "playing") return;

    // Movement
    if (moveLeft) fishX -= FISH_SPEED * dt;
    if (moveRight) fishX += FISH_SPEED * dt;
    fishX = Math.max(RIVER_LEFT + FISH_WIDTH / 2, Math.min(RIVER_RIGHT - FISH_WIDTH / 2, fishX));

    // Difficulty ramp
    elapsed += dt;
    scrollSpeed = Math.min(MAX_SCROLL_SPEED, BASE_SCROLL_SPEED + elapsed * SCROLL_ACCEL);

    // Water scroll animation
    waterLineOffset = (waterLineOffset + scrollSpeed * dt) % 24;

    // Runs during both the open river and the set-piece — banks are
    // visible (and the same width) in both.
    updateVegetation(dt);
    updateFloatingTexts(dt);

    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) bannerEl.classList.add("hidden");
    }

    if (hitCooldown > 0) hitCooldown -= dt;

    // Reached the end of this level — every level ends with the school
    // swim-in scene (see enterEndingScene()), not just the last one.
    if (elapsed >= LEVEL_END_TIME) {
      score = Math.floor(elapsed * 10) + bonusScore;
      scoreEl.textContent = `Score: ${totalScore + score}`;
      enterEndingScene();
      return;
    }

    // Enter/exit the set-piece section. Exiting is a mirror of entering:
    // setpieceActive stays true (and updateSetpiece keeps running)
    // throughout the exit sweep so the channel keeps scrolling and
    // colliding until it has actually receded past the fish, rather than
    // vanishing the instant the duration ends.
    if (!setpieceActive && elapsed >= SETPIECE_START_TIME && elapsed < SETPIECE_START_TIME + SETPIECE_DURATION) {
      setpieceActive = true;
      setpieceDistance = 0;
      setpieceRevealY = 0;
      // Existing obstacles are left alone (see updateObstacles'
      // allowSpawn param below) so they keep scrolling down and off
      // screen naturally instead of disappearing the instant it starts.
      pickups = [];
      pickupSpawnTimer = PICKUP_FIRST_SPAWN_DELAY;
      pickupIntroShown = false;
      updateHealthDisplay();
      if (level.setpiece.enterBanner) showBanner(level.setpiece.enterBanner, 2.2);
    } else if (setpieceActive && !setpieceExiting && elapsed >= SETPIECE_START_TIME + SETPIECE_DURATION) {
      setpieceExiting = true;
      setpieceExitY = 0;
      // Existing pickups are left alone (updateSetpiece keeps moving,
      // collecting, and culling them as normal during the exit sweep) so
      // ones still mid-screen scroll off naturally instead of vanishing
      // the instant the exit sweep starts — same fix as the obstacles.
      spawnTimer = 400;
    }

    if (setpieceActive) {
      updateSetpiece(dt);
      updateObstacles(dt, false);
      if (setpieceExiting && setpieceExitY >= HEIGHT) {
        setpieceActive = false;
        setpieceExiting = false;
        // Safety net: nothing moves or removes pickups once updateSetpiece
        // stops running, so any pickup still mid-screen at this exact
        // moment would otherwise be stuck on screen forever.
        pickups = [];
      }
    } else {
      // Final river section = the open river after the set-piece has
      // fully exited (elapsed already past SETPIECE_START_TIME +
      // SETPIECE_DURATION at that point, since setpieceActive only stays
      // true up to and through the exit sweep).
      updateObstacles(dt, true, elapsed >= SETPIECE_START_TIME + SETPIECE_DURATION);
    }

    // Score = distance survived + bonuses (e.g. eaten pickups)
    score = Math.floor(elapsed * 10) + bonusScore;
    scoreEl.textContent = `Score: ${totalScore + score}`;
  }

  function endGame() {
    state = "gameover";
    const finalTotal = totalScore + score;
    if (finalTotal > bestScore) {
      bestScore = finalTotal;
      localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
      bestEl.textContent = `Best: ${bestScore}`;
    }
    finalScoreEl.textContent = `Score: ${finalTotal}`;
    gameOverScreen.classList.remove("hidden");
  }

  // Draws the water scene with banks at the given width — used for the
  // normal river (bankWidth = BANK_WIDTH), the swim-in transition
  // (bankWidth easing toward 0), and the open ending scene (bankWidth =
  // 0). `endingColors`, when true, swaps in `level.ending`'s water color
  // if the level has one (only level 3 does — an eel's migration ends at
  // the ocean, not a floodplain like the other two species).
  function drawRiverScene(bankWidth, endingColors) {
    const left = bankWidth;
    const right = WIDTH - bankWidth;
    const width = right - left;
    const waterColor = endingColors && level.ending ? level.ending.waterColor : level.theme.waterColor;

    ctx.fillStyle = level.theme.bankColor;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = waterColor;
    ctx.fillRect(left, 0, width, HEIGHT);

    ctx.strokeStyle = level.theme.waterLineColor;
    ctx.lineWidth = 2;
    for (let y = -24 + waterLineOffset; y < HEIGHT; y += 24) {
      ctx.beginPath();
      ctx.moveTo(left + 6, y);
      ctx.lineTo(left + 16, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(right - 16, y + 12);
      ctx.lineTo(right - 6, y + 12);
      ctx.stroke();
    }
  }

  // Uses the wall clock (not `elapsed`) so fish keep bobbing even though
  // `elapsed`/`update()` are frozen once the run reaches the win state.
  // `alpha` fades the school in as the floodplain opens up.
  function drawFloodplainFish(alpha) {
    const nowSeconds = performance.now() / 1000;
    ctx.globalAlpha = alpha;
    for (const fish of floodplainFish) {
      const bob = Math.sin((nowSeconds + fish.phase) * 1.5) * 4;
      const w = FISH_WIDTH * fish.scale;
      const h = FISH_HEIGHT * fish.scale;
      drawSprite(
        level.fish.sprite,
        level.fish.palette,
        fish.x - w / 2,
        fish.y - h / 2 + bob,
        level.fish.pixel * fish.scale,
        level.fish.outline
      );
    }
    ctx.globalAlpha = 1;
  }

  // Only draws the [fromY, toY) band (defaults to the full canvas) so the
  // caller can overlay this on top of the normal river scene: entering
  // draws [0, setpieceRevealY) so the channel scrolls in from the top, and
  // exiting draws [setpieceExitY, HEIGHT) so it recedes off the bottom
  // instead of the whole screen switching over in one frame either way.
  function drawSetpieceChannel(fromY, toY) {
    const from = fromY === undefined ? 0 : fromY;
    const to = toY === undefined ? HEIGHT : toY;
    const channelWidth = RIVER_WIDTH * level.setpiece.channelWidthFrac;
    ctx.fillStyle = level.theme.bankColor;
    ctx.fillRect(0, from, WIDTH, to - from);

    const step = 2;
    for (let y = from; y < to; y += step) {
      const worldPos = setpieceDistance - y;
      const center = setpieceChannelCenter(worldPos);
      const left = center - channelWidth / 2;
      const right = center + channelWidth / 2;

      ctx.fillStyle = level.setpiece.wallColor;
      ctx.fillRect(RIVER_LEFT, y, RIVER_WIDTH, step);

      ctx.fillStyle = level.setpiece.channelColor;
      ctx.fillRect(left, y, right - left, step);

      // Decorative flow-highlight lines — not solid, just visual rhythm
      const stepPhase = ((worldPos % SETPIECE_STEP_SPACING) + SETPIECE_STEP_SPACING) % SETPIECE_STEP_SPACING;
      if (stepPhase < step) {
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fillRect(left, y, right - left, step);
      }
    }
  }

  // Draws a one-off concrete dam wall spanning the full river, with a
  // notch cut out over the fish-ladder channel's current position — the
  // barrier the ladder exists to bypass. `bottomY` is a *world*-anchored
  // position (worldPos = setpieceDistance - y, same convention as
  // drawSetpieceChannel/setpieceChannelCenter): passing setpieceDistance
  // itself pins the wall to the moment the set-piece began, so it scrolls
  // down into view once at the very front of the channel and then off the
  // bottom for good, exactly like any other obstacle, rather than being
  // tied to the reveal-sweep animation (which freezes once fully swept in
  // and would otherwise leave the wall stuck on screen).
  //
  // The world scrolls from top (upstream, not yet reached) to bottom
  // (downstream, already passed) as the fish swims "upstream" in place, so
  // `top` is the crest (the upstream lip water pours over) and `bottomY`
  // is the base — the downstream face the fish actually meets first,
  // where the spillway plunges into a turbulent pool. Texture is laid out
  // to match: a crest lip at `top`, cascading flow streaks strengthening
  // toward the base, and churning whitewater right at `bottomY`.
  //
  // The notch uses one fixed, straight-sided position for the whole band
  // (evaluated at the base, where it hands off to the channel below) rather
  // than following the channel's curve row by row — real spillway gates
  // are straight rectangular openings, and letting a tall band track a
  // fast-curving sine wave turned it into a diagonal wedge instead of a
  // wall. It only needs to line up at the seam where the two meet.
  function drawDamFace(bottomY) {
    const damFace = level.setpiece.damFace;
    if (!damFace) return;
    const top = bottomY - damFace.height;
    // "A fish length" of turbulent plunge-pool water trails downstream of
    // the base, per the request to give the whitewater more presence in
    // front of the wall rather than a thin line hugging its foot.
    const tailLength = FISH_HEIGHT;
    if (top > HEIGHT || bottomY + tailLength < 0) return;

    const channelWidth = RIVER_WIDTH * level.setpiece.channelWidthFrac;
    const center = setpieceChannelCenter(setpieceDistance - bottomY);
    const gapLeft = center - channelWidth / 2;
    const gapRight = center + channelWidth / 2;

    const step = 2;
    const t = performance.now() / 1000;
    const pierSpacing = 12;
    const fallSpeed = 34; // px/sec the spillway streaks fall down the face
    const dashPeriod = 10;

    const from = Math.max(0, top);
    const to = Math.min(HEIGHT, bottomY);
    for (let y = from; y < to; y += step) {
      const rowT = (y - top) / damFace.height; // 0 at the crest, 1 at the base

      ctx.fillStyle = damFace.color;
      ctx.fillRect(RIVER_LEFT, y, gapLeft - RIVER_LEFT, step);
      ctx.fillRect(gapRight, y, RIVER_RIGHT - gapRight, step);

      // Pier/buttress shadow columns, skipped over the ladder notch
      ctx.fillStyle = damFace.darkColor;
      for (let bx = RIVER_LEFT + 4; bx < gapLeft; bx += pierSpacing) {
        ctx.fillRect(bx, y, 3, step);
      }
      for (let bx = Math.ceil((gapRight + 4) / pierSpacing) * pierSpacing; bx < RIVER_RIGHT; bx += pierSpacing) {
        ctx.fillRect(bx, y, 3, step);
      }

      // Spillway water sheeting straight down the face — dash streaks that
      // fall based only on y and wall-clock time (each column keeps a
      // fixed, purely spatial phase offset rather than one that also
      // shifts with time), so they read as falling water, not a diagonal
      // noise field whose interference pattern could appear to drift
      // sideways or even upward.
      if (rowT > 0.12) {
        const dashLen = 2 + rowT * 5; // longer/denser streaks toward the base
        ctx.fillStyle = damFace.foamColor;
        for (let bx = RIVER_LEFT + 2; bx < gapLeft - 1; bx += 4) {
          const colPhase = (bx * 7) % dashPeriod;
          const cycle = (((y - top - colPhase) - t * fallSpeed) % dashPeriod + dashPeriod) % dashPeriod;
          if (cycle < dashLen) ctx.fillRect(bx, y, 2, step);
        }
        for (let bx = gapRight + 2; bx < RIVER_RIGHT - 1; bx += 4) {
          const colPhase = (bx * 7) % dashPeriod;
          const cycle = (((y - top - colPhase) - t * fallSpeed) % dashPeriod + dashPeriod) % dashPeriod;
          if (cycle < dashLen) ctx.fillRect(bx, y, 2, step);
        }
      }

      // Darker frame at the notch mouth so it reads as an opening cut into
      // the wall rather than a random gap between two fills
      ctx.fillStyle = damFace.darkColor;
      ctx.fillRect(Math.max(RIVER_LEFT, gapLeft - 2), y, 2, step);
      ctx.fillRect(Math.min(RIVER_RIGHT - 2, gapRight), y, 2, step);
    }

    // Crest/roadway lip along the top (upstream) edge
    if (top >= 0 && top < HEIGHT) {
      ctx.fillStyle = damFace.crestColor;
      ctx.fillRect(RIVER_LEFT, top, RIVER_WIDTH, 3);
    }

    // Churning whitewater plunge pool trailing downstream of the base for
    // about a fish-length, on either side of the calmer ladder notch —
    // stays chaotic/multi-directional (unlike the directed spillway
    // streaks above) since real turbulence has no consistent flow
    // direction, fading out with distance from the wall.
    const turbFrom = Math.max(0, bottomY - 4);
    const turbTo = Math.min(HEIGHT, bottomY + tailLength);
    ctx.fillStyle = damFace.turbulentColor;
    for (let ty = turbFrom; ty < turbTo; ty += 3) {
      const distT = Math.min(1, Math.max(0, (ty - bottomY) / tailLength));
      const threshold = 0.05 + distT * 0.95; // dense at the wall, fades to nothing a fish-length out
      for (let bx = RIVER_LEFT + 1; bx < gapLeft - 1; bx += 3) {
        const noise = Math.sin(bx * 1.3 + t * 9 + ty * 0.8) * Math.cos(ty * 1.1 - t * 7);
        if (noise > threshold) ctx.fillRect(bx, ty, 3, 3);
      }
      for (let bx = gapRight + 1; bx < RIVER_RIGHT - 1; bx += 3) {
        const noise = Math.sin(bx * 1.3 + t * 9 + ty * 0.8) * Math.cos(ty * 1.1 - t * 7);
        if (noise > threshold) ctx.fillRect(bx, ty, 3, 3);
      }
    }
  }

  function drawObstacles() {
    const drawers = level.obstacleDrawers;
    for (const o of obstacles) {
      drawers[o.type](o);
    }
  }

  function drawPickups() {
    const pickup = level.setpiece.pickup;
    for (const p of pickups) {
      drawSprite(pickup.sprite, pickup.palette, p.x, p.y, pickup.pixel, pickup.outline);
    }
  }

  function drawVegetation() {
    for (const v of vegetation) {
      drawSprite(v.sprite, v.kind.palette, v.x, v.y, v.kind.pixel, v.kind.outline);
    }
  }

  // Draws a swimming wiggle as a single drawSprite call with a per-row x
  // offset, rather than splitting the sprite into separately-drawn chunks
  // — splitting broke the outline's connectivity check at each chunk
  // boundary (it only looks for neighbors within the rows it was given),
  // which left a visible seam/gap even at rest, making the tail look
  // detached from the body. A single call keeps the outline correct
  // against the sprite's real shape while still letting rows move.
  //
  // Rows above `fromRow` don't move at all; rows from `fromRow` down
  // taper from 0 offset (right where they meet the static body) up to
  // full `amplitude` at the last row, so the motion blends in instead of
  // jumping. The eel (`fromRow: 0`, no taper) S-curves its whole body;
  // the perch/cod (round-bodied fish that don't flex like an eel) only
  // flick their tail fin, tapered so it reads as attached.
  function drawSwimmingFish(x, y) {
    const rows = level.fish.sprite;
    const pixelSize = level.fish.pixel;
    const { fromRow = 0, amplitude, speed, rowPhase = 0 } = level.fish.wiggle;
    const t = performance.now() / 1000;
    const taperLength = rows.length - fromRow;

    const offsetFn = (row) => {
      if (row < fromRow) return 0;
      const taper = fromRow > 0 ? (row - fromRow + 1) / taperLength : 1;
      return amplitude * taper * Math.sin(row * rowPhase + t * speed);
    };

    drawSprite(rows, level.fish.palette, x, y, pixelSize, level.fish.outline, undefined, offsetFn);
  }

  // Tiny 3x5 pixel font (uppercase only — lookups upper-case the char) for
  // in-canvas popup labels. Drawn with fillRect on rounded coordinates
  // instead of ctx.fillText, so it stays crisp under the game's
  // "image-rendering: pixelated" scaling rather than looking blurry like
  // anti-aliased canvas text does once blown up.
  const PIXEL_FONT = {
    "+": ["...", ".#.", "###", ".#.", "..."],
    " ": ["...", "...", "...", "...", "..."],
    H: ["#.#", "#.#", "###", "#.#", "#.#"],
    E: ["###", "#..", "##.", "#..", "###"],
    A: [".#.", "#.#", "###", "#.#", "#.#"],
    L: ["#..", "#..", "#..", "#..", "###"],
    T: ["###", ".#.", ".#.", ".#.", ".#."],
  };
  const PIXEL_FONT_COLS = 3;
  const PIXEL_FONT_ROWS = 5;

  function pixelTextWidth(text, pixelSize) {
    return text.length * PIXEL_FONT_COLS * pixelSize + (text.length - 1) * pixelSize;
  }

  // (x, y) is the top-left corner.
  function drawPixelText(text, x, y, pixelSize, color) {
    x = Math.round(x);
    y = Math.round(y);
    ctx.fillStyle = color;
    let cx = x;
    for (const ch of text) {
      const glyph = PIXEL_FONT[ch.toUpperCase()];
      if (glyph) {
        for (let row = 0; row < PIXEL_FONT_ROWS; row++) {
          for (let col = 0; col < PIXEL_FONT_COLS; col++) {
            if (glyph[row][col] === "#") {
              ctx.fillRect(cx + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
            }
          }
        }
      }
      cx += PIXEL_FONT_COLS * pixelSize + pixelSize;
    }
  }

  // Floats each label upward and fades it out over its short lifetime. A
  // solid backing tag keeps it legible over any background color.
  function drawFloatingTexts() {
    const pixelSize = 1;
    for (const f of floatingTexts) {
      const t = f.age / FLOATING_TEXT_DURATION;
      const alpha = 1 - t;
      const y = f.y - FLOATING_TEXT_RISE * t;
      const textW = pixelTextWidth(f.text, pixelSize);
      const textH = PIXEL_FONT_ROWS * pixelSize;
      const pad = 2;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "rgba(20, 30, 20, 0.75)";
      ctx.fillRect(Math.round(f.x - pad), Math.round(y - pad), textW + pad * 2, textH + pad * 2);
      drawPixelText(f.text, f.x, y, pixelSize, "#9ef07a");
      ctx.restore();
    }
  }

  function drawFish() {
    // Flicker while invulnerable after taking a hit, so a hit is felt
    if (hitCooldown > 0 && Math.floor(hitCooldown * 10) % 2 === 0) return;
    const x = fishX - FISH_WIDTH / 2;
    const y = FISH_Y - FISH_HEIGHT / 2;
    if (level.fish.wiggle) {
      drawSwimmingFish(x, y);
    } else {
      drawSprite(level.fish.sprite, level.fish.palette, x, y, level.fish.pixel, level.fish.outline);
    }
  }

  function draw() {
    if (state === "entering") {
      const t = Math.min(1, enterTimer / ENTER_FLOODPLAIN_DURATION);
      drawRiverScene(BANK_WIDTH * (1 - t), true);
      drawFloodplainFish(t);
    } else if (state === "win") {
      drawRiverScene(0, true);
      drawFloodplainFish(1);
    } else if (setpieceActive) {
      // River scene stays as the base layer, with the channel overlaid on
      // whichever band is currently revealed — scrolling in from the top
      // while entering, or receding off the bottom while exiting.
      drawRiverScene(BANK_WIDTH);
      if (setpieceExiting) {
        drawSetpieceChannel(setpieceExitY, HEIGHT);
      } else {
        drawSetpieceChannel(0, setpieceRevealY);
      }
      drawDamFace(setpieceDistance);
    } else {
      drawRiverScene(BANK_WIDTH);
    }

    if (state !== "win" && state !== "entering") {
      drawVegetation();
      drawObstacles();
      drawPickups();
    }
    drawFish();
    if (state !== "win" && state !== "entering") {
      drawFloatingTexts();
    }
  }

  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  function isBetweenRuns() {
    return state === "start" || state === "gameover" || state === "win" || state === "levelcomplete";
  }

  // Keyboard input
  window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") moveLeft = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") moveRight = true;
    if (e.code === "Space" && isBetweenRuns()) {
      if (state === "levelcomplete") continueToNextLevel();
      else if (state === "start") beginGame();
      else resetGame();
    }
    // Dev shortcut: jump straight to a level for testing without playing
    // through the whole game. Only active on the between-runs screens.
    if (isBetweenRuns() && ["Digit1", "Digit2", "Digit3"].includes(e.code)) {
      const n = Number(e.code.slice(-1));
      totalScore = 0;
      startLevel(n);
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") moveLeft = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") moveRight = false;
  });

  // Touch / mouse input for on-screen tap zones
  function bindZone(el, onStart, onEnd) {
    el.addEventListener("touchstart", (e) => {
      e.preventDefault();
      onStart();
    });
    el.addEventListener("touchend", (e) => {
      e.preventDefault();
      onEnd();
    });
    el.addEventListener("mousedown", onStart);
    el.addEventListener("mouseup", onEnd);
    el.addEventListener("mouseleave", onEnd);
  }

  bindZone(
    touchLeft,
    () => (moveLeft = true),
    () => (moveLeft = false)
  );
  bindZone(
    touchRight,
    () => (moveRight = true),
    () => (moveRight = false)
  );

  document.getElementById("touch-controls").addEventListener("touchstart", () => {
    if (state === "levelcomplete") continueToNextLevel();
    else if (state === "start") beginGame();
    else if (isBetweenRuns()) resetGame();
  });

  startButton.addEventListener("click", beginGame);
  restartButton.addEventListener("click", resetGame);
  continueButton.addEventListener("click", continueToNextLevel);
  winRestartButton.addEventListener("click", resetGame);

  // Precompute each level's type -> draw function lookup once, rather
  // than re-deriving it every frame in drawObstacles().
  for (const lvl of LEVELS) {
    lvl.obstacleDrawers = Object.fromEntries(lvl.obstacleTypes.map((o) => [o.type, o.draw]));
  }

  // Draws all three playable species side by side on the start screen's
  // title card, at a shared display scale (independent of each species'
  // in-game pixel size) and bottom-aligned so the eel's much longer body
  // reads as "longer", not just "differently centered". Static — drawn
  // once, since none of this animates.
  function drawTitleFish() {
    const titleCanvas = document.getElementById("title-fish-canvas");
    if (!titleCanvas) return;
    const titleCtx = titleCanvas.getContext("2d");
    titleCtx.imageSmoothingEnabled = false;
    const displayPixel = 3.2;
    const gap = 16;
    const bottomMargin = 8;
    const dimsList = LEVELS.map((lvl) => spriteDims(lvl.fish.sprite, displayPixel));
    const totalWidth = dimsList.reduce((sum, d) => sum + d.width, 0) + gap * (dimsList.length - 1);
    let x = (titleCanvas.width - totalWidth) / 2;
    LEVELS.forEach((lvl, i) => {
      const dims = dimsList[i];
      const y = titleCanvas.height - dims.height - bottomMargin;
      drawSprite(lvl.fish.sprite, lvl.fish.palette, x, y, displayPixel, lvl.fish.outline, titleCtx);
      x += dims.width + gap;
    });
  }
  drawTitleFish();

  // Draws each playable species as a family line on the win screen: three
  // small babies trailing a full-size adult, all facing right. The sprites
  // are authored nose-up (rows 0 -> tail) for the vertical swim gameplay,
  // so each fish is rotated 90° clockwise about its own center to face
  // right instead — that maps local "up" (the nose) to screen "right".
  // Static, drawn once, same as drawTitleFish.
  function drawWinFish() {
    const winCanvas = document.getElementById("win-fish-canvas");
    if (!winCanvas) return;
    const winCtx = winCanvas.getContext("2d");
    winCtx.imageSmoothingEnabled = false;

    // Baby ratio dropped from 0.42 to 0.3 (a bigger adult/baby gap reads
    // more clearly as "parent" vs. "offspring"), and adultPixel raised to
    // fill the canvas now that it's bigger (see #win-fish-canvas in
    // style.css/index.html) rather than sized to the old, tighter one.
    const adultPixel = 3.4;
    const babyPixel = adultPixel * 0.3;
    const gap = 6;
    const rowGap = 8;

    function drawFacingRight(lvl, pixelSize, cx, cy) {
      const dims = spriteDims(lvl.fish.sprite, pixelSize);
      winCtx.save();
      winCtx.translate(cx, cy);
      winCtx.rotate(Math.PI / 2);
      drawSprite(lvl.fish.sprite, lvl.fish.palette, -dims.width / 2, -dims.height / 2, pixelSize, lvl.fish.outline, winCtx);
      winCtx.restore();
    }

    // Rotated 90°, each sprite's row count (its length) runs horizontally
    // and its column count (its girth) runs vertically. The adult leads on
    // the right (the direction every fish is facing); babies trail in from
    // the left behind it.
    const rows = LEVELS.map((lvl) => {
      const babyDims = spriteDims(lvl.fish.sprite, babyPixel);
      const adultDims = spriteDims(lvl.fish.sprite, adultPixel);
      const lengths = [babyDims.height, babyDims.height, babyDims.height, adultDims.height];
      const totalWidth = lengths.reduce((a, b) => a + b, 0) + gap * (lengths.length - 1);
      return { lvl, lengths, totalWidth, rowHeight: adultDims.width };
    });

    const totalHeight = rows.reduce((sum, r) => sum + r.rowHeight, 0) + rowGap * (rows.length - 1);
    let y = (winCanvas.height - totalHeight) / 2;
    for (const row of rows) {
      let x = (winCanvas.width - row.totalWidth) / 2;
      const cy = y + row.rowHeight / 2;
      row.lengths.forEach((len, i) => {
        const isAdult = i === row.lengths.length - 1;
        drawFacingRight(row.lvl, isAdult ? adultPixel : babyPixel, x + len / 2, cy);
        x += len + gap;
      });
      y += row.rowHeight + rowGap;
    }
  }
  drawWinFish();

  // Dev/test entry point: ?level=2 (or 3) jumps straight into that level
  // instead of the normal start screen, so individual levels can be
  // tested without playing through the ones before them.
  const requestedLevel = Number(new URLSearchParams(location.search).get("level"));
  if (requestedLevel >= 1 && requestedLevel <= LEVELS.length) {
    startLevel(requestedLevel);
  } else {
    level = LEVELS[0];
    FISH_WIDTH = spriteDims(level.fish.sprite, level.fish.pixel).width;
    FISH_HEIGHT = spriteDims(level.fish.sprite, level.fish.pixel).height;
    scatterInitialVegetation(); // banks aren't bare behind the start screen
  }

  requestAnimationFrame(loop);
})();

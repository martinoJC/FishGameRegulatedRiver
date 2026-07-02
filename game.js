(() => {
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const gameOverScreen = document.getElementById("game-over-screen");
  const finalScoreEl = document.getElementById("final-score");
  const restartButton = document.getElementById("restart-button");
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
  function drawSprite(rows, palette, x, y, pixelSize) {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === ".") continue;
        ctx.fillStyle = palette[ch];
        ctx.fillRect(
          Math.round(x + c * pixelSize),
          Math.round(y + r * pixelSize),
          pixelSize,
          pixelSize
        );
      }
    }
  }

  function spriteDims(rows, pixelSize) {
    return { width: rows[0].length * pixelSize, height: rows.length * pixelSize };
  }

  // Murray cod, facing "up" (river flows toward the player)
  const FISH_PIXEL = 2;
  const FISH_PALETTE = {
    B: "#8a9a4a", // olive body
    O: "#7a8a3f", // base olive
    D: "#3f4d1f", // dark mottling
    C: "#e6dcae", // cream belly
    E: "#151515", // eye
    F: "#a5622f", // fins/tail
  };
  const FISH_SPRITE = [
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
    "...FBF...",
    "..F.B.F..",
    ".F..B..F.",
  ];
  const FISH_DIMS = spriteDims(FISH_SPRITE, FISH_PIXEL);

  // Predator bird, viewed from above with wings spread
  const BIRD_PIXEL = 2;
  const BIRD_PALETTE = {
    W: "#33261a", // wing
    H: "#1c140d", // body
    Y: "#e8b23d", // beak
  };
  const BIRD_SPRITE = [
    "..W.....W..",
    ".WWW...WWW.",
    "WWWWWHWWWWW",
    "..WWHHHWW..",
    "...WHYHW...",
    "....H.H....",
  ];
  const BIRD_DIMS = spriteDims(BIRD_SPRITE, BIRD_PIXEL);

  // Motorboat, bow first
  const BOAT_PIXEL = 2;
  const BOAT_PALETTE = {
    H: "#e8e8e8", // hull
    R: "#c23b3b", // stripe
    D: "#1c1c1c", // motor
    W: "#dfe9f2", // wake
  };
  const BOAT_SPRITE = [
    "....H....",
    "...HHH...",
    "..HHHHH..",
    ".HRRRRRH.",
    "HHHHHHHHH",
    "HHHHHHHHH",
    "HHRRRRRHH",
    "HHHHHHHHH",
    "HHHHHHHHH",
    "HHRRRRRHH",
    "HHHHHHHHH",
    "HHHHHHHHH",
    ".HHHHHHH.",
    "..HHDHH..",
    "...WDW...",
    "..W.D.W..",
  ];
  const BOAT_DIMS = spriteDims(BOAT_SPRITE, BOAT_PIXEL);

  // Floating debris variants
  const DEBRIS_PIXEL = 2.2;
  const DEBRIS_VARIANTS = [
    {
      palette: { T: "#2b2b2b" },
      rows: [".TTTTT.", "TT...TT", "T.....T", "T.....T", "T.....T", "TT...TT", ".TTTTT."],
    },
    {
      palette: { N: "#1c1c1c", G: "#2f6b3f" },
      rows: ["..N..", "..N..", ".GGG.", "GGGGG", "GGGGG", "GGGGG", "GGGGG", "GGGGG", ".GGG."],
    },
    {
      palette: { A: "#b0b0b0", R: "#c94444" },
      rows: [".AAA.", "AAAAA", "ARRRA", "ARRRA", "ARRRA", "AAAAA", ".AAA."],
    },
  ];

  const FISH_WIDTH = FISH_DIMS.width;
  const FISH_HEIGHT = FISH_DIMS.height;
  const FISH_SPEED = 150; // px/sec
  const FISH_Y = HEIGHT - 80;

  const BASE_SCROLL_SPEED = 80; // px/sec
  const MAX_SCROLL_SPEED = 260;
  const SCROLL_ACCEL = 2; // px/sec added per second survived

  const BASE_SPAWN_INTERVAL = 1200; // ms
  const MIN_SPAWN_INTERVAL = 550;

  const BEST_SCORE_KEY = "fishGameBestScore";

  // Obstacle spawn weights (higher = more common)
  const OBSTACLE_WEIGHTS = [
    { type: "log", weight: 30 },
    { type: "debris", weight: 20 },
    { type: "net", weight: 15 },
    { type: "bird", weight: 15 },
    { type: "boat", weight: 12 },
    { type: "weir", weight: 8 },
  ];

  let state = "playing"; // "playing" | "gameover"
  let fishX = WIDTH / 2;
  let moveLeft = false;
  let moveRight = false;

  let obstacles = [];
  let scrollSpeed = BASE_SCROLL_SPEED;
  let spawnTimer = 0;
  let elapsed = 0; // seconds survived
  let score = 0;
  let bestScore = Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;

  let waterLineOffset = 0;

  bestEl.textContent = `Best: ${bestScore}`;

  function resetGame() {
    fishX = WIDTH / 2;
    obstacles = [];
    scrollSpeed = BASE_SCROLL_SPEED;
    spawnTimer = 0;
    elapsed = 0;
    score = 0;
    waterLineOffset = 0;
    state = "playing";
    gameOverScreen.classList.add("hidden");
  }

  function pickObstacleType() {
    const total = OBSTACLE_WEIGHTS.reduce((sum, o) => sum + o.weight, 0);
    let r = Math.random() * total;
    for (const o of OBSTACLE_WEIGHTS) {
      if (r < o.weight) return o.type;
      r -= o.weight;
    }
    return "log";
  }

  // A "gap" obstacle spans from one bank partway across the river, leaving
  // a gap on the other side (used for the weir and the fishing net).
  function makeGapObstacle(type, widthFrac, height) {
    const width = RIVER_WIDTH * widthFrac;
    const gapLeft = Math.random() < 0.5; // true = gap is on the left bank
    const x = gapLeft ? RIVER_RIGHT - width : RIVER_LEFT;
    return { type, x, y: -height, width, height, gapLeft };
  }

  function makeLog() {
    const width = 28 + Math.random() * 34;
    const height = 12;
    const x = RIVER_LEFT + Math.random() * (RIVER_WIDTH - width);
    return { type: "log", x, y: -height, width, height };
  }

  function makeWeir() {
    return makeGapObstacle("weir", 0.52, 24);
  }

  function makeNet() {
    return makeGapObstacle("net", 0.62, 10);
  }

  function makeBird() {
    const width = BIRD_DIMS.width;
    const height = BIRD_DIMS.height;
    const baseX = RIVER_LEFT + Math.random() * (RIVER_WIDTH - width);
    return { type: "bird", x: baseX, baseX, y: -height, width, height, phase: Math.random() * Math.PI * 2 };
  }

  function makeDebris() {
    const variant = DEBRIS_VARIANTS[Math.floor(Math.random() * DEBRIS_VARIANTS.length)];
    const dims = spriteDims(variant.rows, DEBRIS_PIXEL);
    const x = RIVER_LEFT + Math.random() * (RIVER_WIDTH - dims.width);
    return {
      type: "debris",
      x,
      y: -dims.height,
      width: dims.width,
      height: dims.height,
      speedMult: 1.3,
      variant,
    };
  }

  function makeBoat() {
    const width = BOAT_DIMS.width;
    const height = BOAT_DIMS.height;
    const x = RIVER_LEFT + Math.random() * (RIVER_WIDTH - width);
    return { type: "boat", x, y: -height, width, height, speedMult: 1.6 };
  }

  function spawnObstacle() {
    switch (pickObstacleType()) {
      case "weir":
        obstacles.push(makeWeir());
        break;
      case "net":
        obstacles.push(makeNet());
        break;
      case "bird":
        obstacles.push(makeBird());
        break;
      case "debris":
        obstacles.push(makeDebris());
        break;
      case "boat":
        obstacles.push(makeBoat());
        break;
      default:
        obstacles.push(makeLog());
    }
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  function update(dt) {
    if (state !== "playing") return;

    // Movement
    if (moveLeft) fishX -= FISH_SPEED * dt;
    if (moveRight) fishX += FISH_SPEED * dt;
    fishX = Math.max(
      RIVER_LEFT + FISH_WIDTH / 2,
      Math.min(RIVER_RIGHT - FISH_WIDTH / 2, fishX)
    );

    // Difficulty ramp
    elapsed += dt;
    scrollSpeed = Math.min(
      MAX_SCROLL_SPEED,
      BASE_SCROLL_SPEED + elapsed * SCROLL_ACCEL
    );

    // Water scroll animation
    waterLineOffset = (waterLineOffset + scrollSpeed * dt) % 24;

    // Spawn obstacles
    spawnTimer -= dt * 1000;
    if (spawnTimer <= 0) {
      spawnObstacle();
      const interval = Math.max(
        MIN_SPAWN_INTERVAL,
        BASE_SPAWN_INTERVAL - elapsed * 15
      );
      spawnTimer = interval;
    }

    // Move obstacles
    for (const o of obstacles) {
      const speedMult = o.speedMult || 1;
      o.y += scrollSpeed * speedMult * dt;
      if (o.type === "bird") {
        o.phase += dt * 2.2;
        o.x = Math.max(
          RIVER_LEFT,
          Math.min(RIVER_RIGHT - o.width, o.baseX + Math.sin(o.phase) * 40)
        );
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
    for (const o of obstacles) {
      if (rectsOverlap(fishRect, o)) {
        endGame();
        break;
      }
    }

    // Score = distance survived
    score = Math.floor(elapsed * 10);
    scoreEl.textContent = `Score: ${score}`;
  }

  function endGame() {
    state = "gameover";
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
      bestEl.textContent = `Best: ${bestScore}`;
    }
    finalScoreEl.textContent = `Score: ${score}`;
    gameOverScreen.classList.remove("hidden");
  }

  function drawRiver() {
    ctx.fillStyle = "#2f8f4e";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#1b5e7d";
    ctx.fillRect(RIVER_LEFT, 0, RIVER_WIDTH, HEIGHT);

    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    for (let y = -24 + waterLineOffset; y < HEIGHT; y += 24) {
      ctx.beginPath();
      ctx.moveTo(RIVER_LEFT + 6, y);
      ctx.lineTo(RIVER_LEFT + 16, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(RIVER_RIGHT - 16, y + 12);
      ctx.lineTo(RIVER_RIGHT - 6, y + 12);
      ctx.stroke();
    }
  }

  function drawLog(o) {
    ctx.fillStyle = "#6b4226";
    ctx.fillRect(o.x, o.y, o.width, o.height);
    ctx.fillStyle = "#4a2c18";
    ctx.fillRect(o.x, o.y, o.width, 3);
    ctx.fillRect(o.x, o.y + o.height - 3, o.width, 3);
    ctx.fillStyle = "#8a5a34";
    ctx.beginPath();
    ctx.arc(o.x + 5, o.y + o.height / 2, 4, 0, Math.PI * 2);
    ctx.arc(o.x + o.width - 5, o.y + o.height / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWeir(o) {
    ctx.fillStyle = "#8a8a86";
    ctx.fillRect(o.x, o.y, o.width, o.height);
    ctx.fillStyle = "#6a6a66";
    for (let px = o.x; px < o.x + o.width; px += 10) {
      ctx.fillRect(px, o.y, 3, o.height);
    }
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    for (let px = o.x; px < o.x + o.width; px += 8) {
      ctx.fillRect(px, o.y + o.height - 5, 4, 3);
    }
    ctx.fillStyle = "#4a4a46";
    ctx.fillRect(o.x, o.y, o.width, 3);
  }

  function drawNet(o) {
    ctx.fillStyle = "rgba(210,210,200,0.55)";
    ctx.fillRect(o.x, o.y, o.width, o.height);
    ctx.strokeStyle = "rgba(60,60,50,0.8)";
    ctx.lineWidth = 1;
    for (let px = o.x; px < o.x + o.width; px += 6) {
      ctx.beginPath();
      ctx.moveTo(px, o.y);
      ctx.lineTo(px, o.y + o.height);
      ctx.stroke();
    }
    ctx.fillStyle = "#d94f4f";
    ctx.beginPath();
    ctx.arc(o.x + 3, o.y + o.height / 2, 3, 0, Math.PI * 2);
    ctx.arc(o.x + o.width - 3, o.y + o.height / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawObstacles() {
    for (const o of obstacles) {
      switch (o.type) {
        case "log":
          drawLog(o);
          break;
        case "weir":
          drawWeir(o);
          break;
        case "net":
          drawNet(o);
          break;
        case "bird":
          drawSprite(BIRD_SPRITE, BIRD_PALETTE, o.x, o.y, BIRD_PIXEL);
          break;
        case "boat":
          drawSprite(BOAT_SPRITE, BOAT_PALETTE, o.x, o.y, BOAT_PIXEL);
          break;
        case "debris":
          drawSprite(o.variant.rows, o.variant.palette, o.x, o.y, DEBRIS_PIXEL);
          break;
      }
    }
  }

  function drawFish() {
    drawSprite(
      FISH_SPRITE,
      FISH_PALETTE,
      fishX - FISH_WIDTH / 2,
      FISH_Y - FISH_HEIGHT / 2,
      FISH_PIXEL
    );
  }

  function draw() {
    drawRiver();
    drawObstacles();
    drawFish();
  }

  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  // Keyboard input
  window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") moveLeft = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") moveRight = true;
    if (e.code === "Space" && state === "gameover") resetGame();
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

  document
    .getElementById("touch-controls")
    .addEventListener("touchstart", () => {
      if (state === "gameover") resetGame();
    });

  restartButton.addEventListener("click", resetGame);

  requestAnimationFrame(loop);
})();

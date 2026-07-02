(() => {
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const healthEl = document.getElementById("health");
  const bannerEl = document.getElementById("banner");
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
  // `outline` (optional) stamps a 1-cell border color around the sprite's
  // silhouette first, which makes small pixel-art creatures read clearly
  // against a similarly-toned background.
  function drawSprite(rows, palette, x, y, pixelSize, outline) {
    if (outline) {
      ctx.fillStyle = outline;
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
              ctx.fillRect(
                Math.round(x + nc * pixelSize),
                Math.round(y + nr * pixelSize),
                pixelSize,
                pixelSize
              );
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

  // Golden perch, facing "up" (river flows toward the player)
  const FISH_PIXEL = 2.4;
  const FISH_OUTLINE = "#8a6a30";
  const FISH_PALETTE = {
    B: "#f0d78c", // golden body
    O: "#e6c977", // base gold
    D: "#c9a35a", // muted golden-brown mottling
    C: "#fbf3d9", // pale belly
    E: "#4a3a1c", // eye
    F: "#eab868", // fins/tail
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

  // Predator bird, viewed from above: white body, dark eyes, swept wingtips, tail fan
  const BIRD_PIXEL = 2.4;
  const BIRD_OUTLINE = "#8a94a0";
  const BIRD_PALETTE = {
    Y: "#f0b25c", // beak
    H: "#f7f7f5", // head/body
    E: "#2a2a28", // eye
    S: "#e2e6ea", // tail shading
    W: "#f2f2f0", // wing
    G: "#cfd8e0", // wing shading
  };
  const BIRD_SPRITE = [
    ".....Y.....",
    "...EHHHE...",
    "GW.HHHHH.WG",
    "WWG.HHH.GWW",
    ".GW..H..WG.",
    "...SHSHS...",
    "....SSS....",
  ];
  const BIRD_DIMS = spriteDims(BIRD_SPRITE, BIRD_PIXEL);

  // Turtle, viewed from above
  const TURTLE_PIXEL = 2.4;
  const TURTLE_OUTLINE = "#4f6b52";
  const TURTLE_PALETTE = {
    H: "#8a9c5e", // head
    E: "#2a2a1a", // eye
    K: "#a8b571", // legs/skin
    S: "#a9d6ab", // shell
    P: "#5f8f63", // shell pattern
  };
  const TURTLE_SPRITE = [
    "...HHH...",
    "..EHHHE..",
    ".KKSSSKK.",
    "KKSPSPSKK",
    "KSSPSPSSK",
    "KSPSSSPSK",
    "KSSPSPSSK",
    "KSPSSSPSK",
    ".KSSSSSK.",
    "..KK.KK..",
    "...K.K...",
    "....K....",
  ];
  const TURTLE_DIMS = spriteDims(TURTLE_SPRITE, TURTLE_PIXEL);

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
    { type: "log", weight: 40 },
    { type: "bird", weight: 25 },
    { type: "turtle", weight: 20 },
    { type: "weir", weight: 15 },
  ];

  // Fish ladder section: a curvy pool-and-weir channel with no hard
  // obstacles. Straying outside the channel costs health instead of
  // ending the run instantly.
  const LADDER_START_TIME = 10; // seconds survived
  const LADDER_DURATION = 7; // seconds
  const LADDER_MAX_HEALTH = 5;
  const LADDER_HIT_COOLDOWN = 0.6; // seconds of grace after taking damage
  const LADDER_CHANNEL_WIDTH = RIVER_WIDTH * 0.55;
  const LADDER_AMPLITUDE = (RIVER_WIDTH - LADDER_CHANNEL_WIDTH) / 2;
  const LADDER_WAVELENGTH = 300; // px of scroll distance per full S-curve
  const LADDER_STEP_SPACING = 90; // px between pool-and-weir step lines

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

  let ladderActive = false;
  let ladderHealth = LADDER_MAX_HEALTH;
  let ladderDistance = 0;
  let ladderHitCooldown = 0;
  let bannerTimer = 0;

  bestEl.textContent = `Best: ${bestScore}`;

  function resetGame() {
    fishX = WIDTH / 2;
    obstacles = [];
    scrollSpeed = BASE_SCROLL_SPEED;
    spawnTimer = 0;
    elapsed = 0;
    score = 0;
    waterLineOffset = 0;
    ladderActive = false;
    ladderHealth = LADDER_MAX_HEALTH;
    ladderDistance = 0;
    ladderHitCooldown = 0;
    bannerTimer = 0;
    healthEl.classList.add("hidden");
    bannerEl.classList.add("hidden");
    state = "playing";
    gameOverScreen.classList.add("hidden");
  }

  function updateHealthDisplay() {
    healthEl.textContent = `Health: ${ladderHealth}`;
  }

  function showBanner(text, duration) {
    bannerEl.textContent = text;
    bannerEl.classList.remove("hidden");
    bannerTimer = duration;
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
  // a gap on the other side (used for the weir).
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

  function makeBird() {
    const width = BIRD_DIMS.width;
    const height = BIRD_DIMS.height;
    const baseX = RIVER_LEFT + Math.random() * (RIVER_WIDTH - width);
    return { type: "bird", x: baseX, baseX, y: -height, width, height, phase: Math.random() * Math.PI * 2 };
  }

  function makeTurtle() {
    const width = TURTLE_DIMS.width;
    const height = TURTLE_DIMS.height;
    const x = RIVER_LEFT + Math.random() * (RIVER_WIDTH - width);
    return { type: "turtle", x, y: -height, width, height, speedMult: 1.6 };
  }

  function spawnObstacle() {
    switch (pickObstacleType()) {
      case "weir":
        obstacles.push(makeWeir());
        break;
      case "bird":
        obstacles.push(makeBird());
        break;
      case "turtle":
        obstacles.push(makeTurtle());
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

  function updateObstacles(dt) {
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
  }

  // Center-x of the fish ladder's winding channel at a given "world"
  // position (distance already scrolled minus the canvas row). Phase is
  // shifted so the channel starts centered under wherever the fish
  // already is, for a smooth hand-off from the open river.
  function ladderChannelCenter(worldPos) {
    const phase = ((worldPos + FISH_Y) / LADDER_WAVELENGTH) * Math.PI * 2;
    return WIDTH / 2 + Math.sin(phase) * LADDER_AMPLITUDE;
  }

  function updateLadder(dt) {
    ladderDistance += scrollSpeed * dt;
    if (ladderHitCooldown > 0) ladderHitCooldown -= dt;

    const fishWorldPos = ladderDistance - FISH_Y;
    const center = ladderChannelCenter(fishWorldPos);
    const wallLeft = center - LADDER_CHANNEL_WIDTH / 2;
    const wallRight = center + LADDER_CHANNEL_WIDTH / 2;

    const fishLeft = fishX - FISH_WIDTH / 2 + 2;
    const fishRight = fishX + FISH_WIDTH / 2 - 2;

    if ((fishLeft < wallLeft || fishRight > wallRight) && ladderHitCooldown <= 0) {
      ladderHealth -= 1;
      ladderHitCooldown = LADDER_HIT_COOLDOWN;
      updateHealthDisplay();
      if (ladderHealth <= 0) endGame();
    }
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

    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) bannerEl.classList.add("hidden");
    }

    // Enter/exit the fish ladder section
    if (
      !ladderActive &&
      elapsed >= LADDER_START_TIME &&
      elapsed < LADDER_START_TIME + LADDER_DURATION
    ) {
      ladderActive = true;
      ladderHealth = LADDER_MAX_HEALTH;
      ladderDistance = 0;
      ladderHitCooldown = 0;
      obstacles = [];
      healthEl.classList.remove("hidden");
      updateHealthDisplay();
      showBanner("Fish ladder ahead — stay in the channel!", 2.2);
    } else if (ladderActive && elapsed >= LADDER_START_TIME + LADDER_DURATION) {
      ladderActive = false;
      healthEl.classList.add("hidden");
      spawnTimer = 400;
      showBanner("Back to the river", 1.8);
    }

    if (ladderActive) {
      updateLadder(dt);
    } else {
      updateObstacles(dt);
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
    ctx.fillStyle = "#bfe3b4";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#a9d8e6";
    ctx.fillRect(RIVER_LEFT, 0, RIVER_WIDTH, HEIGHT);

    ctx.strokeStyle = "rgba(255,255,255,0.4)";
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

  function drawFishLadder() {
    ctx.fillStyle = "#bfe3b4";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const step = 2;
    for (let y = 0; y < HEIGHT; y += step) {
      const worldPos = ladderDistance - y;
      const center = ladderChannelCenter(worldPos);
      const left = center - LADDER_CHANNEL_WIDTH / 2;
      const right = center + LADDER_CHANNEL_WIDTH / 2;

      ctx.fillStyle = "#d8d8d2";
      ctx.fillRect(RIVER_LEFT, y, RIVER_WIDTH, step);

      ctx.fillStyle = "#a9d8e6";
      ctx.fillRect(left, y, right - left, step);

      // Pool-and-weir step lines — decorative only, not solid
      const stepPhase =
        ((worldPos % LADDER_STEP_SPACING) + LADDER_STEP_SPACING) % LADDER_STEP_SPACING;
      if (stepPhase < step) {
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(left, y, right - left, step);
      }
    }
  }

  function drawLog(o) {
    ctx.fillStyle = "#c9a876";
    ctx.fillRect(o.x, o.y, o.width, o.height);
    ctx.fillStyle = "#a9835a";
    ctx.fillRect(o.x, o.y, o.width, 3);
    ctx.fillRect(o.x, o.y + o.height - 3, o.width, 3);
    ctx.fillStyle = "#dbb98a";
    ctx.beginPath();
    ctx.arc(o.x + 5, o.y + o.height / 2, 4, 0, Math.PI * 2);
    ctx.arc(o.x + o.width - 5, o.y + o.height / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWeir(o) {
    ctx.fillStyle = "#d8d8d2";
    ctx.fillRect(o.x, o.y, o.width, o.height);
    ctx.fillStyle = "#bcbcb4";
    for (let px = o.x; px < o.x + o.width; px += 10) {
      ctx.fillRect(px, o.y, 3, o.height);
    }
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    for (let px = o.x; px < o.x + o.width; px += 8) {
      ctx.fillRect(px, o.y + o.height - 5, 4, 3);
    }
    ctx.fillStyle = "#c2c2ba";
    ctx.fillRect(o.x, o.y, o.width, 3);
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
        case "bird":
          drawSprite(BIRD_SPRITE, BIRD_PALETTE, o.x, o.y, BIRD_PIXEL, BIRD_OUTLINE);
          break;
        case "turtle":
          drawSprite(TURTLE_SPRITE, TURTLE_PALETTE, o.x, o.y, TURTLE_PIXEL, TURTLE_OUTLINE);
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
      FISH_PIXEL,
      FISH_OUTLINE
    );
  }

  function draw() {
    if (ladderActive) {
      drawFishLadder();
    } else {
      drawRiver();
    }
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

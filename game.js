(() => {
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const healthBarFillEl = document.getElementById("health-bar-fill");
  const bannerEl = document.getElementById("banner");
  const startScreenEl = document.getElementById("start-screen");
  const startButton = document.getElementById("start-button");
  const gameOverScreen = document.getElementById("game-over-screen");
  const finalScoreEl = document.getElementById("final-score");
  const restartButton = document.getElementById("restart-button");
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

  // Predator bird, viewed from above in a classic "flying M" silhouette:
  // beak, rounded head, wings swept back to pointed tips, tail fan.
  const BIRD_PIXEL = 2.4;
  const BIRD_OUTLINE = "#8a94a0";
  const BIRD_PALETTE = {
    Y: "#f0b25c", // beak
    H: "#f7f7f5", // head/body
    E: "#2a2a28", // eye
    S: "#e2e6ea", // tail shading
    W: "#f2f2f0", // wing
  };
  const BIRD_SPRITE = [
    "......Y......",
    ".....EHE.....",
    "....HHHHH....",
    "...WHHHHHW...",
    "..WWHHHHHWW..",
    ".WWW.HHH.WWW.",
    "WWW...H...WWW",
    "....SSSSS....",
  ];
  const BIRD_DIMS = spriteDims(BIRD_SPRITE, BIRD_PIXEL);

  // Turtle, viewed from above: small head, round oval shell with pattern,
  // two pairs of legs poking out the sides, small tail.
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
    "....H....",
    "...HHH...",
    "..EHHHE..",
    ".KSSSSSK.",
    "KKSPSPSKK",
    ".SSPSPSS.",
    "KKSPSPSKK",
    ".KSSSSSK.",
    "..SSSSS..",
    "...SSS...",
    "....S....",
  ];
  const TURTLE_DIMS = spriteDims(TURTLE_SPRITE, TURTLE_PIXEL);

  // Crab, viewed from above — a fish-ladder pickup: eat it to heal and score
  const CRAB_PIXEL = 2.2;
  const CRAB_OUTLINE = "#8a4a30";
  const CRAB_PALETTE = {
    C: "#d97350", // claws
    B: "#eb9a78", // body
    E: "#2a1a12", // eye
    L: "#c96a45", // legs
  };
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
  const CRAB_DIMS = spriteDims(CRAB_SPRITE, CRAB_PIXEL);

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

  // Health: a shared resource across the whole run. Normal obstacles and
  // fish-ladder walls both damage it (rather than obstacles being an
  // instant death) — running out of health is what ends the run.
  const MAX_HEALTH = 5;
  const HIT_COOLDOWN = 0.6; // seconds of invulnerability after taking damage
  const OBSTACLE_DAMAGE = 2;
  const LADDER_WALL_DAMAGE = 1;

  // Fish ladder section: a curvy pool-and-weir channel with no hard
  // obstacles, just walls that damage on contact.
  const LADDER_START_TIME = 10; // seconds survived
  const LADDER_DURATION = 10; // seconds
  const LADDER_CHANNEL_WIDTH = RIVER_WIDTH * 0.55;
  const LADDER_AMPLITUDE = (RIVER_WIDTH - LADDER_CHANNEL_WIDTH) / 2;
  const LADDER_WAVELENGTH = 300; // px of scroll distance per full S-curve
  const LADDER_STEP_SPACING = 90; // px between pool-and-weir step lines

  // Level 1 ends with the river opening into a floodplain: 10s river, 10s
  // fish ladder, 10s river, then a swim-in transition into the floodplain
  // before the win screen appears.
  const FLOODPLAIN_START_TIME = LADDER_START_TIME + LADDER_DURATION + 10; // 30s
  const FLOODPLAIN_FISH_COUNT = 7;
  const ENTER_FLOODPLAIN_DURATION = 2.5; // seconds — banks recede, fish glides to center

  const CRAB_FIRST_SPAWN_DELAY = 2500; // ms — let the entry banner clear first
  const CRAB_SPAWN_INTERVAL = 1800; // ms
  const CRAB_HEAL_AMOUNT = 1;
  const CRAB_SCORE_BONUS = 20;

  let state = "start"; // "start" | "playing" | "entering" | "gameover" | "win"
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

  let health = MAX_HEALTH;
  let hitCooldown = 0;

  let ladderActive = false;
  let ladderDistance = 0;
  let bannerTimer = 0;
  let bonusScore = 0;

  let crabs = [];
  let crabSpawnTimer = 0;
  let crabIntroShown = false;

  let floodplainFish = [];
  let enterTimer = 0;

  bestEl.textContent = `Best: ${bestScore}`;

  function resetGame() {
    fishX = WIDTH / 2;
    obstacles = [];
    scrollSpeed = BASE_SCROLL_SPEED;
    spawnTimer = 0;
    elapsed = 0;
    score = 0;
    waterLineOffset = 0;
    health = MAX_HEALTH;
    hitCooldown = 0;
    ladderActive = false;
    ladderDistance = 0;
    bannerTimer = 0;
    bonusScore = 0;
    crabs = [];
    crabSpawnTimer = 0;
    crabIntroShown = false;
    floodplainFish = [];
    enterTimer = 0;
    bannerEl.classList.add("hidden");
    state = "playing";
    startScreenEl.classList.add("hidden");
    gameOverScreen.classList.add("hidden");
    winScreenEl.classList.add("hidden");
    updateHealthDisplay();
  }

  // The channel opens up and the fish glides to a stop among the other
  // fish before the win screen appears — see updateEntering()/draw().
  function enterFloodplain() {
    state = "entering";
    enterTimer = 0;
    obstacles = [];
    crabs = [];
    floodplainFish = Array.from({ length: FLOODPLAIN_FISH_COUNT }, () => ({
      x: 16 + Math.random() * (WIDTH - 32),
      y: 30 + Math.random() * (HEIGHT - 100),
      phase: Math.random() * Math.PI * 2,
    }));
  }

  function winGame() {
    state = "win";
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
      bestEl.textContent = `Best: ${bestScore}`;
    }
    winScoreEl.textContent = `Score: ${score}`;
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
    if (hitCooldown <= 0) {
      for (const o of obstacles) {
        if (rectsOverlap(fishRect, o)) {
          takeDamage(OBSTACLE_DAMAGE);
          break;
        }
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

  // Crabs spawn within the channel's safe inner span at their spawn row,
  // so they're reachable when they scroll down (the channel may have
  // curved by the time they reach the fish, same as any other obstacle).
  function spawnCrab() {
    const dims = CRAB_DIMS;
    const spawnWorldPos = ladderDistance + dims.height;
    const channelCenter = ladderChannelCenter(spawnWorldPos);
    const halfInner = Math.max(0, LADDER_CHANNEL_WIDTH / 2 - dims.width / 2 - 4);
    const centerX = channelCenter + (Math.random() * 2 - 1) * halfInner;
    crabs.push({
      x: centerX - dims.width / 2,
      y: -dims.height,
      width: dims.width,
      height: dims.height,
    });
    if (!crabIntroShown) {
      crabIntroShown = true;
      showBanner("Eat the crabs!", 2);
    }
  }

  function updateLadder(dt) {
    ladderDistance += scrollSpeed * dt;

    // Spawn crabs
    crabSpawnTimer -= dt * 1000;
    if (crabSpawnTimer <= 0) {
      spawnCrab();
      crabSpawnTimer = CRAB_SPAWN_INTERVAL;
    }

    const fishRect = {
      x: fishX - FISH_WIDTH / 2 + 2,
      y: FISH_Y - FISH_HEIGHT / 2 + 2,
      width: FISH_WIDTH - 4,
      height: FISH_HEIGHT - 4,
    };

    // Move crabs, eat on contact (heals + scores instead of damaging)
    for (const crab of crabs) {
      crab.y += scrollSpeed * dt;
    }
    crabs = crabs.filter((crab) => {
      if (rectsOverlap(fishRect, crab)) {
        health = Math.min(MAX_HEALTH, health + CRAB_HEAL_AMOUNT);
        bonusScore += CRAB_SCORE_BONUS;
        updateHealthDisplay();
        return false;
      }
      return crab.y < HEIGHT + crab.height;
    });

    // Wall collision (damage)
    const fishWorldPos = ladderDistance - FISH_Y;
    const center = ladderChannelCenter(fishWorldPos);
    const wallLeft = center - LADDER_CHANNEL_WIDTH / 2;
    const wallRight = center + LADDER_CHANNEL_WIDTH / 2;

    if (
      (fishRect.x < wallLeft || fishRect.x + fishRect.width > wallRight) &&
      hitCooldown <= 0
    ) {
      takeDamage(LADDER_WALL_DAMAGE);
    }
  }

  // Banks recede, the fish eases to center and the river current slows to
  // a stop, then the win screen appears — run during the "entering" state.
  function updateEntering(dt) {
    enterTimer += dt;
    const t = Math.min(1, enterTimer / ENTER_FLOODPLAIN_DURATION);
    fishX += (WIDTH / 2 - fishX) * Math.min(1, dt * 3);
    scrollSpeed = BASE_SCROLL_SPEED * (1 - t);
    waterLineOffset = (waterLineOffset + scrollSpeed * dt) % 24;
    if (t >= 1) winGame();
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

    if (hitCooldown > 0) hitCooldown -= dt;

    // Reached the floodplain — level complete
    if (elapsed >= FLOODPLAIN_START_TIME) {
      score = Math.floor(elapsed * 10) + bonusScore;
      scoreEl.textContent = `Score: ${score}`;
      enterFloodplain();
      return;
    }

    // Enter/exit the fish ladder section
    if (
      !ladderActive &&
      elapsed >= LADDER_START_TIME &&
      elapsed < LADDER_START_TIME + LADDER_DURATION
    ) {
      ladderActive = true;
      ladderDistance = 0;
      obstacles = [];
      crabs = [];
      crabSpawnTimer = CRAB_FIRST_SPAWN_DELAY;
      crabIntroShown = false;
      updateHealthDisplay();
      showBanner("Fish ladder ahead — stay in the channel!", 2.2);
    } else if (ladderActive && elapsed >= LADDER_START_TIME + LADDER_DURATION) {
      ladderActive = false;
      crabs = [];
      spawnTimer = 400;
      showBanner("Back to the river", 1.8);
    }

    if (ladderActive) {
      updateLadder(dt);
    } else {
      updateObstacles(dt);
    }

    // Score = distance survived + bonuses (e.g. eaten crabs)
    score = Math.floor(elapsed * 10) + bonusScore;
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

  // Draws the water scene with banks at the given width — used for the
  // normal river (bankWidth = BANK_WIDTH), the swim-in transition
  // (bankWidth easing toward 0), and the open floodplain (bankWidth = 0).
  function drawRiverScene(bankWidth) {
    const left = bankWidth;
    const right = WIDTH - bankWidth;
    const width = right - left;

    ctx.fillStyle = "#bfe3b4";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#a9d8e6";
    ctx.fillRect(left, 0, width, HEIGHT);

    ctx.strokeStyle = "rgba(255,255,255,0.4)";
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
      drawSprite(
        FISH_SPRITE,
        FISH_PALETTE,
        fish.x - FISH_WIDTH / 2,
        fish.y - FISH_HEIGHT / 2 + bob,
        FISH_PIXEL,
        FISH_OUTLINE
      );
    }
    ctx.globalAlpha = 1;
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

  function drawCrabs() {
    for (const crab of crabs) {
      drawSprite(CRAB_SPRITE, CRAB_PALETTE, crab.x, crab.y, CRAB_PIXEL, CRAB_OUTLINE);
    }
  }

  function drawFish() {
    // Flicker while invulnerable after taking a hit, so a hit is felt
    if (hitCooldown > 0 && Math.floor(hitCooldown * 10) % 2 === 0) return;
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
    if (state === "entering") {
      const t = Math.min(1, enterTimer / ENTER_FLOODPLAIN_DURATION);
      drawRiverScene(BANK_WIDTH * (1 - t));
      drawFloodplainFish(t);
    } else if (state === "win") {
      drawRiverScene(0);
      drawFloodplainFish(1);
    } else if (ladderActive) {
      drawFishLadder();
    } else {
      drawRiverScene(BANK_WIDTH);
    }

    if (state !== "win" && state !== "entering") {
      drawObstacles();
      drawCrabs();
    }
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

  function isBetweenRuns() {
    return state === "start" || state === "gameover" || state === "win";
  }

  // Keyboard input
  window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") moveLeft = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") moveRight = true;
    if (e.code === "Space" && isBetweenRuns()) resetGame();
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
      if (isBetweenRuns()) resetGame();
    });

  startButton.addEventListener("click", resetGame);
  restartButton.addEventListener("click", resetGame);
  winRestartButton.addEventListener("click", resetGame);

  requestAnimationFrame(loop);
})();

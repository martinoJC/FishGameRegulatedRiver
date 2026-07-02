(() => {
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

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

  const FISH_WIDTH = 18;
  const FISH_HEIGHT = 18;
  const FISH_SPEED = 150; // px/sec
  const FISH_Y = HEIGHT - 70;

  const BASE_SCROLL_SPEED = 80; // px/sec
  const MAX_SCROLL_SPEED = 260;
  const SCROLL_ACCEL = 2; // px/sec added per second survived

  const BASE_SPAWN_INTERVAL = 1100; // ms
  const MIN_SPAWN_INTERVAL = 500;

  const BEST_SCORE_KEY = "fishGameBestScore";

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

  function spawnObstacle() {
    const width = 28 + Math.random() * 34;
    const height = 12;
    const x = RIVER_LEFT + Math.random() * (RIVER_RIGHT - RIVER_LEFT - width);
    obstacles.push({ x, y: -height, width, height });
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

    // Move obstacles, remove offscreen
    const fishRect = {
      x: fishX - FISH_WIDTH / 2,
      y: FISH_Y - FISH_HEIGHT / 2,
      width: FISH_WIDTH,
      height: FISH_HEIGHT,
    };

    for (const obstacle of obstacles) {
      obstacle.y += scrollSpeed * dt;
    }
    obstacles = obstacles.filter((o) => o.y < HEIGHT + o.height);

    // Collision check
    for (const obstacle of obstacles) {
      if (rectsOverlap(fishRect, obstacle)) {
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
    ctx.fillRect(RIVER_LEFT, 0, RIVER_RIGHT - RIVER_LEFT, HEIGHT);

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

  function drawObstacles() {
    for (const o of obstacles) {
      ctx.fillStyle = "#6b4226";
      ctx.fillRect(o.x, o.y, o.width, o.height);
      ctx.fillStyle = "#4a2c18";
      ctx.fillRect(o.x, o.y, o.width, 3);
      ctx.fillRect(o.x, o.y + o.height - 3, o.width, 3);
    }
  }

  function drawFish() {
    const x = fishX;
    const y = FISH_Y;

    ctx.fillStyle = "#ff8c3d";
    ctx.fillRect(x - FISH_WIDTH / 2 + 4, y - FISH_HEIGHT / 2, FISH_WIDTH - 4, FISH_HEIGHT);

    // Tail
    ctx.beginPath();
    ctx.moveTo(x - FISH_WIDTH / 2 + 4, y - FISH_HEIGHT / 2);
    ctx.lineTo(x - FISH_WIDTH / 2 - 5, y);
    ctx.lineTo(x - FISH_WIDTH / 2 + 4, y + FISH_HEIGHT / 2);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = "#1b1b1b";
    ctx.fillRect(x + FISH_WIDTH / 2 - 7, y - 4, 3, 3);
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

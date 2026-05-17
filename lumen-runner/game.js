const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const panel = document.querySelector("#panel");
const startButton = document.querySelector("#start");
const scoreEl = document.querySelector("#score");
const comboEl = document.querySelector("#combo");
const livesEl = document.querySelector("#lives");

const state = {
  running: false,
  paused: false,
  won: false,
  score: 0,
  combo: 1,
  lives: 3,
  shake: 0,
  time: 0,
  particles: [],
  sparks: [],
  stars: [],
  bricks: [],
  keys: new Set(),
  pointerX: null,
};

const world = {
  w: 960,
  h: 600,
  paddle: { x: 420, y: 548, w: 132, h: 15, speed: 620, boost: 0 },
  ball: { x: 480, y: 430, r: 10, vx: 260, vy: -330, speed: 420 },
};

const colors = ["#48e5ff", "#ff5c8a", "#ffd166", "#78ffb7", "#c892ff"];

function fitCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  world.w = rect.width;
  world.h = rect.height;
  resetPositions(false);
}

function resetPositions(resetBall = true) {
  world.paddle.w = Math.max(96, Math.min(150, world.w * 0.14));
  world.paddle.h = Math.max(12, world.h * 0.025);
  world.paddle.y = world.h - Math.max(38, world.h * 0.08);
  world.paddle.x = (world.w - world.paddle.w) / 2;
  if (resetBall) {
    world.ball.x = world.w / 2;
    world.ball.y = world.paddle.y - 52;
    const direction = Math.random() > 0.5 ? 1 : -1;
    world.ball.vx = direction * world.ball.speed * 0.55;
    world.ball.vy = -world.ball.speed * 0.82;
  }
}

function makeStars() {
  state.stars = Array.from({ length: 86 }, () => ({
    x: Math.random() * world.w,
    y: Math.random() * world.h,
    r: Math.random() * 1.8 + 0.3,
    a: Math.random() * 0.55 + 0.2,
    s: Math.random() * 22 + 10,
  }));
}

function makeBricks() {
  const rows = 6;
  const cols = world.w < 650 ? 7 : 10;
  const gap = Math.max(6, world.w * 0.008);
  const margin = Math.max(18, world.w * 0.06);
  const top = Math.max(82, world.h * 0.16);
  const brickW = (world.w - margin * 2 - gap * (cols - 1)) / cols;
  const brickH = Math.max(22, world.h * 0.044);
  state.bricks = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const special = row === 1 && col % 4 === 1 ? "wide" : row === 3 && col % 5 === 2 ? "speed" : "normal";
      state.bricks.push({
        x: margin + col * (brickW + gap),
        y: top + row * (brickH + gap),
        w: brickW,
        h: brickH,
        hue: colors[(row + col) % colors.length],
        hp: row === 0 ? 2 : 1,
        type: special,
        pulse: Math.random() * Math.PI,
      });
    }
  }
}

function startGame() {
  state.running = true;
  state.paused = false;
  state.won = false;
  state.score = 0;
  state.combo = 1;
  state.lives = 3;
  state.shake = 0;
  state.particles = [];
  state.sparks = [];
  world.ball.speed = Math.min(450, world.w * 0.48);
  world.paddle.boost = 0;
  resetPositions(true);
  makeBricks();
  makeStars();
  panel.classList.add("hidden");
  syncHud();
}

function syncHud() {
  scoreEl.textContent = state.score;
  comboEl.textContent = `x${state.combo}`;
  livesEl.textContent = state.lives;
}

function endGame(won) {
  state.running = false;
  state.won = won;
  panel.classList.remove("hidden");
  panel.querySelector(".eyebrow").textContent = won ? "CLEARED" : "GAME OVER";
  panel.querySelector("h1").textContent = won ? "プリズム全壊。" : "光が落ちた。";
  panel.querySelector(".lead").textContent = won
    ? `Score ${state.score}。コンボを切らさず反射角を狙うと、もっと伸びます。`
    : `Score ${state.score}。パドルの端に当てるほど、鋭い角度で返せます。`;
  startButton.textContent = "Restart";
}

function spawnBurst(x, y, color, amount = 18) {
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 250 + 70;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: Math.random() * 0.45 + 0.35,
      ttl: 0.8,
      r: Math.random() * 3 + 1,
      color,
    });
  }
}

function addSpark(x, y, text, color) {
  state.sparks.push({ x, y, text, color, life: 0.75, ttl: 0.75 });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hitPaddle() {
  const paddle = world.paddle;
  const ball = world.ball;
  const center = paddle.x + paddle.w / 2;
  const offset = clamp((ball.x - center) / (paddle.w / 2), -1, 1);
  const speed = Math.hypot(ball.vx, ball.vy) * 1.012;
  ball.vx = offset * speed * 0.86;
  ball.vy = -Math.max(speed * (0.62 + Math.abs(offset) * 0.24), 260);
  ball.y = paddle.y - ball.r - 1;
  state.combo = Math.min(9, state.combo + 1);
  state.shake = 4;
  spawnBurst(ball.x, ball.y, "#f7fbff", 10);
  syncHud();
}

function hitBrick(brick) {
  const ball = world.ball;
  brick.hp -= 1;
  state.shake = 7;
  spawnBurst(ball.x, ball.y, brick.hue, brick.hp > 0 ? 12 : 26);

  if (brick.hp <= 0) {
    const gained = 100 * state.combo;
    state.score += gained;
    addSpark(brick.x + brick.w / 2, brick.y + brick.h / 2, `+${gained}`, brick.hue);

    if (brick.type === "wide") {
      world.paddle.boost = 9;
      addSpark(brick.x + brick.w / 2, brick.y, "WIDE", "#48e5ff");
    }

    if (brick.type === "speed") {
      ball.vx *= 1.12;
      ball.vy *= 1.12;
      addSpark(brick.x + brick.w / 2, brick.y, "FAST", "#ff5c8a");
    }
  } else {
    state.score += 40 * state.combo;
  }

  syncHud();
}

function update(dt) {
  if (!state.running || state.paused) return;

  state.time += dt;
  const paddle = world.paddle;
  const ball = world.ball;

  if (state.keys.has("ArrowLeft") || state.keys.has("KeyA")) paddle.x -= paddle.speed * dt;
  if (state.keys.has("ArrowRight") || state.keys.has("KeyD")) paddle.x += paddle.speed * dt;
  if (state.pointerX !== null) paddle.x += (state.pointerX - paddle.w / 2 - paddle.x) * Math.min(1, dt * 14);

  const baseW = Math.max(96, Math.min(150, world.w * 0.14));
  if (paddle.boost > 0) {
    paddle.boost -= dt;
    paddle.w = baseW * 1.35;
  } else {
    paddle.w += (baseW - paddle.w) * Math.min(1, dt * 8);
  }
  paddle.x = clamp(paddle.x, 10, world.w - paddle.w - 10);

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x < ball.r) {
    ball.x = ball.r;
    ball.vx = Math.abs(ball.vx);
    state.shake = 2;
  }
  if (ball.x > world.w - ball.r) {
    ball.x = world.w - ball.r;
    ball.vx = -Math.abs(ball.vx);
    state.shake = 2;
  }
  if (ball.y < ball.r) {
    ball.y = ball.r;
    ball.vy = Math.abs(ball.vy);
    state.shake = 2;
  }

  if (
    ball.vy > 0 &&
    ball.x + ball.r > paddle.x &&
    ball.x - ball.r < paddle.x + paddle.w &&
    ball.y + ball.r > paddle.y &&
    ball.y - ball.r < paddle.y + paddle.h
  ) {
    hitPaddle();
  }

  for (const brick of state.bricks) {
    if (
      brick.hp > 0 &&
      ball.x + ball.r > brick.x &&
      ball.x - ball.r < brick.x + brick.w &&
      ball.y + ball.r > brick.y &&
      ball.y - ball.r < brick.y + brick.h
    ) {
      const overlapX = Math.min(ball.x + ball.r - brick.x, brick.x + brick.w - (ball.x - ball.r));
      const overlapY = Math.min(ball.y + ball.r - brick.y, brick.y + brick.h - (ball.y - ball.r));
      if (overlapX < overlapY) ball.vx *= -1;
      else ball.vy *= -1;
      hitBrick(brick);
      break;
    }
  }

  state.bricks = state.bricks.filter((brick) => brick.hp > 0);
  if (state.bricks.length === 0) endGame(true);

  if (ball.y > world.h + 40) {
    state.lives -= 1;
    state.combo = 1;
    state.shake = 14;
    syncHud();
    if (state.lives <= 0) endGame(false);
    else resetPositions(true);
  }

  state.shake = Math.max(0, state.shake - 35 * dt);
  state.particles = state.particles.filter((particle) => {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 80 * dt;
    return particle.life > 0;
  });
  state.sparks = state.sparks.filter((spark) => {
    spark.life -= dt;
    spark.y -= 34 * dt;
    return spark.life > 0;
  });
}

function drawRoundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function draw() {
  ctx.clearRect(0, 0, world.w, world.h);
  const sx = (Math.random() - 0.5) * state.shake;
  const sy = (Math.random() - 0.5) * state.shake;
  ctx.save();
  ctx.translate(sx, sy);

  const bg = ctx.createLinearGradient(0, 0, world.w, world.h);
  bg.addColorStop(0, "#0b1421");
  bg.addColorStop(0.5, "#10131a");
  bg.addColorStop(1, "#211638");
  ctx.fillStyle = bg;
  ctx.fillRect(-20, -20, world.w + 40, world.h + 40);

  for (const star of state.stars) {
    star.y += star.s * 0.0009;
    if (star.y > world.h) star.y = 0;
    ctx.globalAlpha = star.a;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const paddle = world.paddle;
  const ball = world.ball;

  for (const brick of state.bricks) {
    brick.pulse += 0.025;
    const glow = 12 + Math.sin(brick.pulse) * 4;
    ctx.shadowColor = brick.hue;
    ctx.shadowBlur = glow;
    ctx.fillStyle = brick.hp > 1 ? "#f7fbff" : brick.hue;
    drawRoundedRect(brick.x, brick.y, brick.w, brick.h, 6);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(6, 9, 15, 0.28)";
    ctx.fillRect(brick.x + 4, brick.y + 4, brick.w - 8, 2);
    if (brick.type !== "normal") {
      ctx.fillStyle = brick.type === "wide" ? "#07101b" : "#ffffff";
      ctx.font = "800 11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(brick.type === "wide" ? "W" : "S", brick.x + brick.w / 2, brick.y + brick.h / 2 + 4);
    }
  }

  const paddleGradient = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x + paddle.w, paddle.y);
  paddleGradient.addColorStop(0, "#48e5ff");
  paddleGradient.addColorStop(0.5, "#f7fbff");
  paddleGradient.addColorStop(1, "#ff5c8a");
  ctx.shadowColor = "#48e5ff";
  ctx.shadowBlur = 22;
  ctx.fillStyle = paddleGradient;
  drawRoundedRect(paddle.x, paddle.y, paddle.w, paddle.h, 999);
  ctx.shadowBlur = 0;

  const ballGradient = ctx.createRadialGradient(ball.x - 3, ball.y - 4, 2, ball.x, ball.y, ball.r * 2.4);
  ballGradient.addColorStop(0, "#ffffff");
  ballGradient.addColorStop(0.35, "#48e5ff");
  ballGradient.addColorStop(1, "rgba(72, 229, 255, 0)");
  ctx.fillStyle = ballGradient;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();

  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.ttl);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const spark of state.sparks) {
    ctx.globalAlpha = Math.max(0, spark.life / spark.ttl);
    ctx.fillStyle = spark.color;
    ctx.font = "900 18px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(spark.text, spark.x, spark.y);
  }
  ctx.globalAlpha = 1;

  if (state.paused && state.running) {
    ctx.fillStyle = "rgba(6, 9, 15, 0.48)";
    ctx.fillRect(0, 0, world.w, world.h);
    ctx.fillStyle = "#f7fbff";
    ctx.font = "900 34px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", world.w / 2, world.h / 2);
  }

  ctx.restore();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

startButton.addEventListener("click", startGame);

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(event.code)) {
    state.keys.add(event.code);
    event.preventDefault();
  }
  if (event.code === "Space") {
    if (state.running) state.paused = !state.paused;
    else startGame();
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  state.keys.delete(event.code);
});

canvas.addEventListener("pointermove", (event) => {
  const rect = canvas.getBoundingClientRect();
  state.pointerX = event.clientX - rect.left;
});

canvas.addEventListener("pointerleave", () => {
  state.pointerX = null;
});

canvas.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  state.pointerX = event.clientX - rect.left;
  if (!state.running) startGame();
});

window.addEventListener("resize", () => {
  fitCanvas();
  makeStars();
  if (state.running) makeBricks();
});

fitCanvas();
makeStars();
makeBricks();
draw();
requestAnimationFrame(loop);

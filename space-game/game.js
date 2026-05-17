const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const uiOverlay = document.getElementById('ui-overlay');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const gameInfo = document.getElementById('game-info');
const finalStats = document.getElementById('final-stats');

// Assets
const shipImg = new Image(); shipImg.src = 'assets/ship.svg';
const noteImg = new Image(); noteImg.src = 'assets/note.svg';
const asteroidImg = new Image(); asteroidImg.src = 'assets/asteroid.svg';
const planetImg = new Image(); planetImg.src = 'assets/planet.svg';
const bgImg = new Image(); bgImg.src = 'assets/bg.png';

// Audio
const bgm = new Audio('Beyond_the_Seventh_Star.mp3');
bgm.loop = true;
let isMuted = false;

// Game state
let gameRunning = false;
let score = 0;
const maxCoins = 6;
let startTime = 0;
let lastTime = 0;
let particles = [];
let obstacles = [];
let coins = [];
let stars = [];
let idleAnimationId = null;

// Constants
const GRAVITY = 0.4;
const LIFT = -8;
const SHIP_SIZE = 60;
const COIN_SIZE = 40;
const OBSTACLE_WIDTH = 50;

const player = {
    x: 100,
    y: 0,
    vy: 0,
    width: SHIP_SIZE,
    height: SHIP_SIZE * 0.6,
    rotation: 0
};

// Handle window resize
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    createStarfield();
    if (!gameRunning) player.y = canvas.height / 2;
}
window.addEventListener('resize', resize);
resize();

// Input handling
function handleInput() {
    if (gameRunning) {
        player.vy = LIFT;
    }
}
window.addEventListener('keydown', (e) => { if (e.code === 'Space') handleInput(); });
window.addEventListener('mousedown', handleInput);
window.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(); }, { passive: false });

// Particle system for thrusters
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 7 + 2;
        this.vx = -Math.random() * 6 - 4;
        this.vy = (Math.random() - 0.5) * 2.4;
        this.life = 1.0;
        this.color = color;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.02;
    }
    draw() {
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2);
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, 'rgba(0, 242, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.globalAlpha = this.life;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

function createStarfield() {
    const count = Math.max(90, Math.floor((canvas.width * canvas.height) / 11000));
    stars = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.8 + 0.4,
        speed: Math.random() * 0.38 + 0.08,
        alpha: Math.random() * 0.65 + 0.25
    }));
}

function spawnObstacle() {
    const size = Math.random() * 100 + 50;
    obstacles.push({
        x: canvas.width,
        y: Math.random() * (canvas.height - size),
        w: size,
        h: size,
        speed: Math.random() * 2 + 3,
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.035
    });
}

function spawnCoin() {
    const size = Math.random() * 12 + COIN_SIZE;
    coins.push({
        x: canvas.width,
        y: Math.random() * (canvas.height - 100) + 50,
        w: size,
        h: size,
        speed: 3,
        pulse: Math.random() * Math.PI * 2
    });
}

function drawBackground(timestamp) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bgX = (timestamp * 0.035) % canvas.width;
    if (bgImg.complete && bgImg.naturalWidth > 0) {
        ctx.drawImage(bgImg, -bgX, 0, canvas.width, canvas.height);
        ctx.drawImage(bgImg, canvas.width - bgX, 0, canvas.width, canvas.height);
    }

    const vignette = ctx.createRadialGradient(
        canvas.width * 0.45,
        canvas.height * 0.45,
        canvas.height * 0.12,
        canvas.width * 0.5,
        canvas.height * 0.5,
        canvas.height * 0.85
    );
    vignette.addColorStop(0, 'rgba(20, 255, 255, 0.08)');
    vignette.addColorStop(0.5, 'rgba(6, 7, 22, 0.15)');
    vignette.addColorStop(1, 'rgba(2, 2, 8, 0.72)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const planetSize = Math.min(280, canvas.width * 0.34);
    const planetX = canvas.width - ((timestamp * 0.012) % (canvas.width + planetSize * 2)) - planetSize * 0.5;
    ctx.globalAlpha = 0.82;
    if (planetImg.complete && planetImg.naturalWidth > 0) {
        ctx.drawImage(planetImg, planetX, canvas.height * 0.1, planetSize, planetSize * 0.62);
    }
    ctx.globalAlpha = 1;

    stars.forEach((star) => {
        star.x -= star.speed;
        if (star.x < -4) {
            star.x = canvas.width + 4;
            star.y = Math.random() * canvas.height;
        }
        ctx.globalAlpha = star.alpha * (0.75 + Math.sin(timestamp * 0.003 + star.y) * 0.25);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function drawGlow(x, y, radius, color) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, color);
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

function drawHeroShip(timestamp) {
    const hover = Math.sin(timestamp * 0.002) * 12;
    const width = Math.min(180, canvas.width * 0.36);
    const height = width * 0.5;
    const x = Math.max(42, canvas.width * 0.18);
    const y = canvas.height * 0.62 + hover;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(timestamp * 0.0015) * 0.06);
    drawGlow(-width * 0.22, 0, width * 0.55, 'rgba(0, 242, 255, 0.2)');
    if (shipImg.complete && shipImg.naturalWidth > 0) {
        ctx.drawImage(shipImg, -width / 2, -height / 2, width, height);
    }
    ctx.restore();
}

function renderIdle(timestamp) {
    if (gameRunning) {
        idleAnimationId = null;
        return;
    }

    drawBackground(timestamp);
    drawHeroShip(timestamp);
    idleAnimationId = requestAnimationFrame(renderIdle);
}

function startIdleAnimation() {
    if (!idleAnimationId) {
        idleAnimationId = requestAnimationFrame(renderIdle);
    }
}

function updateGame(timestamp) {
    if (!gameRunning) return;

    const dt = timestamp - lastTime;
    lastTime = timestamp;

    // Timer
    const elapsed = Math.floor((timestamp - startTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    timerEl.innerText = `${m}:${s}`;

    // Player physics
    player.vy += GRAVITY;
    player.y += player.vy;
    player.rotation = player.vy * 0.05;

    // Bounds check
    if (player.y < 0) { player.y = 0; player.vy = 0; }
    if (player.y + player.height > canvas.height) endGame();

    // Spawn entities
    if (Math.random() < 0.015) spawnObstacle();
    if (Math.random() < 0.008 && coins.length < 3) spawnCoin();

    // Thruster particles
    if (Math.random() < 0.5) {
        particles.push(new Particle(player.x, player.y + player.height / 2, '#00f2ff'));
    }

    // Update & Collision
    drawBackground(timestamp);

    // Particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => { p.update(); p.draw(); });

    // Obstacles
    obstacles.forEach((o, i) => {
        o.x -= o.speed;
        o.rotation += o.spin;

        ctx.save();
        ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
        ctx.rotate(o.rotation);
        drawGlow(0, 0, o.w * 0.72, 'rgba(124, 92, 255, 0.22)');
        if (asteroidImg.complete && asteroidImg.naturalWidth > 0) {
            ctx.drawImage(asteroidImg, -o.w / 2, -o.h / 2, o.w, o.h);
        }
        ctx.restore();

        // Collision
        if (player.x < o.x + o.w && player.x + player.width > o.x &&
            player.y < o.y + o.h && player.y + player.height > o.y) {
            endGame();
        }
    });
    obstacles = obstacles.filter(o => o.x + o.w > 0);

    // Coins
    coins.forEach((c, i) => {
        c.x -= c.speed;
        c.pulse += 0.08;

        const scale = 1 + Math.sin(c.pulse) * 0.12;
        const drawW = c.w * scale;
        const drawH = c.h * scale;
        const drawX = c.x + (c.w - drawW) / 2;
        const drawY = c.y + (c.h - drawH) / 2;

        drawGlow(c.x + c.w / 2, c.y + c.h / 2, c.w * 1.25, 'rgba(255, 211, 56, 0.3)');
        if (noteImg.complete && noteImg.naturalWidth > 0) {
            ctx.drawImage(noteImg, drawX, drawY, drawW, drawH);
        }

        // Collision
        if (player.x < c.x + c.w && player.x + player.width > c.x &&
            player.y < c.y + c.h && player.y + player.height > c.y) {
            coins.splice(i, 1);
            score++;
            scoreEl.innerText = `${score} / ${maxCoins}`;
            if (score >= maxCoins) winGame();
        }
    });
    coins = coins.filter(c => c.x + c.w > 0);

    // Draw Player
    ctx.save();
    ctx.translate(player.x + player.width/2, player.y + player.height/2);
    ctx.rotate(player.rotation);
    drawGlow(-player.width * 0.25, 0, player.width * 0.8, 'rgba(0, 242, 255, 0.18)');
    if (shipImg.complete && shipImg.naturalWidth > 0) {
        ctx.drawImage(shipImg, -player.width/2, -player.height/2, player.width, player.height);
    }
    ctx.restore();

    requestAnimationFrame(updateGame);
}

function startGame() {
    gameRunning = true;
    idleAnimationId = null;
    score = 0;
    obstacles = [];
    coins = [];
    particles = [];
    player.y = canvas.height / 2;
    player.vy = 0;
    scoreEl.innerText = `0 / ${maxCoins}`;
    startTime = performance.now();
    lastTime = startTime;
    
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    gameInfo.classList.remove('hidden');
    
    // Start BGM if not muted
    if (!isMuted) {
        bgm.play().catch(e => console.log("Audio play failed:", e));
    }
    
    requestAnimationFrame(updateGame);
}

function endGame() {
    if (!gameRunning) return;
    gameRunning = false;
    finalStats.innerText = `最終スコア: ${score}枚のコインを集めました。`;
    gameOverScreen.classList.remove('hidden');
    startIdleAnimation();
}

function winGame() {
    gameRunning = false;
    finalStats.innerHTML = `<span style="color: var(--primary)">MISSION COMPLETE!</span><br>全ての音符を回収しました。`;
    gameOverScreen.classList.remove('hidden');
    startIdleAnimation();
}

document.getElementById('start-button').addEventListener('click', startGame);
document.getElementById('restart-button').addEventListener('click', startGame);

// Music Toggle
const musicToggle = document.getElementById('music-toggle');
musicToggle.addEventListener('click', () => {
    isMuted = !isMuted;
    if (isMuted) {
        bgm.pause();
        musicToggle.innerHTML = '<span>🔇</span>';
        musicToggle.classList.add('muted');
    } else {
        if (gameRunning) bgm.play();
        musicToggle.innerHTML = '<span>🔊</span>';
        musicToggle.classList.remove('muted');
    }
});

startIdleAnimation();

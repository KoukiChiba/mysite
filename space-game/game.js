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
const shipImg = new Image(); shipImg.src = 'assets/ship.png';
const coinImg = new Image(); coinImg.src = 'assets/coin.png';
const bgImg = new Image(); bgImg.src = 'assets/bg.png';

// Game state
let gameRunning = false;
let score = 0;
const maxCoins = 6;
let startTime = 0;
let lastTime = 0;
let particles = [];
let obstacles = [];
let coins = [];

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
        this.size = Math.random() * 5 + 2;
        this.vx = -Math.random() * 4 - 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.life = 1.0;
        this.color = color;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.02;
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

function spawnObstacle() {
    const size = Math.random() * 100 + 50;
    obstacles.push({
        x: canvas.width,
        y: Math.random() * (canvas.height - size),
        w: size,
        h: size,
        speed: Math.random() * 2 + 3,
        color: '#333'
    });
}

function spawnCoin() {
    coins.push({
        x: canvas.width,
        y: Math.random() * (canvas.height - 100) + 50,
        w: COIN_SIZE,
        h: COIN_SIZE,
        speed: 3
    });
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Background (Slight movement for parallax)
    const bgX = (timestamp * 0.05) % canvas.width;
    ctx.drawImage(bgImg, -bgX, 0, canvas.width, canvas.height);
    ctx.drawImage(bgImg, canvas.width - bgX, 0, canvas.width, canvas.height);

    // Particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => { p.update(); p.draw(); });

    // Obstacles
    obstacles.forEach((o, i) => {
        o.x -= o.speed;
        
        // Custom draw: Dark floating rocks with glow
        ctx.fillStyle = '#1a1a2e';
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.rect(o.x, o.y, o.w, o.h);
        ctx.fill();
        ctx.shadowBlur = 0;

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
        
        // Draw coin asset
        ctx.drawImage(coinImg, c.x, c.y, c.w, c.h);

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
    ctx.drawImage(shipImg, -player.width/2, -player.height/2, player.width, player.height);
    ctx.restore();

    requestAnimationFrame(updateGame);
}

function startGame() {
    gameRunning = true;
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
    
    requestAnimationFrame(updateGame);
}

function endGame() {
    if (!gameRunning) return;
    gameRunning = false;
    finalStats.innerText = `最終スコア: ${score}枚のコインを集めました。`;
    gameOverScreen.classList.remove('hidden');
}

function winGame() {
    gameRunning = false;
    finalStats.innerHTML = `<span style="color: var(--primary)">MISSION COMPLETE!</span><br>全ての音符を回収しました。`;
    gameOverScreen.classList.remove('hidden');
}

document.getElementById('start-button').addEventListener('click', startGame);
document.getElementById('restart-button').addEventListener('click', startGame);

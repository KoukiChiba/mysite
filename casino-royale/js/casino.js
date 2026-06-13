/* ===== SHARED GAME JS ===== */

// Global chip value
let selectedChip = 100;

// Balance management (localStorage)
function getBalance() {
  return parseInt(localStorage.getItem('casino_balance') || '10000');
}

function setBalance(val) {
  localStorage.setItem('casino_balance', Math.max(0, val));
  updateBalanceDisplays();
}

function updateBalanceDisplays() {
  const b = getBalance();
  document.querySelectorAll('.balance-amount').forEach(el => {
    el.textContent = '$' + b.toLocaleString();
  });
}

// Chip selector init
function initChipSelector(containerId, callback) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedChip = parseInt(chip.dataset.value);
      if (callback) callback(selectedChip);
    });
  });
  // Select 100 by default
  const def = container.querySelector('.chip[data-value="100"]');
  if (def) { def.classList.add('selected'); selectedChip = 100; }
}

// Toast notification
function showToast(msg, duration = 2500) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// Card deck utilities
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck(numDecks = 8) {
  const deck = [];
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ suit, rank });
      }
    }
  }
  return shuffle(deck);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardValue(card, forBaccarat = false) {
  if (forBaccarat) {
    if (['10', 'J', 'Q', 'K'].includes(card.rank)) return 0;
    if (card.rank === 'A') return 1;
    return parseInt(card.rank);
  }
  // Blackjack value
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  if (card.rank === 'A') return 11;
  return parseInt(card.rank);
}

function isRed(card) {
  return card.suit === '♥' || card.suit === '♦';
}

function renderCard(card, delay = 0) {
  const div = document.createElement('div');
  div.className = `card ${isRed(card) ? 'red' : 'black'} card-appear`;
  div.style.animationDelay = `${delay}ms`;
  div.innerHTML = `<div class="rank">${card.rank}</div><div class="suit">${card.suit}</div>`;
  return div;
}

function renderFaceDown() {
  const div = document.createElement('div');
  div.className = 'card face-down card-appear';
  return div;
}

// Common nav header HTML
function buildHeader(activePage) {
  const pages = [
    { href: 'index.html', label: 'ホーム' },
    { href: 'baccarat.html', label: 'バカラ' },
    { href: 'blackjack.html', label: 'ブラックジャック' },
    { href: 'roulette.html', label: 'ルーレット' },
    { href: 'sicbo.html', label: 'シックボー' },
    { href: 'dragontiger.html', label: 'ドラゴンタイガー' },
    { href: 'slot.html', label: 'スロット' },
  ];
  const links = pages.map(p =>
    `<li><a href="${p.href}" class="${p.href === activePage ? 'active' : ''}">${p.label}</a></li>`
  ).join('');
  return `
  <header class="site-header">
    <div class="header-inner">
      <a class="logo" href="index.html">🎰 Casino<span>Royale</span></a>
      <nav><ul class="nav-links">${links}</ul></nav>
      <div class="balance-bar">
        <span class="balance-icon">🪙</span>
        <span class="balance-amount">$${getBalance().toLocaleString()}</span>
      </div>
    </div>
  </header>`;
}

// Chip selector HTML
function chipSelectorHTML() {
  return `
  <div class="chip-selector" id="chipSelector">
    <div class="chip chip-1" data-value="1">$1</div>
    <div class="chip chip-5" data-value="5">$5</div>
    <div class="chip chip-25" data-value="25">$25</div>
    <div class="chip chip-100" data-value="100">$100</div>
    <div class="chip chip-500" data-value="500">$500</div>
    <div class="chip chip-1000" data-value="1000">$1K</div>
  </div>`;
}

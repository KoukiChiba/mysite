// State Management
let state = {
    currentMode: 'stock',
    initialTotalBalance: 1000000,
    availableJPY: 1000000,
    holdings: {
        stock: 0,
        fx: 0,
        crypto: 0
    },
    avgCost: { // 平均取得単価
        stock: 0,
        fx: 0,
        crypto: 0
    },
    prices: {
        stock: 5100,
        fx: 151.20,
        crypto: 9840000
    },
    volatility: {
        stock: 0.003,
        fx: 0.008,
        crypto: 0.025
    },
    labels: {
        stock: 'S&P 500 (米国株)',
        fx: '米ドル / 円 (USD/JPY)',
        crypto: 'ビットコイン (BTC)'
    },
    priceHistory: {
        stock: Array(25).fill(5100),
        fx: Array(25).fill(151.2),
        crypto: Array(25).fill(9840000)
    },
    assetHistory: {
        total: [1000000],
        stockVal: [0],
        fxVal: [0],
        cryptoVal: [0]
    }
};

let marketChart = null;
let smallCharts = { stock: null, fx: null, crypto: null };
let historyChart = null;
let currentView = 'single';
let historyRange = '1h';

// 期間 → 保持ティック数（3秒/tick）
const RANGE_POINTS = { '1h': 20, '1d': 80, '1w': 240, '1m': 720, 'all': Infinity };
const MAX_HISTORY  = 5000;

const getHistorySlice = (arr) => {
    const n = RANGE_POINTS[historyRange];
    return n === Infinity ? [...arr] : arr.slice(-Math.min(n, arr.length));
};

// --- Utility Functions ---
const hexToRgba = (hex, alpha) => {
    if (!hex || hex[0] !== '#') return `rgba(255,255,255,${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const formatPrice = (price, mode) => {
    if (mode === 'fx') return `¥${price.toFixed(2)}`;
    return `¥${Math.floor(price).toLocaleString()}`;
};

const animateNumber = (element, start, end) => {
    const duration = 800;
    const startTime = performance.now();
    const update = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(start + (end - start) * ease);
        element.innerText = current.toLocaleString();
        if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
};

// --- Chart Logic ---
const initChart = (canvasId, data, color) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, hexToRgba(color, 0.4));
    gradient.addColorStop(1, hexToRgba(color, 0));

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(data.length).fill(''),
            datasets: [{
                data: data,
                borderColor: color,
                borderWidth: 2,
                fill: true,
                backgroundColor: gradient,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: {
                    display: canvasId === 'marketChart',
                    grid: { color: 'rgba(30, 27, 75, 0.05)' },
                    ticks: { color: 'rgba(30, 27, 75, 0.38)', font: { size: 10 } }
                }
            },
            animation: { duration: 0 }
        }
    });
};

// --- UI Updates ---
const updateUI = () => {
    const total = calculateTotalAssets();
    const stockVal = state.holdings.stock * state.prices.stock;
    const fxVal = state.holdings.fx * state.prices.fx;
    const cryptoVal = state.holdings.crypto * state.prices.crypto;
    
    const balanceEl = document.getElementById('total-balance');
    const currentVal = parseInt(balanceEl.innerText.replace(/,/g, '') || '0');
    animateNumber(balanceEl, currentVal, Math.floor(total));

    // Asset Cards
    updateAssetCard('bal-stock', 'pct-stock', stockVal, state.holdings.stock, state.avgCost.stock, state.prices.stock);
    updateAssetCard('bal-fx', 'pct-fx', fxVal, state.holdings.fx, state.avgCost.fx, state.prices.fx);
    updateAssetCard('bal-crypto', 'pct-crypto', cryptoVal, state.holdings.crypto, state.avgCost.crypto, state.prices.crypto);
    
    document.getElementById('bal-cash').innerText = '¥' + Math.floor(state.availableJPY).toLocaleString();
    
    // Profit Badge
    const profitRatio = (total - state.initialTotalBalance) / state.initialTotalBalance;
    const profitPercent = (profitRatio * 100).toFixed(2);
    const badge = document.getElementById('total-profit-badge');
    badge.innerText = `${profitRatio >= 0 ? '+' : ''}${profitPercent}%`;
    badge.className = `hero-profit-badge ${profitRatio >= 0 ? 'profit-up' : 'profit-down'}`;

    // Price Display
    const priceVal = formatPrice(state.prices[state.currentMode], state.currentMode);
    const labelVal = state.labels[state.currentMode];

    document.getElementById('current-price').innerText = priceVal;
    document.getElementById('asset-label').innerText = labelVal;
    
    // Also update multi-view labels if they exist
    const multiPriceEl = document.getElementById('current-price-multi');
    const multiLabelEl = document.getElementById('asset-label-multi');
    if (multiPriceEl) multiPriceEl.innerText = priceVal;
    if (multiLabelEl) multiLabelEl.innerText = labelVal;

    updateVibe(total);
};

const updateAssetCard = (valId, pctId, value, holdings, avgCost, currentPrice) => {
    document.getElementById(valId).innerText = '¥' + Math.floor(value).toLocaleString();
    const pctEl = document.getElementById(pctId);
    if (holdings > 0 && avgCost > 0) {
        const profitRatio = (currentPrice - avgCost) / avgCost;
        const profitPercent = (profitRatio * 100).toFixed(2);
        pctEl.innerText = `${profitRatio >= 0 ? '+' : ''}${profitPercent}%`;
        pctEl.className = `mini-pct ${profitRatio >= 0 ? 'plus' : 'minus'}`;
    } else {
        pctEl.innerText = '';
    }
};

const updateVibe = (currentTotal) => {
    const profitRatio = (currentTotal - state.initialTotalBalance) / state.initialTotalBalance;
    const heroCard = document.querySelector('.hero-card');
    if (!heroCard) return;

    if (profitRatio >= 0.08) {
        heroCard.style.background = 'linear-gradient(140deg, #065F46 0%, #059669 55%, #10B981 100%)';
    } else if (profitRatio <= -0.08) {
        heroCard.style.background = 'linear-gradient(140deg, #7F1D1D 0%, #B91C1C 55%, #EF4444 100%)';
    } else {
        heroCard.style.background = 'linear-gradient(140deg, #4338CA 0%, #7C3AED 55%, #9333EA 100%)';
    }
};

// --- Mode & View Logic ---
const switchMode = (newMode) => {
    state.currentMode = newMode;
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === newMode);
    });

    if (marketChart) {
        // Use pre-tracked history for the current mode
        marketChart.data.datasets[0].data = [...state.priceHistory[newMode]];
        
        const colors = { stock: '#3b82f6', fx: '#8b5cf6', crypto: '#f59e0b' };
        const color = colors[newMode];
        marketChart.data.datasets[0].borderColor = color;
        
        const ctx = document.getElementById('marketChart').getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, hexToRgba(color, 0.4));
        gradient.addColorStop(1, hexToRgba(color, 0));
        marketChart.data.datasets[0].backgroundColor = gradient;
        
        marketChart.update();
    }
    updateUI();
};

const setupViewSwitching = () => {
    const tabs = document.querySelectorAll('.view-tab');
    const views = {
        single: document.getElementById('single-view'),
        multi: document.getElementById('multi-view'),
        history: document.getElementById('history-view')
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            currentView = tab.dataset.view;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            Object.values(views).forEach(v => v.classList.add('hidden'));
            views[currentView].classList.remove('hidden');

            if (currentView === 'multi') {
                initSmallCharts();
            } else if (currentView === 'history') {
                initHistoryChart();
            }
        });
    });

    document.querySelectorAll('.asset-card-small').forEach(card => {
        card.addEventListener('click', () => {
            switchMode(card.dataset.mode);
            updateSmallCardSelection();
        });
    });
};

const initHistoryChart = () => {
    if (!historyChart) {
        const canvas = document.getElementById('totalHistoryChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // 総資産ラインのグラデーション塗りつぶし
        const grad = ctx.createLinearGradient(0, 0, 0, 340);
        grad.addColorStop(0,   'rgba(67, 56, 202, 0.32)');
        grad.addColorStop(0.6, 'rgba(124, 58, 237, 0.08)');
        grad.addColorStop(1,   'rgba(124, 58, 237, 0)');

        historyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(getHistorySlice(state.assetHistory.total).length).fill(''),
                datasets: [
                    {
                        label: '総資産',
                        data: getHistorySlice(state.assetHistory.total),
                        borderColor: '#4338CA',
                        borderWidth: 2.5,
                        tension: 0.4,
                        pointRadius: 0,
                        fill: true,
                        backgroundColor: grad
                    },
                    {
                        label: '株式 (時価)',
                        data: getHistorySlice(state.assetHistory.stockVal),
                        borderColor: '#3b82f6',
                        borderWidth: 1.5,
                        borderDash: [4, 4],
                        tension: 0.4,
                        pointRadius: 0,
                        fill: false
                    },
                    {
                        label: 'FX (時価)',
                        data: getHistorySlice(state.assetHistory.fxVal),
                        borderColor: '#8b5cf6',
                        borderWidth: 1.5,
                        borderDash: [4, 4],
                        tension: 0.4,
                        pointRadius: 0,
                        fill: false
                    },
                    {
                        label: '暗号資産 (時価)',
                        data: getHistorySlice(state.assetHistory.cryptoVal),
                        borderColor: '#f59e0b',
                        borderWidth: 1.5,
                        borderDash: [4, 4],
                        tension: 0.4,
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: {
                        grid: { color: 'rgba(30, 27, 75, 0.04)' },
                        ticks: { color: 'rgba(30, 27, 75, 0.35)', font: { size: 10 } }
                    }
                },
                animation: { duration: 0 }
            }
        });
    }
    updateHistoryUI();
};

const updateHistoryUI = () => {
    const total = calculateTotalAssets();
    const pnl   = total - state.initialTotalBalance;
    const pnlPct = (pnl / state.initialTotalBalance * 100).toFixed(2);
    const history = state.assetHistory.total;
    const peak   = Math.max(...history);
    const trough = Math.min(...history.filter(v => v > 0));

    const fmt = v => '¥' + Math.floor(v).toLocaleString();
    const sign = pnl >= 0 ? '+' : '';

    document.getElementById('history-total-label').innerText = fmt(total);

    const pnlLabel = document.getElementById('history-pnl-label');
    const pnlPctEl = document.getElementById('history-pnl-pct');
    pnlLabel.innerText = sign + fmt(pnl);
    pnlPctEl.innerText = `${sign}${pnlPct}%`;
    const pnlClass = pnl >= 0 ? 'metric-value pnl-up' : 'metric-value pnl-down';
    pnlLabel.className = pnlClass;
    pnlPctEl.className = `metric-sub ${pnl >= 0 ? 'pnl-up' : 'pnl-down'}`;

    document.getElementById('history-peak-label').innerText   = fmt(peak);
    document.getElementById('history-trough-label').innerText = fmt(trough);
};

const calculateTotalAssets = () => {
    const stockVal = state.holdings.stock * state.prices.stock;
    const fxVal = state.holdings.fx * state.prices.fx;
    const cryptoVal = state.holdings.crypto * state.prices.crypto;
    return state.availableJPY + stockVal + fxVal + cryptoVal;
};

const initSmallCharts = () => {
    const colors = { stock: '#3b82f6', fx: '#8b5cf6', crypto: '#f59e0b' };
    Object.keys(smallCharts).forEach(mode => {
        if (!smallCharts[mode]) {
            // Use the shared priceHistory from state to ensure synchronization
            smallCharts[mode] = initChart(`chart-${mode}-sm`, [...state.priceHistory[mode]], colors[mode]);
        }
    });
    updateSmallCardSelection();
};

const updateSmallCardSelection = () => {
    document.querySelectorAll('.asset-card-small').forEach(card => {
        card.classList.toggle('active', card.dataset.mode === state.currentMode);
    });
};

const setupHistoryTabs = () => {
    document.querySelectorAll('.h-time-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            historyRange = tab.dataset.range;
            document.querySelectorAll('.h-time-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            if (historyChart) {
                const slice = getHistorySlice(state.assetHistory.total);
                historyChart.data.labels = Array(slice.length).fill('');
                historyChart.data.datasets[0].data = slice;
                historyChart.data.datasets[1].data = getHistorySlice(state.assetHistory.stockVal);
                historyChart.data.datasets[2].data = getHistorySlice(state.assetHistory.fxVal);
                historyChart.data.datasets[3].data = getHistorySlice(state.assetHistory.cryptoVal);
                historyChart.update('none');
            }
            updateHistoryUI();
        });
    });
};

// --- Transactions ---
const showToast = (message, type = 'success') => {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    toastMsg.innerText = message;
    toast.style.borderColor = type === 'danger' ? 'var(--danger)' : 'var(--success)';
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
};

const handleTrade = (type, manualAmount = null) => {
    let inputAmount = manualAmount;
    if (inputAmount === null) {
        const inputId = currentView === 'single' ? 'trade-amount' : 'trade-amount-multi';
        inputAmount = parseFloat(document.getElementById(inputId).value);
    }
    
    if (isNaN(inputAmount) || inputAmount <= 0) {
        alert('正しい金額を入力してください');
        return;
    }

    const price = state.prices[state.currentMode];
    if (type === 'buy') {
        if (inputAmount > state.availableJPY) {
            alert('残高が不足しています');
            return;
        }
        const qty = inputAmount / price;
        const currentQty = state.holdings[state.currentMode];
        const currentAvg = state.avgCost[state.currentMode];
        state.avgCost[state.currentMode] = (currentQty * currentAvg + inputAmount) / (currentQty + qty);
        state.availableJPY -= inputAmount;
        state.holdings[state.currentMode] += qty;
        showToast(`${state.labels[state.currentMode]} を ¥${Math.floor(inputAmount).toLocaleString()} 分購入`, 'success');
    } else {
        const value = state.holdings[state.currentMode] * price;
        if (inputAmount > value + 1) { // small floating error margin
            alert('保有額を超えています');
            return;
        }
        state.availableJPY += inputAmount;
        state.holdings[state.currentMode] -= inputAmount / price;
        if (state.holdings[state.currentMode] < 0.000001) {
            state.holdings[state.currentMode] = 0;
            state.avgCost[state.currentMode] = 0;
        }
        showToast(`${state.labels[state.currentMode]} を ¥${Math.floor(inputAmount).toLocaleString()} 分売却`, 'success');
    }
    document.getElementById('trade-amount').value = '';
    document.getElementById('trade-amount-multi').value = '';
    updateUI();
};

// --- Simulation Loop ---
setInterval(() => {
    let globalEffect = 1.0;
    if (Math.random() < 0.06) {
        const isNegative = Math.random() > 0.52;
        if (isNegative) {
            const ev = [{n:'世界金融危機',p:0.60},{n:'紛争勃発',p:0.70},{n:'大規模リセッション',p:0.65}][Math.floor(Math.random()*3)];
            globalEffect = ev.p;
            showToast(`【${ev.n}】全資産暴落！`, 'danger');
        } else {
            const ev = [{n:'AIバブル',p:1.6},{n:'経済対策',p:1.4},{n:'量的緩和発動',p:1.5}][Math.floor(Math.random()*3)];
            globalEffect = ev.p;
            showToast(`【${ev.n}】市場が熱狂中！`, 'success');
        }
    }

    Object.keys(state.prices).forEach(mode => {
        let mult = 1 + (Math.random() - 0.5) * state.volatility[mode] * 2;
        mult *= globalEffect;

        const config = { stock:0.10, fx:0.14, crypto:0.20 }[mode];
        if (Math.random() < config && globalEffect === 1.0) {
            const isS = Math.random() > 0.48;
            const mag = 1 + (isS ? 0.25 : -0.22);
            state.prices[mode] *= mag;
            showToast(`${state.labels[mode]} が${isS?'急上昇':'大暴落'}！`, isS?'success':'danger');
        } else {
            state.prices[mode] *= mult;
        }

        // --- Sync Histories ---
        state.priceHistory[mode].shift();
        state.priceHistory[mode].push(state.prices[mode]);

        const smPriceEl = document.getElementById(`price-${mode}-sm`);
        if (smPriceEl) smPriceEl.innerText = formatPrice(state.prices[mode], mode);
        
        if (smallCharts[mode]) {
            smallCharts[mode].data.datasets[0].data = [...state.priceHistory[mode]];
            smallCharts[mode].update('none');
        }
    });

    updateUI();
    const totalAssets = calculateTotalAssets();
    const stockVal = state.holdings.stock * state.prices.stock;
    const fxVal = state.holdings.fx * state.prices.fx;
    const cryptoVal = state.holdings.crypto * state.prices.crypto;
    
    // --- Update Global Asset History ---
    state.assetHistory.total.push(totalAssets);
    state.assetHistory.stockVal.push(stockVal);
    state.assetHistory.fxVal.push(fxVal);
    state.assetHistory.cryptoVal.push(cryptoVal);
    if (state.assetHistory.total.length > MAX_HISTORY) {
        state.assetHistory.total.shift();
        state.assetHistory.stockVal.shift();
        state.assetHistory.fxVal.shift();
        state.assetHistory.cryptoVal.shift();
    }

    if (historyChart) {
        const slice = getHistorySlice(state.assetHistory.total);
        historyChart.data.labels = Array(slice.length).fill('');
        historyChart.data.datasets[0].data = slice;
        historyChart.data.datasets[1].data = getHistorySlice(state.assetHistory.stockVal);
        historyChart.data.datasets[2].data = getHistorySlice(state.assetHistory.fxVal);
        historyChart.data.datasets[3].data = getHistorySlice(state.assetHistory.cryptoVal);

        if (currentView === 'history') {
            updateHistoryUI();
            historyChart.update('none');
        }
    }
    
    if (marketChart) {
        marketChart.data.datasets[0].data = [...state.priceHistory[state.currentMode]];
        
        const d = marketChart.data.datasets[0].data;
        const prev = d[d.length - 2]; 
        const curr = d[d.length - 1];
        const diff = curr - prev;
        const tag = document.getElementById('price-change');
        if (tag) {
            tag.innerText = (diff >= 0 ? '+' : '') + ((diff / prev) * 100).toFixed(2) + '%';
            tag.className = `change-tag ${diff >= 0 ? 'positive' : 'negative'}`;
        }
        marketChart.update('none');
    }
}, 3000);

// --- Entry Point ---
window.addEventListener('load', () => {
    lucide.createIcons();
    marketChart = initChart('marketChart', [...state.priceHistory.stock], '#3b82f6');
    setupViewSwitching();
    updateUI();

    document.querySelectorAll('.mode-tab').forEach(t => t.addEventListener('click', () => switchMode(t.dataset.mode)));
    document.getElementById('buy-btn').addEventListener('click', () => handleTrade('buy'));
    document.getElementById('sell-btn').addEventListener('click', () => handleTrade('sell'));
    document.getElementById('buy-btn-multi').addEventListener('click', () => handleTrade('buy'));
    document.getElementById('sell-btn-multi').addEventListener('click', () => handleTrade('sell'));
    setupHistoryTabs();
});

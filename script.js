window.__MORE_GAME_LOADED__ = true;

const ITEMS = [
    { name: '苹果', emoji: '🍎' },
    { name: '香蕉', emoji: '🍌' },
    { name: '草莓', emoji: '🍓' },
    { name: '葡萄', emoji: '🍇' }
];

const GAME_CONFIG = {
    totalRounds: 5,
    sfxEnabled: true,
    voiceEnabled: false
};

const els = {
    startScreen: document.getElementById('startScreen'),
    gameScreen: document.getElementById('gameScreen'),
    resultScreen: document.getElementById('resultScreen'),
    startBtn: document.getElementById('startBtn'),
    restartBtn: document.getElementById('restartBtn'),
    modeBtns: document.querySelectorAll('.mode-btn'),
    sfxToggle: document.getElementById('sfxToggle'),
    voiceToggle: document.getElementById('voiceToggle'),

    currentRound: document.getElementById('currentRound'),
    totalRounds: document.getElementById('totalRounds'),
    progressBar: document.getElementById('progressBar'),
    instructionText: document.getElementById('instructionText'),
    hintText: document.getElementById('hintText'),
    optionsContainer: document.getElementById('optionsContainer'),

    feedbackOverlay: document.getElementById('feedbackOverlay'),
    feedbackIcon: document.getElementById('feedbackIcon'),
    feedbackText: document.getElementById('feedbackText'),

    starsCount: document.getElementById('starsCount'),
    correctCount: document.getElementById('correctCount'),
    accuracyRate: document.getElementById('accuracyRate'),
    avgTime: document.getElementById('avgTime'),
    assessmentText: document.getElementById('assessmentText')
};

let gameState = createFreshState();

function createFreshState() {
    return {
        currentRound: 1,
        correctCount: 0,
        stars: 0,
        reactionTimes: [],
        locked: false,
        startAt: 0,
        currentCorrectButton: null
    };
}

document.addEventListener('DOMContentLoaded', () => {
    showOnly('start');
    els.feedbackOverlay.style.display = 'none';

    // 默认模式：5 轮
    setMode(5);
    setTogglesFromUI();
    bindEvents();
});

function bindEvents() {
    els.startBtn.onclick = startGame;
    els.restartBtn.onclick = startGame;

    els.modeBtns.forEach(btn => {
        btn.onclick = () => setMode(parseInt(btn.dataset.rounds, 10));
    });

    if (els.sfxToggle) els.sfxToggle.onchange = setTogglesFromUI;
    if (els.voiceToggle) els.voiceToggle.onchange = setTogglesFromUI;
}

function setMode(totalRounds) {
    GAME_CONFIG.totalRounds = totalRounds;
    els.totalRounds.textContent = String(totalRounds);
    els.modeBtns.forEach(b => b.classList.toggle('active', parseInt(b.dataset.rounds, 10) === totalRounds));
}

function setTogglesFromUI() {
    if (els.sfxToggle) GAME_CONFIG.sfxEnabled = !!els.sfxToggle.checked;
    if (els.voiceToggle) GAME_CONFIG.voiceEnabled = !!els.voiceToggle.checked;
}

function showOnly(which) {
    const showStart = which === 'start';
    const showGame = which === 'game';
    const showResult = which === 'result';

    els.startScreen.style.display = showStart ? 'block' : 'none';
    els.gameScreen.style.display = showGame ? 'block' : 'none';
    els.resultScreen.style.display = showResult ? 'block' : 'none';
}

function startGame() {
    setTogglesFromUI();
    gameState = createFreshState();
    showOnly('game');
    els.totalRounds.textContent = String(GAME_CONFIG.totalRounds);
    updateRoundUI();
    generateRound();
}

function updateRoundUI() {
    els.currentRound.textContent = String(gameState.currentRound);
    const pct = Math.round((gameState.currentRound / GAME_CONFIG.totalRounds) * 100);
    if (els.progressBar) els.progressBar.style.width = `${pct}%`;
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickCounts(round, totalRounds) {
    const t = totalRounds <= 1 ? 0 : (round - 1) / (totalRounds - 1);
    const maxCount = 4 + Math.round(t * 2); // 4 -> 6
    const minDiff = round <= Math.ceil(totalRounds * 0.6) ? 2 : 1;

    const bigger = randInt(2, maxCount);
    const maxDiff = Math.min(3, bigger - 1);
    const diff = randInt(minDiff, Math.max(minDiff, maxDiff));
    const smaller = bigger - diff;

    return { bigger, smaller, diff };
}

function generateRound() {
    gameState.locked = false;
    gameState.currentCorrectButton = null;
    els.optionsContainer.innerHTML = '';
    gameState.startAt = performance.now();

    const item = ITEMS[randInt(0, ITEMS.length - 1)];
    const { bigger, smaller, diff } = pickCounts(gameState.currentRound, GAME_CONFIG.totalRounds);
    const isBiggerOnLeft = Math.random() < 0.5;

    const leftCount = isBiggerOnLeft ? bigger : smaller;
    const rightCount = isBiggerOnLeft ? smaller : bigger;

    els.instructionText.textContent = `请点“更多”的：${item.emoji} ${item.name}`;
    if (els.hintText) {
        els.hintText.textContent = diff >= 2 ? '提示：可以先数一数～' : '提示：这次有点接近，慢慢看～';
    }

    const leftBtn = createOptionButton(leftCount, item.emoji, leftCount > rightCount);
    const rightBtn = createOptionButton(rightCount, item.emoji, rightCount > leftCount);
    els.optionsContainer.appendChild(leftBtn);
    els.optionsContainer.appendChild(rightBtn);

    speakIfEnabled(`请找更多的${item.name}`);
}

function createOptionButton(count, emoji, isCorrect) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option';
    btn.dataset.correct = isCorrect ? 'true' : 'false';
    btn.setAttribute('aria-label', `${count}个${emoji}`);

    const grid = document.createElement('div');
    grid.className = 'emoji-grid';
    for (let i = 0; i < count; i++) {
        const span = document.createElement('span');
        span.className = 'emoji';
        span.textContent = emoji;
        grid.appendChild(span);
    }
    btn.appendChild(grid);

    if (isCorrect) gameState.currentCorrectButton = btn;

    btn.onclick = () => handlePick(btn);
    return btn;
}

function handlePick(btn) {
    if (gameState.locked) return;
    gameState.locked = true;

    const ms = Math.max(0, Math.round(performance.now() - gameState.startAt));
    gameState.reactionTimes.push(ms);

    const correct = btn.dataset.correct === 'true';
    if (correct) {
        gameState.correctCount++;
        gameState.stars++;
    }

    // 禁用本轮所有按钮，给出“可学习”的视觉提示
    const all = Array.from(els.optionsContainer.querySelectorAll('button.option'));
    all.forEach(b => (b.disabled = true));
    btn.classList.add(correct ? 'correct' : 'wrong');
    if (gameState.currentCorrectButton) gameState.currentCorrectButton.classList.add('correct');

    showFeedback(correct);
    if (GAME_CONFIG.sfxEnabled) playSfx(correct ? 'good' : 'bad');
    speakIfEnabled(correct ? '太棒了' : '没关系，再试一次');

    setTimeout(() => {
        if (gameState.currentRound >= GAME_CONFIG.totalRounds) {
            endGame();
        } else {
            gameState.currentRound++;
            updateRoundUI();
            generateRound();
        }
    }, 1100);
}

function showFeedback(isCorrect) {
    els.feedbackIcon.textContent = isCorrect ? '⭐' : '🙂';
    els.feedbackText.textContent = isCorrect ? '太棒了！' : '没关系，我们再来～';
    els.feedbackOverlay.style.display = 'flex';
    setTimeout(() => (els.feedbackOverlay.style.display = 'none'), 900);
}

let audioCtx = null;
function playSfx(kind) {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.value = kind === 'good' ? 880 : 220;
        g.gain.value = 0.0001;
        o.connect(g);
        g.connect(audioCtx.destination);
        const now = audioCtx.currentTime;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'good' ? 0.14 : 0.20));
        o.start(now);
        o.stop(now + (kind === 'good' ? 0.16 : 0.22));
    } catch (_) {
        // 忽略音频异常（某些环境可能禁用）
    }
}

function speakIfEnabled(text) {
    if (!GAME_CONFIG.voiceEnabled) return;
    if (!('speechSynthesis' in window)) return;
    try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        u.rate = 0.95;
        u.pitch = 1.1;
        u.volume = 1;
        window.speechSynthesis.speak(u);
    } catch (_) {
        // 忽略
    }
}

function endGame() {
    showOnly('result');

    const total = GAME_CONFIG.totalRounds;
    const correct = gameState.correctCount;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const avgMs = gameState.reactionTimes.length
        ? Math.round(gameState.reactionTimes.reduce((a, b) => a + b, 0) / gameState.reactionTimes.length)
        : 0;
    const avgSec = (avgMs / 1000).toFixed(1);

    if (els.starsCount) els.starsCount.textContent = String(gameState.stars);
    els.correctCount.textContent = String(correct);
    els.accuracyRate.textContent = `${accuracy}%`;
    els.avgTime.textContent = `${avgSec}秒`;

    let assessment = '';
    if (accuracy >= 90) assessment = '超级棒！你一下就能看出哪边更多！';
    else if (accuracy >= 70) assessment = '很不错！再多练几次，会更快更准。';
    else if (accuracy >= 50) assessment = '不错的开始！可以慢慢数一数，再点“更多”的那边。';
    else assessment = '没关系～我们再玩一次，慢慢看、慢慢选就会进步。';
    els.assessmentText.textContent = assessment;
}

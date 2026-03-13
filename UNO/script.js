// === ГЕНЕРАТОР ЗВУКОВ (Web Audio API) ===
class SoundPlayer {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.init();
    }

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn("Web Audio not supported");
            this.ctx = null;
        }
    }

    ensureContext() {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    beep(freq = 440, duration = 0.1, type = 'square', volume = 0.1) {
        if (!this.enabled || !this.ctx) return;
        this.ensureContext();
        const oscillator = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        oscillator.type = type;
        oscillator.frequency.value = freq;
        gain.gain.value = volume;
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        oscillator.connect(gain);
        gain.connect(this.ctx.destination);
        oscillator.start();
        oscillator.stop(this.ctx.currentTime + duration);
    }

    cardPlace() {
        this.beep(350, 0.08, 'sine', 0.15);
    }

    cardDraw() {
        for (let i = 0; i < 3; i++) {
            setTimeout(() => this.beep(200 + i * 30, 0.04, 'sine', 0.1), i * 50);
        }
    }

    special() {
        this.beep(600, 0.15, 'square', 0.2);
    }

    win() {
        const notes = [523, 659, 784];
        notes.forEach((freq, i) => {
            setTimeout(() => this.beep(freq, 0.2, 'sine', 0.25), i * 200);
        });
    }

    lose() {
        const notes = [349, 311, 261];
        notes.forEach((freq, i) => {
            setTimeout(() => this.beep(freq, 0.2, 'sine', 0.2), i * 150);
        });
    }
}

const soundPlayer = new SoundPlayer();

function playSound(name) {
    if (soundPlayer.enabled && typeof soundPlayer[name] === 'function') {
        soundPlayer[name]();
    }
}

// === ИГРОВАЯ ЛОГИКА ===
const colors = ["red", "blue", "green", "yellow"];
const values = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "block", "reverse", "+2"];

let deck = [];
let playerHand = [];
let computerHands = [];
let discardPile = [];
let currentPlayer = "player";
let pendingDraw = 0;
let waitingForResponse = false;
let pendingWildCardIndex = null;
let skipNext = false;
let isReversed = false;
let isRespondingWithWild = false;
let computerFinished = [];
let numBots = 0;

function getCardContent(card) {
    if (card.color === 'wild') {
        if (card.value === '+4') {
            return '+4';
        }
        return 'W';
    }
    if (card.value === '+2') {
        return '+2';
    }
    if (card.value === 'block') {
        return '⊘';
    }
    if (card.value === 'reverse') {
        return '↻';
    }
    return card.value;
}

function createDeck() {
    deck = [];
    for (let color of colors) {
        for (let value of values) {
            deck.push({color, value});
            if (value !== "0") deck.push({color, value});
        }
    }
    for (let i = 0; i < 4; i++) {
        deck.push({color: "wild", value: "wild"});
        deck.push({color: "wild", value: "+4"});
    }
    shuffleDeck();
}

function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function dealCards() {
    playerHand = deck.splice(0, 7);
    computerHands = [];
    computerFinished = [];
    for (let i = 0; i < numBots; i++) {
        computerHands.push(deck.splice(0, 7));
        computerFinished.push(false);
    }
    discardPile = [deck.pop()];
    while (["block", "reverse", "+2", "wild", "+4"].includes(discardPile[0].value)) {
        deck.unshift(discardPile.pop());
        shuffleDeck();
        discardPile.push(deck.pop());
    }
    renderPlayerHand();
    renderOpponentArea();
    updateCenterPile();
}

function renderPlayerHand() {
    const el = document.getElementById("player-hand");
    if (!el) return;
    el.innerHTML = "";
    playerHand.forEach((card, index) => {
        const div = document.createElement("div");
        div.className = `card ${card.color}`;
        div.textContent = getCardContent(card);
        div.onclick = () => playCard(index);
        el.appendChild(div);
    });
}

function renderOpponentArea() {
    for (let i = 0; i < numBots; i++) {
        const el = document.getElementById(`opponent-${i + 1}-area`);
        if (!el) continue;
        el.innerHTML = "";
        computerHands[i].forEach(() => {
            const div = document.createElement("div");
            div.className = "opponent-card";
            el.appendChild(div);
        });
    }
}

function updateCenterPile() {
    const el = document.getElementById("center-pile");
    if (!el) return;
    const top = discardPile[discardPile.length - 1];
    el.className = `center-pile ${top.color}`;
    el.textContent = getCardContent(top);
}

function playCard(index) {
    if (!currentPlayer) return;
    if (index < 0 || index >= playerHand.length) return;

    const card = playerHand[index];
    const top = discardPile[discardPile.length - 1];

    if (waitingForResponse) {
        if (top.value === "+2" && card.value === "+2") {
            const played = playerHand.splice(index, 1)[0];
            discardPile.push(played);
            renderPlayerHand();
            updateCenterPile();
            pendingDraw += 2;
            playSound("special");
            if (checkWinner()) return;
            switchTurn();
        } else if (top.value === "+4" && card.value === "+4") {
            pendingWildCardIndex = index;
            isRespondingWithWild = true;
            document.getElementById("color-picker").style.display = "block";
        } else {
            alert("Нужно ответить +2/+4 или взять карты.");
        }
        return;
    }

    if (currentPlayer !== "player") return;

    if (card.color === top.color || card.value === top.value || card.color === "wild") {
        if (card.color === "wild") {
            pendingWildCardIndex = index;
            isRespondingWithWild = false;
            document.getElementById("color-picker").style.display = "block";
            return;
        }

        const played = playerHand.splice(index, 1)[0];
        discardPile.push(played);
        renderPlayerHand();
        updateCenterPile();

        if (["block", "reverse", "+2", "+4"].includes(played.value)) {
            playSound("special");
        } else {
            playSound("cardPlace");
        }

        if (checkWinner()) return;

        if (played.value === "+2") {
            pendingDraw = 2;
            waitingForResponse = true;
        } else if (played.value === "+4") {
            pendingDraw = 4;
            waitingForResponse = true;
        } else if (played.value === "block") {
            skipNext = true;
        } else if (played.value === "reverse") {
            isReversed = !isReversed;
        }
        switchTurn();
    } else {
        alert("Неверная карта!");
    }
}

document.querySelectorAll(".color-option").forEach(option => {
    option.addEventListener("click", () => {
        const chosenColor = option.getAttribute("data-color");
        const index = pendingWildCardIndex;

        if (index !== null && index >= 0 && index < playerHand.length) {
            const played = playerHand.splice(index, 1)[0];
            played.color = chosenColor;
            discardPile.push(played);

            renderPlayerHand();
            updateCenterPile();

            if (played.value === "+4") {
                playSound("special");
            } else {
                playSound("cardPlace");
            }

            if (checkWinner()) {
                document.getElementById("color-picker").style.display = "none";
                pendingWildCardIndex = null;
                isRespondingWithWild = false;
                return;
            }

            if (isRespondingWithWild) {
                isRespondingWithWild = false;
                pendingDraw += 4;
            } else {
                if (played.value === "+2") {
                    pendingDraw = 2;
                    waitingForResponse = true;
                } else if (played.value === "+4") {
                    pendingDraw = 4;
                    waitingForResponse = true;
                } else if (played.value === "block") {
                    skipNext = true;
                } else if (played.value === "reverse") {
                    isReversed = !isReversed;
                }
            }
            switchTurn();
        }

        document.getElementById("color-picker").style.display = "none";
        pendingWildCardIndex = null;
        isRespondingWithWild = false;
    });
});

function switchTurn() {
    const players = ["player", ...Array.from({length: numBots}, (_, i) => `computer${i + 1}`)];
    let currentIndex = players.indexOf(currentPlayer);

    do {
        if (skipNext) {
            skipNext = false;
            currentIndex = isReversed ? (currentIndex - 2 + players.length) % players.length : (currentIndex + 2) % players.length;
        } else {
            currentIndex = isReversed ? (currentIndex - 1 + players.length) % players.length : (currentIndex + 1) % players.length;
        }
        currentPlayer = players[currentIndex];
    } while (currentPlayer.startsWith('computer') && computerFinished[parseInt(currentPlayer.replace('computer', '')) - 1]);

    if (currentPlayer.startsWith("computer")) {
        setTimeout(computerTurn, 800);
    }
}

function computerTurn() {
    if (!currentPlayer.startsWith("computer")) return;
    if (!currentPlayer) return;

    const botIndex = parseInt(currentPlayer.replace('computer', '')) - 1;
    const computerHand = computerHands[botIndex];
    const top = discardPile[discardPile.length - 1];

    if (waitingForResponse) {
        let idx = -1;
        if (top.value === "+2") idx = computerHand.findIndex(c => c.value === "+2");
        else if (top.value === "+4") idx = computerHand.findIndex(c => c.value === "+4");

        if (idx !== -1) {
            const card = computerHand.splice(idx, 1)[0];
            discardPile.push(card);
            renderOpponentArea();
            updateCenterPile();

            if (card.value === "+2") pendingDraw += 2;
            else if (card.value === "+4") pendingDraw += 4;

            playSound("special");
            if (checkWinner()) {
                currentPlayer = null;
                return;
            }
        } else {
            playSound("cardDraw");
            for (let i = 0; i < pendingDraw && deck.length > 0; i++) {
                computerHand.push(deck.pop());
            }
            renderOpponentArea();
            pendingDraw = 0;
            waitingForResponse = false;
        }
        switchTurn();
        return;
    }

    let idx = computerHand.findIndex(c => (c.value === "block" || c.value === "reverse") && c.color === top.color);
    if (idx === -1) idx = computerHand.findIndex(c => c.color === top.color);
    if (idx === -1) idx = computerHand.findIndex(c => c.value === top.value);
    if (idx === -1) idx = computerHand.findIndex(c => c.color === "wild");

    if (idx !== -1) {
        const card = computerHand.splice(idx, 1)[0];
        if (card.color === "wild") {
            card.color = colors[Math.floor(Math.random() * colors.length)];
        }
        discardPile.push(card);
        renderOpponentArea();
        updateCenterPile();

        if (["block", "reverse", "+2", "+4"].includes(card.value)) {
            playSound("special");
        } else {
            playSound("cardPlace");
        }

        if (checkWinner()) {
            currentPlayer = null;
            return;
        }

        if (card.value === "+2") {
            pendingDraw = 2;
            waitingForResponse = true;
        } else if (card.value === "+4") {
            pendingDraw = 4;
            waitingForResponse = true;
        } else if (card.value === "block") {
            skipNext = true;
        } else if (card.value === "reverse") {
            isReversed = !isReversed;
        }
    } else {
        playSound("cardDraw");
        if (deck.length > 0) {
            computerHand.push(deck.pop());
            renderOpponentArea();
        }
    }

    if (checkWinner()) {
        currentPlayer = null;
        return;
    }
    switchTurn();
}

function checkWinner() {
    if (playerHand.length === 0) {
        showGameOver("Вы выиграли! 🎉");
        playSound("win");
        return true;
    }
    for (let i = 0; i < numBots; i++) {
        if (computerHands[i].length === 0 && !computerFinished[i]) {
            computerFinished[i] = true;
        }
    }
    if (computerFinished.every(f => f)) {
        showGameOver("Боты выиграли! 😢");
        playSound("lose");
        return true;
    }
    return false;
}

function showGameOver(message) {
    document.getElementById("game-over-message").textContent = message;
    document.getElementById("game-over").style.display = "flex";
    currentPlayer = null;
}

function restartGame() {
    document.getElementById("game-over").style.display = "none";
    document.getElementById("color-picker").style.display = "none";
    pendingWildCardIndex = null;
    skipNext = false;
    isReversed = false;
    pendingDraw = 0;
    waitingForResponse = false;
    isRespondingWithWild = false;
    computerFinished = [];
    createDeck();
    dealCards();
    currentPlayer = "player";
}

document.querySelectorAll('.bot-options .btn').forEach(button => {
    button.addEventListener('click', () => {
        numBots = parseInt(button.dataset.bots);
        document.getElementById('bot-selection-screen').style.display = 'none';
        document.getElementById('game').style.display = 'block';
        document.getElementById('game-title').textContent = `UNO vs ${numBots} BOTS`;
        for (let i = 0; i < 3; i++) {
            document.getElementById(`opponent-${i + 1}-area`).style.display = i < numBots ? 'flex' : 'none';
        }
        restartGame();
    });
});

document.getElementById("draw-card")?.addEventListener("click", () => {
    if (!currentPlayer) return;

    playSound("cardDraw");

    if (waitingForResponse) {
        for (let i = 0; i < pendingDraw && deck.length > 0; i++) {
            playerHand.push(deck.pop());
        }
        renderPlayerHand();
        pendingDraw = 0;
        waitingForResponse = false;
    } else {
        if (deck.length > 0) {
            playerHand.push(deck.pop());
            renderPlayerHand();
        }
    }
    switchTurn();
});

document.getElementById("settings-btn")?.addEventListener("click", () => {
    document.getElementById("settings-menu").style.display = "block";
});
document.getElementById("close-settings")?.addEventListener("click", () => {
    document.getElementById("settings-menu").style.display = "none";
});

document.getElementById("new-game-btn")?.addEventListener("click", () => {
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('game').style.display = 'none';
    document.getElementById('bot-selection-screen').style.display = 'flex';
});

// === ЗАПУСК ===
window.addEventListener("load", () => {
    const soundToggle = document.getElementById("sound-toggle");
    soundPlayer.enabled = localStorage.getItem("unoSound") !== "false";
    soundToggle.checked = soundPlayer.enabled;
    soundToggle.addEventListener("change", () => {
        soundPlayer.enabled = soundToggle.checked;
        localStorage.setItem("unoSound", soundPlayer.enabled);
    });
});
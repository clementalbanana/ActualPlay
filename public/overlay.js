const socket = io();

const playerContainer = document.getElementById('player-container');
const diceRollDisplay = document.getElementById('dice-roll-display');
const projectedImage = document.getElementById('projected-image');

// Éléments du Boss
const bossContainer = document.getElementById('boss-container');
const bossNameEl = document.getElementById('boss-name');
const bossArmorEl = document.getElementById('boss-armor');
const bossHpBar = document.getElementById('boss-hp-bar');
const bossHpText = document.getElementById('boss-hp-text');

// --- Gestion des Joueurs ---

function createPlayerCard(player) {
    const card = document.createElement('div');
    card.className = 'player-card';
    card.id = `player-${player.id}`;

    const hpPercentage = (player.hp / player.maxHp) * 100;

    card.innerHTML = `
        <h3>${player.name}</h3>
        <div class="hp-bar-container">
            <div class="hp-bar" style="width: ${hpPercentage}%;"></div>
            <span class="hp-text">${player.hp} / ${player.maxHp}</span>
        </div>
        <div class="player-stats">
            <span class="stat">Armure: <span class="stat-value armor-value">${player.armor}</span></span>
            <span class="stat">Or: <span class="stat-value gold-value">${player.gold}</span></span>
        </div>
    `;
    return card;
}

function updatePlayerCard(player) {
    const card = document.getElementById(`player-${player.id}`);
    if (!card) return;

    const hpPercentage = (player.hp / player.maxHp) * 100;

    card.querySelector('h3').innerText = player.name;
    card.querySelector('.hp-bar').style.width = `${hpPercentage}%`;
    card.querySelector('.hp-text').innerText = `${player.hp} / ${player.maxHp}`;
    
    // Mise à jour ciblée avec les nouvelles classes
    const armorEl = card.querySelector('.armor-value');
    if (armorEl) armorEl.innerText = player.armor;
    
    const goldEl = card.querySelector('.gold-value');
    if (goldEl) goldEl.innerText = player.gold;
}


// --- Gestion du Boss ---

function updateBoss(bossData) {
    if (!bossData) return;

    bossNameEl.innerText = bossData.name;
    bossArmorEl.innerText = bossData.armor;

    const hpPercentage = Math.max(0, Math.min(100, (bossData.hp / bossData.maxHp) * 100));
    bossHpBar.style.width = `${hpPercentage}%`;
    bossHpText.innerText = `${bossData.hp} / ${bossData.maxHp}`;

    // Animation de mort si PV <= 0
    if (bossData.hp <= 0) {
        if (!bossContainer.classList.contains('boss-dead')) {
            bossContainer.classList.add('boss-dead');
        }
    } else {
        // Réinitialiser si le boss est soigné ou changé
        bossContainer.classList.remove('boss-dead');
    }
}


// --- Gestion des Lancers de Dés ---

function showDiceRoll(data) {
    const notification = document.createElement('div');
    notification.className = 'dice-notification';
    notification.innerHTML = `
        <div class="player-name">${data.player} lance un ${data.dice}</div>
        <div class="dice-result">${data.result}</div>
    `;
    diceRollDisplay.appendChild(notification);

    // La notification se détruit d'elle-même après l'animation
    setTimeout(() => {
        notification.remove();
    }, 5000); // 5 secondes, comme la durée de l'animation CSS
}


// --- Gestion des Images ---

function showImage(imageUrl) {
    if (imageUrl) {
        projectedImage.src = imageUrl;
        projectedImage.classList.add('visible');
    } else {
        // Si l'URL est vide, on cache l'image
        projectedImage.classList.remove('visible');
    }
}

function hideImage() {
    projectedImage.classList.remove('visible');
    // On attend la fin de la transition pour vider la source (optionnel mais propre)
    setTimeout(() => {
        if (!projectedImage.classList.contains('visible')) {
            projectedImage.src = "";
        }
    }, 700); // Correspond à la durée de transition CSS (0.7s)
}


// --- Écouteurs Socket.io ---

socket.on('gameStateUpdate', (gameState) => {
    // Mettre à jour les joueurs
    gameState.players.forEach(player => {
        const existingCard = document.getElementById(`player-${player.id}`);
        if (existingCard) {
            updatePlayerCard(player);
        } else {
            const newCard = createPlayerCard(player);
            playerContainer.appendChild(newCard);
        }
    });

    // Supprimer les joueurs qui ne sont plus dans le gameState
    const currentPlayerIds = gameState.players.map(p => `player-${p.id}`);
    Array.from(playerContainer.children).forEach(card => {
        if (!currentPlayerIds.includes(card.id)) {
            card.remove();
        }
    });

    // Mettre à jour le boss
    if (gameState.boss) {
        updateBoss(gameState.boss);
    }
});

socket.on('diceRolled', (data) => {
    showDiceRoll(data);
});

socket.on('showImage', (imageUrl) => {
    showImage(imageUrl);
});

socket.on('hideImage', () => {
    hideImage();
});

socket.on('diceCleared', () => {
    // On pourrait ajouter une animation de "nettoyage" ici si on voulait
});

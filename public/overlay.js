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
    
    // Le contenu sera rempli par updatePlayerCard
    return card;
}

function updatePlayerCard(player) {
    let card = document.getElementById(`player-${player.id}`);
    if (!card) {
        card = createPlayerCard(player);
        playerContainer.appendChild(card);
    }

    const hpPercentage = (player.hp / player.maxHp) * 100;

    // Génération dynamique des stats personnalisées sous forme de barres
    let customStatsHtml = '';
    if (player.customStats && player.customStats.length > 0) {
        customStatsHtml = player.customStats.map(stat => {
            // Calcul du pourcentage, sécurisé entre 0 et 100
            const statPercentage = Math.min(100, Math.max(0, (stat.current / stat.max) * 100));
            
            return `
            <div class="custom-stat-container">
                <div class="custom-stat-label">${stat.name}</div>
                <div class="custom-stat-bar-bg">
                    <div class="custom-stat-bar-fill" style="width: ${statPercentage}%;"></div>
                    <span class="custom-stat-text">${stat.current} / ${stat.max}</span>
                </div>
            </div>
            `;
        }).join('');
    }

    card.innerHTML = `
        <h3>${player.name}</h3>
        <div class="hp-bar-container">
            <div class="hp-bar" style="width: ${hpPercentage}%;"></div>
            <span class="hp-text">${player.hp} / ${player.maxHp}</span>
        </div>
        
        <div class="player-stats-row">
            <span class="stat">Armure: <span class="stat-value armor-value">${player.armor}</span></span>
            <span class="stat">Or: <span class="stat-value gold-value">${player.gold}</span></span>
        </div>

        <div class="custom-stats-section">
            ${customStatsHtml}
        </div>
    `;
}


// --- Gestion du Boss ---

function updateBoss(bossData) {
    if (!bossData) return;

    bossNameEl.innerText = bossData.name;
    bossArmorEl.innerText = bossData.armor;

    const hpPercentage = Math.max(0, Math.min(100, (bossData.hp / bossData.maxHp) * 100));
    bossHpBar.style.width = `${hpPercentage}%`;
    bossHpText.innerText = `${bossData.hp} / ${bossData.maxHp}`;

    if (bossData.hp <= 0) {
        if (!bossContainer.classList.contains('boss-dead')) {
            bossContainer.classList.add('boss-dead');
        }
    } else {
        bossContainer.classList.remove('boss-dead');
    }
}


// --- Gestion des Lancers de Dés (2D) ---

function showDiceResult(data) {
    // Création de la notification complète
    const notification = document.createElement('div');
    notification.className = 'dice-notification';
    
    // Construction du contenu HTML
    let detailsHtml = '';
    if (data.results && data.results.length > 0) {
        // Grouper les résultats par type de dé
        const groups = {};
        data.results.forEach(r => {
            if (!groups[r.type]) groups[r.type] = [];
            groups[r.type].push(r.value);
        });

        // Construire la chaîne HTML des détails
        detailsHtml = Object.keys(groups).map(type => {
            const values = groups[type].join(', ');
            return `<span class="dice-group ${type}">[${values}]</span>`;
        }).join(' + ');
    }

    notification.innerHTML = `
        <div class="player-name">${data.player}</div>
        <div class="dice-total-score">${data.total}</div>
        <div class="dice-details">${detailsHtml}</div>
    `;

    // Ajout au conteneur
    diceRollDisplay.appendChild(notification);

    // Suppression automatique après 5 secondes
    setTimeout(() => {
        notification.remove();
    }, 5000);
}


// --- Gestion des Images ---

function showImage(imageUrl) {
    if (imageUrl) {
        projectedImage.src = imageUrl;
        projectedImage.classList.add('visible');
    } else {
        projectedImage.classList.remove('visible');
    }
}

function hideImage() {
    projectedImage.classList.remove('visible');
    setTimeout(() => {
        if (!projectedImage.classList.contains('visible')) {
            projectedImage.src = "";
        }
    }, 700);
}


// --- Écouteurs Socket.io ---

socket.on('gameStateUpdate', (gameState) => {
    // Mettre à jour les joueurs
    gameState.players.forEach(player => {
        updatePlayerCard(player);
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
    showDiceResult(data);
});

socket.on('showImage', (imageUrl) => {
    showImage(imageUrl);
});

socket.on('hideImage', () => {
    hideImage();
});

socket.on('diceCleared', () => {
    diceRollDisplay.innerHTML = '';
});

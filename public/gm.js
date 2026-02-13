const socket = io();

// --- Fonctions Utilitaires ---
function debounce(func, delay = 300) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// --- Gestion du Boss ---
const bossInputs = ['boss_name', 'boss_hp_current', 'boss_hp_max', 'boss_armor'];
const getBossStats = () => ({
    name: document.getElementById('boss_name').value,
    hp: parseInt(document.getElementById('boss_hp_current').value, 10),
    maxHp: parseInt(document.getElementById('boss_hp_max').value, 10),
    armor: parseInt(document.getElementById('boss_armor').value, 10),
});

const sendBossUpdate = debounce(() => {
    socket.emit('updateBoss', getBossStats());
});

bossInputs.forEach(id => {
    document.getElementById(id).addEventListener('input', sendBossUpdate);
});

// --- Lancer de Dés du MJ ---
const gmDiceButtons = document.querySelectorAll('.dice-btn-gm');
const gmRollerNameInput = document.getElementById('gm_roller_name');

function gmRollDice(sides) {
    const result = Math.floor(Math.random() * sides) + 1;
    const rollerName = gmRollerNameInput.value || 'MJ'; // Utilise 'MJ' si le champ est vide
    socket.emit('rollDice', {
        player: rollerName,
        dice: `d${sides}`,
        result: result
    });
}

gmDiceButtons.forEach(button => {
    button.addEventListener('click', () => {
        const sides = button.dataset.dice;
        gmRollDice(sides);
    });
});


// --- Gestion des Images ---
const imageList = document.getElementById('image-list');

function projectImage(imageUrl) {
    socket.emit('projectImage', imageUrl);
}

// Demander la liste des images au serveur au chargement
socket.emit('listImages');

socket.on('imageList', (images) => {
    imageList.innerHTML = ''; // On vide la liste
    images.forEach(image => {
        const imgElement = document.createElement('img');
        imgElement.src = `images/${image}`;
        imgElement.alt = image;
        imgElement.className = 'cursor-pointer rounded-lg hover:ring-2 hover:ring-indigo-500';
        imgElement.addEventListener('click', () => projectImage(`images/${image}`));
        imageList.appendChild(imgElement);
    });
});


// --- Journal des Dés ---
const diceLog = document.getElementById('dice-log');
const resetDiceButton = document.getElementById('reset-dice');

resetDiceButton.addEventListener('click', () => {
    socket.emit('resetDice');
});

socket.on('diceRolled', (data) => {
    const li = document.createElement('li');
    li.className = 'text-gray-300';
    li.innerHTML = `<span class="font-semibold text-indigo-300">${data.player}</span> lance un <span class="font-bold">${data.dice}</span> et obtient <span class="font-bold text-xl text-white">${data.result}</span>.`;
    diceLog.prepend(li); // Ajoute en haut de la liste
});

// Le serveur peut nous dire de vider le log
socket.on('diceCleared', () => {
    diceLog.innerHTML = '';
});


// --- Synchronisation Initiale ---
socket.on('gameStateUpdate', (gameState) => {
    // Pré-remplir les champs du boss
    const boss = gameState.boss;
    if (boss) {
        document.getElementById('boss_name').value = boss.name || '';
        document.getElementById('boss_hp_current').value = boss.hp || '';
        document.getElementById('boss_hp_max').value = boss.maxHp || '';
        document.getElementById('boss_armor').value = boss.armor || '';
    }
});
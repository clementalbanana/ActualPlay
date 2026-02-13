const socket = io();

// --- Fonctions ---

// Debounce pour limiter la fréquence des mises à jour
function debounce(func, delay = 250) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// Récupérer les stats du formulaire
function getStats() {
    return {
        name: document.getElementById('name').value,
        hp_current: document.getElementById('hp_current').value,
        hp_max: document.getElementById('hp_max').value,
        armor: document.getElementById('armor').value,
        gold: document.getElementById('gold').value,
    };
}

// Envoyer les stats au serveur
const sendStatsUpdate = debounce(() => {
    const stats = getStats();
    if (stats.name) { // On n'envoie que si le nom est défini
        socket.emit('updateStats', stats);
    }
});

// Lancer un dé
function rollDice(sides) {
    const result = Math.floor(Math.random() * sides) + 1;
    const playerName = document.getElementById('name').value || 'Un joueur';
    socket.emit('rollDice', {
        player: playerName,
        dice: `d${sides}`,
        result: result
    });
}


// --- Écouteurs d'événements ---

// Champs de saisie
const inputs = document.querySelectorAll('input');
inputs.forEach(input => {
    input.addEventListener('input', sendStatsUpdate);
});

// Boutons de dés
const diceButtons = document.querySelectorAll('.dice-btn');
diceButtons.forEach(button => {
    button.addEventListener('click', () => {
        const sides = button.dataset.dice;
        rollDice(sides);
    });
});

// --- Réception des données du serveur (pour synchroniser si nécessaire) ---
socket.on('updateStats', (stats) => {
    // On met à jour l'interface uniquement si les données sont différentes
    // pour éviter de perturber la saisie de l'utilisateur.
    if (document.getElementById('name').value !== stats.name) {
        document.getElementById('name').value = stats.name;
    }
    if (document.getElementById('hp_current').value !== stats.hp_current) {
        document.getElementById('hp_current').value = stats.hp_current;
    }
    if (document.getElementById('hp_max').value !== stats.hp_max) {
        document.getElementById('hp_max').value = stats.hp_max;
    }
     if (document.getElementById('armor').value !== stats.armor) {
        document.getElementById('armor').value = stats.armor;
    }
     if (document.getElementById('gold').value !== stats.gold) {
        document.getElementById('gold').value = stats.gold;
    }
});

const socket = io();

// --- Éléments du DOM ---
const nameInput = document.getElementById('name');
const hpCurrentInput = document.getElementById('hp_current');
const hpMaxInput = document.getElementById('hp_max');
const armorInput = document.getElementById('armor');
const goldInput = document.getElementById('gold');
const allInputs = [hpCurrentInput, hpMaxInput, armorInput, goldInput];
const diceButtons = document.querySelectorAll('.dice-btn');

// --- État Local ---
let characterClaimed = false;

// --- Fonctions ---

function debounce(func, delay = 300) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Met à jour le formulaire avec les données reçues
function updateForm(player) {
    hpCurrentInput.value = player.hp;
    hpMaxInput.value = player.maxHp;
    armorInput.value = player.armor;
    goldInput.value = player.gold;
}

// Récupère les stats du formulaire pour l'envoi
function getStats() {
    return {
        hp_current: hpCurrentInput.value,
        hp_max: hpMaxInput.value,
        armor: armorInput.value,
        gold: goldInput.value,
    };
}

// Envoie les stats au serveur (uniquement si un personnage est "claim")
const sendStatsUpdate = debounce(() => {
    if (characterClaimed) {
        socket.emit('updateStats', getStats());
    }
});

// Envoie la demande de lancer de dé au serveur
function rollDice(sides) {
    if (characterClaimed) {
        socket.emit('rollDice', { dice: `d${sides}` });
    } else {
        alert("Veuillez d'abord choisir un nom de personnage.");
    }
}

// --- Écouteurs d'événements ---

// Quand l'utilisateur a fini de taper son nom, il "réclame" le personnage
nameInput.addEventListener('change', () => {
    const characterName = nameInput.value.trim();
    if (characterName) {
        socket.emit('claimCharacter', characterName);
    }
});

// Les autres champs envoient des mises à jour
allInputs.forEach(input => {
    input.addEventListener('input', sendStatsUpdate);
});

// Boutons de dés
diceButtons.forEach(button => {
    button.addEventListener('click', () => {
        const sides = button.dataset.dice;
        rollDice(sides);
    });
});

// --- Réception des événements du Serveur ---

socket.on('claimSuccess', (player) => {
    console.log('Personnage récupéré avec succès:', player);
    characterClaimed = true;
    nameInput.disabled = true; // On verrouille le champ nom
    nameInput.classList.add('bg-gray-600'); // Style visuel pour indiquer le verrouillage
    updateForm(player);
});

socket.on('claimError', (errorMessage) => {
    alert(errorMessage);
    characterClaimed = false;
    nameInput.value = ''; // Réinitialise le champ nom
});

// Le serveur envoie l'état complet du jeu, on cherche notre personnage pour se mettre à jour
socket.on('gameStateUpdate', (gameState) => {
    if (!characterClaimed) return; // Ne fait rien si on ne contrôle pas encore de perso

    const myPlayer = gameState.players.find(p => p.name === nameInput.value);
    if (myPlayer) {
        // On met à jour le formulaire uniquement si les données sont différentes
        // pour éviter de perturber la saisie de l'utilisateur.
        if (hpCurrentInput.value != myPlayer.hp) hpCurrentInput.value = myPlayer.hp;
        if (hpMaxInput.value != myPlayer.maxHp) hpMaxInput.value = myPlayer.maxHp;
        if (armorInput.value != myPlayer.armor) armorInput.value = myPlayer.armor;
        if (goldInput.value != myPlayer.gold) goldInput.value = myPlayer.gold;
    }
});

// Gère la déconnexion pour réactiver le champ nom
socket.on('disconnect', () => {
    characterClaimed = false;
    nameInput.disabled = false;
    nameInput.classList.remove('bg-gray-600');
    alert("Déconnecté du serveur. Vous pouvez essayer de vous reconnecter ou de choisir un autre personnage.");
});
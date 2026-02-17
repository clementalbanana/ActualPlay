const socket = io();

// --- Éléments du DOM ---
const nameInput = document.getElementById('name');
const hpCurrentInput = document.getElementById('hp_current');
const hpMaxInput = document.getElementById('hp_max');
const armorInput = document.getElementById('armor');
const goldInput = document.getElementById('gold');
const allInputs = [hpCurrentInput, hpMaxInput, armorInput, goldInput];
const diceButtons = document.querySelectorAll('.dice-btn');

// Éléments Panier de dés
const diceTray = document.getElementById('dice-tray');
const emptyTrayMsg = document.getElementById('empty-tray-msg');
const btnRollTray = document.getElementById('btn-roll-tray');
const btnClearTray = document.getElementById('btn-clear-tray');

// Éléments Stats Personnalisées
const btnAddStat = document.getElementById('btn-add-stat');
const addStatForm = document.getElementById('add-stat-form');
const btnCancelStat = document.getElementById('btn-cancel-stat');
const btnConfirmStat = document.getElementById('btn-confirm-stat');
const newStatName = document.getElementById('new-stat-name');
const newStatMax = document.getElementById('new-stat-max');
const customStatsList = document.getElementById('custom-stats-list');

// --- État Local ---
let characterClaimed = false;
let diceBasket = []; // Stocke les dés à plat : ['d6', 'd6', 'd20']
let customStats = []; // [{ name: 'Mana', current: 10, max: 20 }]

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
    
    if (player.customStats) {
        customStats = player.customStats;
        renderCustomStats();
    }
}

// Récupère les stats du formulaire pour l'envoi
function getStats() {
    return {
        hp_current: hpCurrentInput.value,
        hp_max: hpMaxInput.value,
        armor: armorInput.value,
        gold: goldInput.value,
        customStats: customStats
    };
}

// Envoie les stats au serveur (uniquement si un personnage est "claim")
const sendStatsUpdate = debounce(() => {
    if (characterClaimed) {
        socket.emit('updateStats', getStats());
    }
});

// --- Gestion des Stats Personnalisées ---

function renderCustomStats() {
    customStatsList.innerHTML = '';
    customStats.forEach((stat, index) => {
        const percentage = Math.min(100, Math.max(0, (stat.current / stat.max) * 100));
        
        const div = document.createElement('div');
        div.className = 'bg-gray-700 p-3 rounded border border-gray-600';
        
        div.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-medium text-gray-300">${stat.name}</span>
                <button class="text-red-400 hover:text-red-600 p-1 delete-stat-btn" data-index="${index}" title="Supprimer">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
            
            <div class="relative w-full h-5 bg-gray-900 rounded-full overflow-hidden border border-gray-600 mb-2">
                <div class="absolute top-0 left-0 h-full bg-indigo-600 transition-all duration-300 ease-out" style="width: ${percentage}%"></div>
                <div class="absolute top-0 left-0 w-full h-full flex items-center justify-center text-xs font-bold text-white drop-shadow-md z-10">
                    ${stat.current} / ${stat.max}
                </div>
            </div>

            <div class="flex justify-center space-x-4">
                <button class="bg-gray-600 hover:bg-gray-500 text-white font-bold py-1 px-3 rounded text-xs btn-decrease" data-index="${index}">-</button>
                <button class="bg-gray-600 hover:bg-gray-500 text-white font-bold py-1 px-3 rounded text-xs btn-increase" data-index="${index}">+</button>
            </div>
        `;
        customStatsList.appendChild(div);
    });

    // Écouteurs pour les boutons +/- et suppression
    document.querySelectorAll('.btn-decrease').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.target.dataset.index;
            if (customStats[idx].current > 0) {
                customStats[idx].current--;
                renderCustomStats();
                sendStatsUpdate();
            }
        });
    });

    document.querySelectorAll('.btn-increase').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.target.dataset.index;
            if (customStats[idx].current < customStats[idx].max) {
                customStats[idx].current++;
                renderCustomStats();
                sendStatsUpdate();
            }
        });
    });

    document.querySelectorAll('.delete-stat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            const idx = target.dataset.index;
            customStats.splice(idx, 1);
            renderCustomStats();
            sendStatsUpdate();
        });
    });
}

btnAddStat.addEventListener('click', () => {
    addStatForm.classList.remove('hidden');
    newStatName.focus();
});

btnCancelStat.addEventListener('click', () => {
    addStatForm.classList.add('hidden');
    newStatName.value = '';
    newStatMax.value = '';
});

btnConfirmStat.addEventListener('click', () => {
    const name = newStatName.value.trim();
    const maxVal = parseInt(newStatMax.value.trim(), 10);
    
    if (name && !isNaN(maxVal) && maxVal > 0) {
        customStats.push({ 
            name: name, 
            current: maxVal, // Commence au max par défaut
            max: maxVal 
        });
        renderCustomStats();
        sendStatsUpdate();
        
        // Reset form
        newStatName.value = '';
        newStatMax.value = '';
        addStatForm.classList.add('hidden');
    } else {
        alert("Veuillez entrer un nom valide et une valeur maximum numérique.");
    }
});


// --- Gestion du Panier de Dés ---

function updateDiceTrayUI() {
    diceTray.innerHTML = '';
    
    if (diceBasket.length === 0) {
        diceTray.appendChild(emptyTrayMsg);
        emptyTrayMsg.style.display = 'inline';
        btnRollTray.disabled = true;
        btnRollTray.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        emptyTrayMsg.style.display = 'none';
        btnRollTray.disabled = false;
        btnRollTray.classList.remove('opacity-50', 'cursor-not-allowed');

        diceBasket.forEach((die, index) => {
            const badge = document.createElement('span');
            badge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 mr-2 mb-2 cursor-pointer hover:bg-red-100 hover:text-red-800';
            badge.innerText = die;
            badge.title = "Cliquer pour retirer";
            badge.addEventListener('click', () => {
                diceBasket.splice(index, 1);
                updateDiceTrayUI();
            });
            diceTray.appendChild(badge);
        });
    }
}

// Envoie la demande de lancer de dé au serveur
function rollDiceBasket() {
    if (!characterClaimed) {
        alert("Veuillez d'abord choisir un nom de personnage.");
        return;
    }
    if (diceBasket.length === 0) return;

    // Agrégation des dés : ['d6', 'd6', 'd20'] -> [{type: 'd6', qty: 2}, {type: 'd20', qty: 1}]
    const diceCounts = {};
    diceBasket.forEach(die => {
        diceCounts[die] = (diceCounts[die] || 0) + 1;
    });

    const dicePayload = Object.keys(diceCounts).map(type => ({
        type: type,
        qty: diceCounts[type]
    }));

    socket.emit('rollDice', { dice: dicePayload });
    
    // Vider le panier après envoi
    diceBasket = [];
    updateDiceTrayUI();
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

// Boutons de dés (Ajout au panier)
diceButtons.forEach(button => {
    button.addEventListener('click', () => {
        const sides = button.dataset.dice;
        diceBasket.push(`d${sides}`);
        updateDiceTrayUI();
    });
});

// Boutons du panier
btnRollTray.addEventListener('click', rollDiceBasket);

btnClearTray.addEventListener('click', () => {
    diceBasket = [];
    updateDiceTrayUI();
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
        
        // Mise à jour des stats custom si elles ont changé côté serveur (ex: rechargement page)
        // On compare grossièrement pour éviter de redessiner si c'est nous qui venons d'envoyer
        if (JSON.stringify(myPlayer.customStats) !== JSON.stringify(customStats)) {
             customStats = myPlayer.customStats || [];
             renderCustomStats();
        }
    }
});

// Gère la déconnexion pour réactiver le champ nom
socket.on('disconnect', () => {
    characterClaimed = false;
    nameInput.disabled = false;
    nameInput.classList.remove('bg-gray-600');
    alert("Déconnecté du serveur. Vous pouvez essayer de vous reconnecter ou de choisir un autre personnage.");
});

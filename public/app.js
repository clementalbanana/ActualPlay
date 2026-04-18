const socket = io(window.location.origin);

// --- Éléments du DOM ---
const nameInput = document.getElementById('name');
const hpCurrentInput = document.getElementById('hp_current');
const hpMaxInput = document.getElementById('hp_max');
const armorInput = document.getElementById('armor');
const goldInput = document.getElementById('gold');
const allInputs = [hpCurrentInput, hpMaxInput, armorInput, goldInput];
const diceButtons = document.querySelectorAll('.dice-btn');
const modButtons = document.querySelectorAll('.mod-btn');
const diceLog = document.getElementById('dice-log');

// Éléments Panier de dés (Unified logic for multiple UI targets)
const trayContainers = {
    mobile: {
        list: document.getElementById('dice-tray-mobile'),
        roll: document.getElementById('btn-roll-tray-mobile'),
        clear: document.getElementById('btn-clear-tray-mobile'),
        wrapper: document.getElementById('mobile-tray-container')
    },
    desktop: {
        list: document.getElementById('dice-tray-desktop'),
        roll: document.getElementById('btn-roll-tray-desktop'),
        clear: document.getElementById('btn-clear-tray-desktop'),
        emptyMsg: document.getElementById('empty-tray-msg-desktop')
    }
};

// Éléments Stats Personnalisées
const btnAddStat = document.getElementById('btn-add-stat');
const addStatForm = document.getElementById('add-stat-form');
const btnCancelStat = document.getElementById('btn-cancel-stat');
const btnConfirmStat = document.getElementById('btn-confirm-stat');
const newStatName = document.getElementById('new-stat-name');
const newStatMax = document.getElementById('new-stat-max');
const newStatColor = document.getElementById('new-stat-color');
const customStatsList = document.getElementById('custom-stats-list');

// --- État Local ---
let characterClaimed = false;
let diceBasket = [];
let customStats = [];

// --- Fonctions Utilitaires ---
function debounce(func, delay = 300) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// --- Logique du Panier de Dés ---
function updateDiceTrayUI() {
    // Mobile UI
    if (trayContainers.mobile.list) {
        trayContainers.mobile.list.innerHTML = '';
        if (diceBasket.length === 0) {
            trayContainers.mobile.wrapper.classList.add('hidden');
        } else {
            trayContainers.mobile.wrapper.classList.remove('hidden');
            renderItemsToTray(trayContainers.mobile.list);
        }
    }

    // Desktop UI
    if (trayContainers.desktop.list) {
        trayContainers.desktop.list.innerHTML = '';
        if (diceBasket.length === 0) {
            trayContainers.desktop.list.appendChild(trayContainers.desktop.emptyMsg);
            trayContainers.desktop.emptyMsg.style.display = 'inline';
            trayContainers.desktop.roll.disabled = true;
        } else {
            trayContainers.desktop.emptyMsg.style.display = 'none';
            trayContainers.desktop.roll.disabled = false;
            renderItemsToTray(trayContainers.desktop.list);
        }
    }
}

function renderItemsToTray(container) {
    diceBasket.forEach((item, index) => {
        const badge = document.createElement('span');
        const isMod = item.type === 'mod';
        const colorClass = isMod ? 'bg-orange-100 text-orange-800' : 'bg-indigo-100 text-indigo-800';
        badge.className = `inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${colorClass} shadow-sm`;
        badge.innerHTML = `<span>${isMod ? (item.value >= 0 ? `+${item.value}` : item.value) : item.value}</span>`;

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '&nbsp;×';
        delBtn.className = 'ml-2 text-sm font-black hover:text-red-600 transition-colors';
        delBtn.onclick = () => {
            diceBasket.splice(index, 1);
            updateDiceTrayUI();
        };
        badge.appendChild(delBtn);
        container.appendChild(badge);
    });
}

function rollDiceBasket() {
    if (!characterClaimed) return alert("Veuillez choisir un nom de personnage.");
    if (diceBasket.length === 0) return;

    const dicePayload = [];
    let constantModifier = 0;
    const diceCounts = {};

    diceBasket.forEach(item => {
        if (item.type === 'die') diceCounts[item.value] = (diceCounts[item.value] || 0) + 1;
        else constantModifier += item.value;
    });

    Object.keys(diceCounts).forEach(type => dicePayload.push({ type, qty: diceCounts[type] }));

    socket.emit('rollDice', { dice: dicePayload, modifier: constantModifier });
    diceBasket = [];
    updateDiceTrayUI();
}

// --- Événements du Panier ---
[trayContainers.mobile.roll, trayContainers.desktop.roll].forEach(btn => {
    if(btn) btn.onclick = rollDiceBasket;
});

[trayContainers.mobile.clear, trayContainers.desktop.clear].forEach(btn => {
    if(btn) btn.onclick = () => { diceBasket = []; updateDiceTrayUI(); };
});

diceButtons.forEach(btn => btn.onclick = () => {
    diceBasket.push({type:'die', value:`d${btn.dataset.dice}`});
    updateDiceTrayUI();
});

modButtons.forEach(btn => btn.onclick = () => {
    diceBasket.push({type:'mod', value:parseInt(btn.dataset.mod, 10)});
    updateDiceTrayUI();
});

// --- Gestion des Stats & Formulaires ---
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

const sendStatsUpdate = debounce(() => {
    if (characterClaimed) socket.emit('updateStats', {
        hp_current: hpCurrentInput.value,
        hp_max: hpMaxInput.value,
        armor: armorInput.value,
        gold: goldInput.value,
        customStats: customStats
    });
});

function renderCustomStats() {
    customStatsList.innerHTML = '';
    customStats.forEach((stat, index) => {
        const percentage = Math.min(100, Math.max(0, (stat.current / stat.max) * 100));
        const div = document.createElement('div');
        div.className = 'bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-sm transition-all hover:border-indigo-500';
        div.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <div class="flex items-center gap-3">
                    <input type="color" value="${stat.color || '#4F46E5'}" onchange="updateStatColor(${index}, this.value)">
                    <span class="text-sm font-bold text-gray-200">${stat.name}</span>
                </div>
                <button class="text-red-400 p-2 active:scale-90" onclick="deleteStat(${index})">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
            <div class="relative w-full h-6 bg-gray-900 rounded-full overflow-hidden border border-gray-600 mb-4 shadow-inner">
                <div class="absolute top-0 left-0 h-full transition-all duration-500 ease-out" style="width: ${percentage}%; background-color: ${stat.color || '#4F46E5'}"></div>
                <div class="absolute inset-0 flex items-center justify-center text-xs font-black text-white drop-shadow-md z-10">
                    ${stat.current} / ${stat.max}
                </div>
            </div>
            <div class="flex justify-center space-x-8">
                <button class="bg-gray-700 w-12 h-12 flex items-center justify-center rounded-xl text-lg font-black active:bg-gray-600 shadow-md" onclick="changeStat(${index}, -1)">-</button>
                <button class="bg-gray-700 w-12 h-12 flex items-center justify-center rounded-xl text-lg font-black active:bg-gray-600 shadow-md" onclick="changeStat(${index}, 1)">+</button>
            </div>
        `;
        customStatsList.appendChild(div);
    });
}

window.updateStatColor = (idx, color) => {
    customStats[idx].color = color;
    renderCustomStats();
    sendStatsUpdate();
};

window.changeStat = (idx, delta) => {
    const newVal = customStats[idx].current + delta;
    if (newVal >= 0 && newVal <= customStats[idx].max) {
        customStats[idx].current = newVal;
        renderCustomStats();
        sendStatsUpdate();
    }
};

window.deleteStat = (idx) => {
    if(confirm("Supprimer cette statistique ?")) {
        customStats.splice(idx, 1);
        renderCustomStats();
        sendStatsUpdate();
    }
};

btnAddStat.onclick = () => { addStatForm.classList.remove('hidden'); newStatName.focus(); };
btnCancelStat.onclick = () => { addStatForm.classList.add('hidden'); newStatName.value = ''; newStatMax.value = ''; };
btnConfirmStat.onclick = () => {
    const name = newStatName.value.trim();
    const maxVal = parseInt(newStatMax.value.trim(), 10);
    const color = newStatColor.value;
    if (name && !isNaN(maxVal) && maxVal > 0) {
        customStats.push({ name, current: maxVal, max: maxVal, color: color });
        renderCustomStats(); sendStatsUpdate();
        newStatName.value = ''; newStatMax.value = ''; addStatForm.classList.add('hidden');
    }
};

// --- Initialisation & Socket ---
nameInput.onchange = () => {
    const characterName = nameInput.value.trim();
    if (characterName) {
        socket.emit('claimCharacter', characterName);
        localStorage.setItem('jdr_playerName', characterName);
    }
};

allInputs.forEach(input => input.oninput = sendStatsUpdate);

socket.on('claimSuccess', (player) => {
    characterClaimed = true;
    nameInput.disabled = true;
    nameInput.classList.add('bg-gray-600');
    updateForm(player);
});

socket.on('claimError', (msg) => { alert(msg); characterClaimed = false; nameInput.value = ''; });

socket.on('gameStateUpdate', (gameState) => {
    if (!characterClaimed) return;
    const myPlayer = gameState.players.find(p => p.name === nameInput.value);
    if (myPlayer) {
        if (hpCurrentInput.value != myPlayer.hp) hpCurrentInput.value = myPlayer.hp;
        if (hpMaxInput.value != myPlayer.maxHp) hpMaxInput.value = myPlayer.maxHp;
        if (armorInput.value != myPlayer.armor) armorInput.value = myPlayer.armor;
        if (goldInput.value != myPlayer.gold) goldInput.value = myPlayer.gold;
        if (JSON.stringify(myPlayer.customStats) !== JSON.stringify(customStats)) {
             customStats = myPlayer.customStats || [];
             renderCustomStats();
        }
    }
});

socket.on('diceRolled', (data) => {
    const li = document.createElement('li');
    li.className = 'bg-gray-800 p-3 rounded-lg border border-gray-700 text-xs mb-2 transition-all hover:border-indigo-500';
    const groups = {};
    data.results.forEach(r => { if (!groups[r.type]) groups[r.type] = []; groups[r.type].push(r.value); });
    let details = Object.keys(groups).map(type => `${groups[type].length}${type} [${groups[type].join(', ')}]`).join(' + ');
    if (data.modifier !== 0) details += (data.modifier > 0 ? ` + ${data.modifier}` : ` - ${Math.abs(data.modifier)}`);
    li.innerHTML = `
        <div class="flex justify-between items-center">
            <span class="font-bold text-indigo-400 truncate mr-2" style="max-width: 80px;">${data.player}</span>
            <span class="text-gray-400 italic flex-1 truncate text-right mr-3" title="${details}">${details}</span>
            <span class="font-black text-yellow-400 text-sm">Total: ${data.total}</span>
        </div>
    `;
    diceLog.prepend(li);
    if (diceLog.children.length > 50) diceLog.lastElementChild.remove();
});

socket.on('kicked', () => { alert("Expulsé par le MJ."); window.location.reload(); });
socket.on('disconnect', () => { characterClaimed = false; nameInput.disabled = false; nameInput.classList.remove('bg-gray-600'); });

// Auto-claim from localStorage
window.addEventListener('load', () => {
    const savedName = localStorage.getItem('jdr_playerName');
    if (savedName) {
        nameInput.value = savedName;
        socket.emit('claimCharacter', savedName);
    }
});

updateDiceTrayUI();

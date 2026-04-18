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
let diceBasket = [];
let customStats = [];

// --- Fonctions ---

function debounce(func, delay = 300) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

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

function getStats() {
    return {
        hp_current: hpCurrentInput.value,
        hp_max: hpMaxInput.value,
        armor: armorInput.value,
        gold: goldInput.value,
        customStats: customStats
    };
}

const sendStatsUpdate = debounce(() => {
    if (characterClaimed) {
        socket.emit('updateStats', getStats());
    }
});

function renderCustomStats() {
    customStatsList.innerHTML = '';
    customStats.forEach((stat, index) => {
        const percentage = Math.min(100, Math.max(0, (stat.current / stat.max) * 100));
        const div = document.createElement('div');
        div.className = 'bg-gray-700 p-3 rounded border border-gray-600';
        div.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-medium text-gray-300">${stat.name}</span>
                <button class="text-red-400 hover:text-red-600 p-1 delete-stat-btn" data-index="${index}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
            <div class="relative w-full h-5 bg-gray-900 rounded-full overflow-hidden border border-gray-600 mb-2">
                <div class="absolute top-0 left-0 h-full bg-indigo-600 transition-all duration-300" style="width: ${percentage}%"></div>
                <div class="absolute w-full h-full flex items-center justify-center text-xs font-bold text-white drop-shadow-md z-10">
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

    document.querySelectorAll('.btn-decrease').forEach(btn => btn.onclick = (e) => {
        const idx = e.target.dataset.index;
        if (customStats[idx].current > 0) { customStats[idx].current--; renderCustomStats(); sendStatsUpdate(); }
    });
    document.querySelectorAll('.btn-increase').forEach(btn => btn.onclick = (e) => {
        const idx = e.target.dataset.index;
        if (customStats[idx].current < customStats[idx].max) { customStats[idx].current++; renderCustomStats(); sendStatsUpdate(); }
    });
    document.querySelectorAll('.delete-stat-btn').forEach(btn => btn.onclick = (e) => {
        const idx = e.currentTarget.dataset.index;
        customStats.splice(idx, 1); renderCustomStats(); sendStatsUpdate();
    });
}

btnAddStat.onclick = () => { addStatForm.classList.remove('hidden'); newStatName.focus(); };
btnCancelStat.onclick = () => { addStatForm.classList.add('hidden'); newStatName.value = ''; newStatMax.value = ''; };
btnConfirmStat.onclick = () => {
    const name = newStatName.value.trim();
    const maxVal = parseInt(newStatMax.value.trim(), 10);
    if (name && !isNaN(maxVal) && maxVal > 0) {
        customStats.push({ name, current: maxVal, max: maxVal });
        renderCustomStats(); sendStatsUpdate();
        newStatName.value = ''; newStatMax.value = ''; addStatForm.classList.add('hidden');
    }
};

function updateDiceTrayUI() {
    diceTray.innerHTML = '';
    if (diceBasket.length === 0) {
        diceTray.appendChild(emptyTrayMsg);
        emptyTrayMsg.style.display = 'inline';
        btnRollTray.disabled = true;
    } else {
        emptyTrayMsg.style.display = 'none';
        btnRollTray.disabled = false;
        diceBasket.forEach((item, index) => {
            const badge = document.createElement('span');
            const isMod = item.type === 'mod';
            badge.className = `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isMod ? 'bg-orange-100 text-orange-800' : 'bg-indigo-100 text-indigo-800'} mr-2 mb-2`;
            badge.innerHTML = `<span>${isMod ? (item.value >= 0 ? `+${item.value}` : item.value) : item.value}</span>`;
            const del = document.createElement('button');
            del.innerHTML = '&nbsp;x';
            del.className = 'ml-1 hover:text-red-600 font-bold';
            del.onclick = () => { diceBasket.splice(index, 1); updateDiceTrayUI(); };
            badge.appendChild(del);
            diceTray.appendChild(badge);
        });
    }
}

diceButtons.forEach(btn => btn.onclick = () => { diceBasket.push({type:'die', value:`d${btn.dataset.dice}`}); updateDiceTrayUI(); });
modButtons.forEach(btn => btn.onclick = () => { diceBasket.push({type:'mod', value:parseInt(btn.dataset.mod,10)}); updateDiceTrayUI(); });

btnRollTray.onclick = () => {
    if (!characterClaimed) return alert("Choisissez un nom.");
    const dicePayload = [];
    let constantModifier = 0;
    const diceCounts = {};
    diceBasket.forEach(item => {
        if (item.type === 'die') diceCounts[item.value] = (diceCounts[item.value] || 0) + 1;
        else constantModifier += item.value;
    });
    Object.keys(diceCounts).forEach(type => dicePayload.push({ type, qty: diceCounts[type] }));
    socket.emit('rollDice', { dice: dicePayload, modifier: constantModifier });
    diceBasket = []; updateDiceTrayUI();
};

btnClearTray.onclick = () => { diceBasket = []; updateDiceTrayUI(); };

nameInput.onchange = () => {
    const characterName = nameInput.value.trim();
    if (characterName) socket.emit('claimCharacter', characterName);
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

socket.on('kicked', () => {
    alert("Vous avez été expulsé par le MJ.");
    window.location.reload();
});

socket.on('disconnect', () => {
    characterClaimed = false;
    nameInput.disabled = false;
    nameInput.classList.remove('bg-gray-600');
});

updateDiceTrayUI();

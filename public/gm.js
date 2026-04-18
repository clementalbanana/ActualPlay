const socket = io(window.location.origin);

function debounce(func, delay = 300) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// --- Gestion du Boss ---
const bossNameInput = document.getElementById('boss_name');
const bossHpCurrentInput = document.getElementById('boss_hp_current');
const bossHpMaxInput = document.getElementById('boss_hp_max');
const bossArmorInput = document.getElementById('boss_armor');

function updateBoss() {
    socket.emit('updateBoss', {
        name: bossNameInput.value,
        hp: parseInt(bossHpCurrentInput.value, 10),
        maxHp: parseInt(bossHpMaxInput.value, 10),
        armor: parseInt(bossArmorInput.value, 10)
    });
}
const debouncedUpdateBoss = debounce(updateBoss, 500);
[bossNameInput, bossHpCurrentInput, bossHpMaxInput, bossArmorInput].forEach(input => {
    input.addEventListener('input', debouncedUpdateBoss);
});

// --- Joueurs Connectés ---
const onlinePlayersList = document.getElementById('online-players-list');
function updateOnlinePlayers(players) {
    onlinePlayersList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center bg-gray-800 p-2 rounded border border-gray-700';

        const statusColor = player.isOnline ? 'text-green-400' : 'text-gray-500';
        const statusText = player.isOnline ? 'En ligne' : 'Hors ligne';

        li.innerHTML = `
            <div class="flex flex-col">
                <span class="font-bold ${player.isOnline ? 'text-white' : 'text-gray-400'}">${player.name}</span>
                <span class="text-[10px] ${statusColor}">${statusText}</span>
            </div>
            ${player.isOnline ? `
                <button onclick="kickPlayer(${player.id})" class="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold py-1 px-2 rounded">EXPULSER</button>
            ` : ''}
        `;
        onlinePlayersList.appendChild(li);
    });
}

window.kickPlayer = (playerId) => {
    if (confirm("Voulez-vous vraiment expulser ce joueur ?")) {
        socket.emit('kickPlayer', playerId);
    }
};

// --- Lancer de Dés (Panier) ---
const gmRollerNameInput = document.getElementById('gm_roller_name');
const gmDiceButtons = document.querySelectorAll('.dice-btn-gm');
const gmModButtons = document.querySelectorAll('.mod-btn-gm');
const diceTray = document.getElementById('dice-tray');
const emptyTrayMsg = document.getElementById('empty-tray-msg');
const btnRollTray = document.getElementById('btn-roll-tray');
const btnClearTray = document.getElementById('btn-clear-tray');

let diceBasket = [];

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

gmDiceButtons.forEach(btn => btn.onclick = () => { diceBasket.push({type:'die', value:`d${btn.dataset.dice}`}); updateDiceTrayUI(); });
gmModButtons.forEach(btn => btn.onclick = () => { diceBasket.push({type:'mod', value:parseInt(btn.dataset.mod,10)}); updateDiceTrayUI(); });

btnRollTray.onclick = () => {
    const dicePayload = [];
    let constantModifier = 0;
    const diceCounts = {};
    diceBasket.forEach(item => {
        if (item.type === 'die') diceCounts[item.value] = (diceCounts[item.value] || 0) + 1;
        else constantModifier += item.value;
    });
    Object.keys(diceCounts).forEach(type => dicePayload.push({ type, qty: diceCounts[type] }));
    socket.emit('rollDice', { player: gmRollerNameInput.value || "MJ", dice: dicePayload, modifier: constantModifier });
    diceBasket = [];
    updateDiceTrayUI();
};

btnClearTray.onclick = () => { diceBasket = []; updateDiceTrayUI(); };

// --- Images ---
const imageList = document.getElementById('image-list');
let selectedImage = null;

function selectImage(imageName, container) {
    selectedImage = imageName;
    document.querySelectorAll('.image-container').forEach(c => c.classList.remove('ring-4', 'ring-green-500'));
    container.classList.add('ring-4', 'ring-green-500');
    document.getElementById('btn-show-image').disabled = false;
}

window.deleteImage = (imageName) => {
    if (confirm(`Supprimer ${imageName} ?`)) {
        socket.emit('deleteImage', imageName);
    }
};

socket.on('imageList', (images) => {
    imageList.innerHTML = '';
    images.forEach(image => {
        const div = document.createElement('div');
        div.className = 'image-container relative group cursor-pointer rounded-lg overflow-hidden h-32 bg-gray-800 border border-gray-700';
        div.onclick = () => selectImage(image, div);
        
        div.innerHTML = `
            <img src="images/${image}" class="object-cover w-full h-full">
            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                <button onclick="event.stopPropagation(); deleteImage('${image}')" class="opacity-0 group-hover:opacity-100 bg-red-600 p-2 rounded-full hover:bg-red-700 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
            <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-[10px] p-1 truncate text-center">${image}</div>
        `;
        imageList.appendChild(div);
    });
});

document.getElementById('btn-show-image').onclick = () => selectedImage && socket.emit('displayImage', `images/${selectedImage}`);
document.getElementById('btn-hide-image').onclick = () => socket.emit('hideImage');
document.getElementById('upload-form').onsubmit = (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('image', document.getElementById('image-input').files[0]);
    fetch('/upload', { method: 'POST', body: formData }).then(() => socket.emit('listImages'));
};

// --- Events ---
socket.on('gameStateUpdate', (gameState) => {
    updateOnlinePlayers(gameState.players);
    if (document.activeElement !== bossNameInput) bossNameInput.value = gameState.boss.name;
    if (document.activeElement !== bossHpCurrentInput) bossHpCurrentInput.value = gameState.boss.hp;
    if (document.activeElement !== bossHpMaxInput) bossHpMaxInput.value = gameState.boss.maxHp;
    if (document.activeElement !== bossArmorInput) bossArmorInput.value = gameState.boss.armor;
});

socket.on('diceRolled', (data) => {
    const li = document.createElement('li');
    li.className = 'bg-gray-800 p-2 rounded border border-gray-700 text-sm mb-2';
    const groups = {};
    data.results.forEach(r => { if (!groups[r.type]) groups[r.type] = []; groups[r.type].push(r.value); });
    let details = Object.keys(groups).map(type => `${groups[type].length}${type} [${groups[type].join(', ')}]`).join(' + ');
    if (data.modifier !== 0) details += (data.modifier > 0 ? ` + ${data.modifier}` : ` - ${Math.abs(data.modifier)}`);
    li.innerHTML = `<span class="font-bold text-indigo-400">${data.player}</span> : <span class="font-bold text-yellow-400">Total ${data.total}</span> <span class="text-[10px] text-gray-400">(${details})</span>`;
    document.getElementById('dice-log').prepend(li);
});

socket.on('diceCleared', () => document.getElementById('dice-log').innerHTML = '');
socket.on('refreshImageList', () => socket.emit('listImages'));
socket.emit('listImages');
updateDiceTrayUI();

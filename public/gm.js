const socket = io(window.location.origin);

function debounce(func, delay = 300) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// --- Notifications Toast ---
const toastContainer = document.getElementById('toast-container');
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-600' : 'bg-indigo-600';
    toast.className = `${bgColor} text-white px-6 py-3 rounded-xl shadow-2xl text-xs font-bold transform transition-all duration-300 translate-y-10 opacity-0`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    // Animation entrée
    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);

    // Animation sortie
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
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
            del.onclick = (e) => { e.stopPropagation(); diceBasket.splice(index, 1); updateDiceTrayUI(); };
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
const imageInput = document.getElementById('image-input');
const dropZone = document.getElementById('drop-zone');
let selectedImage = null;
let currentStreamImage = null;

function selectImage(imageName, container) {
    selectedImage = imageName;
    document.querySelectorAll('.image-container').forEach(c => c.classList.remove('ring-4', 'ring-indigo-500'));
    container.classList.add('ring-4', 'ring-indigo-500');
    document.getElementById('btn-show-image').disabled = false;
}

window.deleteImage = (imageName) => {
    if (confirm(`Supprimer ${imageName} ?`)) {
        socket.emit('deleteImage', imageName);
    }
};

window.unprojectImage = () => {
    socket.emit('hideImage');
};

function uploadFiles(files) {
    if (!files || files.length === 0) return;

    const promises = Array.from(files).map(file => {
        const formData = new FormData();
        formData.append('image', file);
        return fetch('/upload', { method: 'POST', body: formData });
    });

    Promise.all(promises).then(() => {
        showToast("Images importées !", "success");
        socket.emit('listImages');
    }).catch(err => {
        console.error(err);
        showToast("Erreur lors de l'import", "error");
    });
}

// Import automatique au changement
imageInput.onchange = (e) => {
    uploadFiles(e.target.files);
    imageInput.value = ''; // Reset
};

// Drag & Drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, false);
});

dropZone.addEventListener('dragenter', () => dropZone.classList.add('border-indigo-500', 'bg-gray-800'), false);
dropZone.addEventListener('dragover', () => dropZone.classList.add('border-indigo-500', 'bg-gray-800'), false);
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-indigo-500', 'bg-gray-800'), false);
dropZone.addEventListener('drop', (e) => {
    dropZone.classList.remove('border-indigo-500', 'bg-gray-800');
    uploadFiles(e.dataTransfer.files);
}, false);

socket.on('imageList', (images) => {
    imageList.innerHTML = '';
    images.forEach(image => {
        const div = document.createElement('div');
        const isCurrent = `images/${image}` === currentStreamImage;

        div.className = `image-container relative group cursor-pointer rounded-lg overflow-hidden h-32 bg-gray-800 border-2 ${isCurrent ? 'active-on-stream' : 'border-gray-700'}`;
        div.onclick = () => selectImage(image, div);
        
        div.innerHTML = `
            <img src="images/${image}" class="object-cover w-full h-full">

            ${isCurrent ? `
                <div class="absolute top-1 right-1 bg-green-500 text-white rounded-full p-1 shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
                    </svg>
                </div>
            ` : ''}

            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center gap-2">
                <button onclick="event.stopPropagation(); deleteImage('${image}')" class="opacity-0 group-hover:opacity-100 bg-red-600 p-2 rounded-full hover:bg-red-700 transition-all shadow-lg" title="Supprimer de la bibliothèque">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
                ${isCurrent ? `
                    <button onclick="event.stopPropagation(); unprojectImage()" class="opacity-0 group-hover:opacity-100 bg-orange-600 p-2 rounded-full hover:bg-orange-700 transition-all shadow-lg" title="Retirer du stream">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                ` : ''}
            </div>
            <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-[10px] p-1 truncate text-center">${image}</div>
        `;
        imageList.appendChild(div);
    });
});

document.getElementById('btn-show-image').onclick = () => selectedImage && socket.emit('displayImage', `images/${selectedImage}`);
document.getElementById('btn-hide-image').onclick = () => socket.emit('hideImage');

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

socket.on('imageDisplayed', (imageUrl) => {
    currentStreamImage = imageUrl;
    socket.emit('listImages');
});

socket.on('imageHidden', () => {
    currentStreamImage = null;
    socket.emit('listImages');
});

socket.emit('listImages');
updateDiceTrayUI();

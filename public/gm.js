const socket = io(window.location.origin);

// --- Fonctions Utilitaires ---
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
    const bossData = {
        name: bossNameInput.value,
        hp: parseInt(bossHpCurrentInput.value, 10),
        maxHp: parseInt(bossHpMaxInput.value, 10),
        armor: parseInt(bossArmorInput.value, 10)
    };
    socket.emit('updateBoss', bossData);
}

const debouncedUpdateBoss = debounce(updateBoss, 500);

[bossNameInput, bossHpCurrentInput, bossHpMaxInput, bossArmorInput].forEach(input => {
    input.addEventListener('input', debouncedUpdateBoss);
});

// --- Lancer de Dés du MJ (Panier) ---
const gmRollerNameInput = document.getElementById('gm_roller_name');
const gmDiceButtons = document.querySelectorAll('.dice-btn-gm');
const gmModButtons = document.querySelectorAll('.mod-btn-gm');
const diceTray = document.getElementById('dice-tray');
const emptyTrayMsg = document.getElementById('empty-tray-msg');
const btnRollTray = document.getElementById('btn-roll-tray');
const btnClearTray = document.getElementById('btn-clear-tray');

let diceBasket = []; // Stocke les éléments : { type: 'die', value: 'd20' } ou { type: 'mod', value: 4 }

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

        diceBasket.forEach((item, index) => {
            const badge = document.createElement('span');
            const isMod = item.type === 'mod';
            const bgColor = isMod ? 'bg-orange-100 text-orange-800' : 'bg-indigo-100 text-indigo-800';
            badge.className = `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} mr-2 mb-2 group`;

            const text = document.createElement('span');
            text.innerText = isMod ? (item.value >= 0 ? `+${item.value}` : item.value) : item.value;
            badge.appendChild(text);

            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '&nbsp;x';
            removeBtn.className = 'ml-1 hover:text-red-600 font-bold';
            removeBtn.addEventListener('click', () => {
                diceBasket.splice(index, 1);
                updateDiceTrayUI();
            });
            badge.appendChild(removeBtn);

            diceTray.appendChild(badge);
        });
    }
}

gmDiceButtons.forEach(button => {
    button.addEventListener('click', () => {
        const diceType = button.getAttribute('data-dice');
        diceBasket.push({ type: 'die', value: `d${diceType}` });
        updateDiceTrayUI();
    });
});

gmModButtons.forEach(button => {
    button.addEventListener('click', () => {
        const mod = parseInt(button.getAttribute('data-mod'), 10);
        diceBasket.push({ type: 'mod', value: mod });
        updateDiceTrayUI();
    });
});

btnRollTray.addEventListener('click', () => {
    if (diceBasket.length === 0) return;

    const rollerName = gmRollerNameInput.value || "MJ";
    
    // Agrégation
    const dicePayload = [];
    let constantModifier = 0;

    const diceCounts = {};
    diceBasket.forEach(item => {
        if (item.type === 'die') {
            diceCounts[item.value] = (diceCounts[item.value] || 0) + 1;
        } else if (item.type === 'mod') {
            constantModifier += item.value;
        }
    });

    Object.keys(diceCounts).forEach(type => {
        dicePayload.push({ type, qty: diceCounts[type] });
    });

    // Envoi au serveur
    socket.emit('rollDice', { player: rollerName, dice: dicePayload, modifier: constantModifier });
    
    diceBasket = [];
    updateDiceTrayUI();
});

btnClearTray.addEventListener('click', () => {
    diceBasket = [];
    updateDiceTrayUI();
});

// Initialisation de l'état du panier
updateDiceTrayUI();

document.getElementById('reset-dice').addEventListener('click', () => {
    socket.emit('resetDice');
});


// --- Gestion des Images ---
const imageList = document.getElementById('image-list');
const uploadForm = document.getElementById('upload-form');
const imageInput = document.getElementById('image-input');
const btnShowImage = document.getElementById('btn-show-image');
const btnHideImage = document.getElementById('btn-hide-image');

let selectedImage = null;

function selectImage(imageName, imgElement) {
    selectedImage = imageName;
    const allImages = imageList.querySelectorAll('img');
    allImages.forEach(img => img.classList.remove('ring-4', 'ring-green-500'));
    imgElement.classList.add('ring-4', 'ring-green-500');
    btnShowImage.disabled = false;
}

btnShowImage.addEventListener('click', () => {
    if (selectedImage) {
        socket.emit('displayImage', `images/${selectedImage}`);
    }
});

btnHideImage.addEventListener('click', () => {
    socket.emit('hideImage');
});

btnShowImage.disabled = true;

function refreshImageList() {
    socket.emit('listImages');
}

uploadForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = imageInput.files[0];
    if (!file) {
        alert("Veuillez sélectionner un fichier.");
        return;
    }
    const formData = new FormData();
    formData.append('image', file);
    fetch('/upload', { method: 'POST', body: formData })
    .then(response => {
        if (!response.ok) throw new Error('L\'upload a échoué.');
        return response.text();
    })
    .then(message => console.log(message))
    .catch(error => {
        console.error('Erreur:', error);
        alert('Erreur lors de l\'upload.');
    });
});

refreshImageList();

socket.on('refreshImageList', () => refreshImageList());

socket.on('imageList', (images) => {
    imageList.innerHTML = '';
    selectedImage = null;
    btnShowImage.disabled = true;
    images.forEach(image => {
        const imgElement = document.createElement('img');
        imgElement.src = `images/${image}`;
        imgElement.alt = image;
        imgElement.className = 'cursor-pointer rounded-lg hover:ring-2 hover:ring-indigo-500 object-cover h-32 w-full';
        imgElement.addEventListener('click', () => selectImage(image, imgElement));
        imageList.appendChild(imgElement);
    });
});


// --- Journal des Dés ---
const diceLog = document.getElementById('dice-log');

socket.on('diceRolled', (data) => {
    const li = document.createElement('li');
    li.className = 'bg-gray-800 p-2 rounded border border-gray-700 text-sm';
    
    let diceDisplay = "";
    if (Array.isArray(data.results)) {
        const groups = {};
        data.results.forEach(r => {
            if (!groups[r.type]) groups[r.type] = [];
            groups[r.type].push(r.value);
        });
        
        let details = Object.keys(groups).map(type => {
            return `${groups[type].length}${type} [${groups[type].join(', ')}]`;
        }).join(' + ');

        if (data.modifier !== 0) {
            details += (data.modifier > 0 ? ` + ${data.modifier}` : ` - ${Math.abs(data.modifier)}`);
        }

        diceDisplay = `<span class="font-bold text-yellow-400" title="${details}">Total: ${data.total}</span> <span class="text-xs text-gray-400">(${details})</span>`;
    } else {
        diceDisplay = `<span class="font-bold text-yellow-400">${data.dice}</span> : <span class="font-bold text-white text-lg">${data.result}</span>`;
    }

    li.innerHTML = `<span class="font-bold text-indigo-400">${data.player}</span> a lancé ${diceDisplay}`;
    diceLog.prepend(li);
});

socket.on('diceCleared', () => {
    diceLog.innerHTML = '';
});

socket.on('gameStateUpdate', (gameState) => {
    if (document.activeElement !== bossNameInput) bossNameInput.value = gameState.boss.name;
    if (document.activeElement !== bossHpCurrentInput) bossHpCurrentInput.value = gameState.boss.hp;
    if (document.activeElement !== bossHpMaxInput) bossHpMaxInput.value = gameState.boss.maxHp;
    if (document.activeElement !== bossArmorInput) bossArmorInput.value = gameState.boss.armor;
});

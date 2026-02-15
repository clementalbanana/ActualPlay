const socket = io();

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

// --- Lancer de Dés du MJ ---
const gmRollerNameInput = document.getElementById('gm_roller_name');
const gmDiceButtons = document.querySelectorAll('.dice-btn-gm');

gmDiceButtons.forEach(button => {
    button.addEventListener('click', () => {
        const diceType = button.getAttribute('data-dice');
        const rollerName = gmRollerNameInput.value || "MJ";
        socket.emit('rollDice', { player: rollerName, dice: `d${diceType}` });
    });
});

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
    
    // Mettre à jour l'interface pour montrer la sélection
    const allImages = imageList.querySelectorAll('img');
    allImages.forEach(img => img.classList.remove('ring-4', 'ring-green-500'));
    
    imgElement.classList.add('ring-4', 'ring-green-500');
    
    // Activer le bouton "Afficher"
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

// Désactiver le bouton "Afficher" par défaut
btnShowImage.disabled = true;


function refreshImageList() {
    socket.emit('listImages');
}

// Gérer l'envoi du formulaire d'upload
uploadForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = imageInput.files[0];
    if (!file) {
        alert("Veuillez sélectionner un fichier.");
        return;
    }

    const formData = new FormData();
    formData.append('image', file);

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('L\'upload a échoué.');
        }
        return response.text();
    })
    .then(message => {
        console.log(message);
        // Le serveur notifiera via Socket.io de rafraîchir la liste
    })
    .catch(error => {
        console.error('Erreur lors de l\'upload:', error);
        alert('Erreur lors de l\'upload. Assurez-vous que le fichier est une image (jpg, png, gif).');
    });
});

// Demander la liste des images au serveur au chargement
refreshImageList();

// Le serveur nous demande de rafraîchir la liste (après un upload réussi)
socket.on('refreshImageList', () => {
    console.log('Rafraîchissement de la liste d\'images demandé par le serveur.');
    refreshImageList();
});

socket.on('imageList', (images) => {
    imageList.innerHTML = ''; // On vide la liste
    selectedImage = null; // Réinitialiser la sélection
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
    li.innerHTML = `<span class="font-bold text-indigo-400">${data.player}</span> a lancé <span class="font-bold text-yellow-400">${data.dice}</span> : <span class="font-bold text-white text-lg">${data.result}</span>`;
    diceLog.prepend(li);
});

socket.on('diceCleared', () => {
    diceLog.innerHTML = '';
});

// --- Synchronisation Initiale ---
socket.on('gameStateUpdate', (gameState) => {
    if (document.activeElement !== bossNameInput) bossNameInput.value = gameState.boss.name;
    if (document.activeElement !== bossHpCurrentInput) bossHpCurrentInput.value = gameState.boss.hp;
    if (document.activeElement !== bossHpMaxInput) bossHpMaxInput.value = gameState.boss.maxHp;
    if (document.activeElement !== bossArmorInput) bossArmorInput.value = gameState.boss.armor;
});

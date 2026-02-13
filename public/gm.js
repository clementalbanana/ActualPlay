const socket = io();

// --- Fonctions Utilitaires ---
function debounce(func, delay = 300) { /* ... */ }

// --- Gestion du Boss ---
/* ... reste identique ... */

// --- Lancer de Dés du MJ ---
/* ... reste identique ... */


// --- Gestion des Images ---
const imageList = document.getElementById('image-list');
const uploadForm = document.getElementById('upload-form');
const imageInput = document.getElementById('image-input');

function projectImage(imageUrl) {
    socket.emit('projectImage', imageUrl);
}

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
        // Le serveur notifiera via Socket.io de rafraîchir la liste,
        // donc pas besoin de le faire manuellement ici.
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
/* ... reste identique ... */

// --- Synchronisation Initiale ---
/* ... reste identique ... */

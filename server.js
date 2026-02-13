// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// 1. Configuration Express et Serveur HTTP
const app = express();
const server = http.createServer(app);

// 2. Initialisation de Socket.io
const io = new Server(server);

// Servir les fichiers statiques (HTML, CSS, JS) depuis le dossier 'public'
app.use(express.static(path.join(__dirname, 'public')));

// 3. Objet JSON 'gameState' (État du jeu)
// C'est la "Vérité Unique" stockée sur le serveur
let gameState = {
    players: [
        { id: 1, name: "Grog", hp: 45, maxHp: 45, armor: 16, class: "Barbare" },
        { id: 2, name: "Vex", hp: 30, maxHp: 30, armor: 14, class: "Rôdeur" },
        { id: 3, name: "Scanlan", hp: 25, maxHp: 25, armor: 12, class: "Barde" }
    ],
    boss: {
        name: "Seigneur Vampire",
        hp: 250,
        maxHp: 250,
        armor: 18,
        status: "Enragé"
    }
};

// 4. Gestion des connexions Socket.io
io.on('connection', (socket) => {
    console.log('Un client est connecté (Overlay ou Admin)');

    // DÈS LA CONNEXION : On envoie l'état actuel du jeu au client
    // Cela assure que l'overlay affiche les bonnes infos au démarrage
    socket.emit('initGame', gameState);

    // Exemple de listener si tu veux recevoir des commandes (ex: déconnexion)
    socket.on('disconnect', () => {
        console.log('Client déconnecté');
    });
});

// Lancement du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur JdR lancé sur http://localhost:${PORT}`);
});
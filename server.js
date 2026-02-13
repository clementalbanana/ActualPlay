// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs'); // On ajoute le module 'fs' pour lire les fichiers

// 1. Configuration Express et Serveur HTTP
const app = express();
const server = http.createServer(app);

// 2. Initialisation de Socket.io
const io = new Server(server);

// Servir les fichiers statiques (HTML, CSS, JS) depuis le dossier 'public'
app.use(express.static(path.join(__dirname, 'public')));

// 3. Objet JSON 'gameState' (État du jeu)
let gameState = {
    players: [
        { id: 1, name: "Grog", hp: 45, maxHp: 45, armor: 16, gold: 50, class: "Barbare" },
        { id: 2, name: "Vex", hp: 30, maxHp: 30, armor: 14, gold: 120, class: "Rôdeur" },
        { id: 3, name: "Scanlan", hp: 25, maxHp: 25, armor: 12, gold: 200, class: "Barde" }
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
    console.log('Un client est connecté');

    // DÈS LA CONNEXION : On envoie l'état actuel du jeu au nouveau client
    socket.emit('gameStateUpdate', gameState);

    // --- ÉVÉNEMENTS DES JOUEURS ---
    socket.on('updateStats', (playerData) => {
        console.log('Reçu "updateStats":', playerData);
        let playerFound = false;
        gameState.players = gameState.players.map(p => {
            if (playerData.name && p.name.toLowerCase() === playerData.name.toLowerCase()) {
                playerFound = true;
                return { ...p, ...playerData, hp: playerData.hp_current, maxHp: playerData.hp_max };
            }
            return p;
        });

        if (!playerFound && playerData.name) {
            const newPlayer = {
                id: gameState.players.length > 0 ? Math.max(...gameState.players.map(p => p.id)) + 1 : 1,
                name: playerData.name,
                hp: parseInt(playerData.hp_current, 10) || 0,
                maxHp: parseInt(playerData.hp_max, 10) || 10,
                armor: parseInt(playerData.armor, 10) || 10,
                gold: parseInt(playerData.gold, 10) || 0,
                class: ""
            };
            gameState.players.push(newPlayer);
        }
        io.emit('gameStateUpdate', gameState);
    });

    socket.on('rollDice', (diceData) => {
        console.log('Reçu "rollDice":', diceData);
        io.emit('diceRolled', diceData);
    });

    // --- ÉVÉNEMENTS DU MJ ---
    socket.on('updateBoss', (bossData) => {
        console.log('Reçu "updateBoss":', bossData);
        gameState.boss = { ...gameState.boss, ...bossData };
        io.emit('gameStateUpdate', gameState);
    });

    socket.on('listImages', () => {
        const imageDir = path.join(__dirname, 'public/images');
        fs.readdir(imageDir, (err, files) => {
            if (err) {
                console.error("Impossible de lire le dossier d'images:", err);
                socket.emit('imageList', []); // Envoyer une liste vide en cas d'erreur
                return;
            }
            // On ne garde que les fichiers image courants
            const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));
            socket.emit('imageList', imageFiles);
        });
    });

    socket.on('projectImage', (imageUrl) => {
        console.log('Projection de l\'image:', imageUrl);
        io.emit('showImage', imageUrl); // Diffuse à tous les clients (overlays)
    });

    socket.on('resetDice', () => {
        console.log('Réinitialisation des dés demandée.');
        io.emit('diceCleared'); // Notifie tous les clients de vider leur log/affichage
    });

    socket.on('disconnect', () => {
        console.log('Client déconnecté');
    });
});

// Lancement du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur JdR lancé sur http://localhost:${PORT}`);
    console.log(`Interface Joueur: http://localhost:${PORT}/`);
    console.log(`Interface MJ: http://localhost:${PORT}/gm.html`);
});
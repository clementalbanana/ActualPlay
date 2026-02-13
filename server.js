// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// --- État du Jeu & Gestion des "Sessions" ---
let gameState = {
    players: [],
    boss: { name: "Seigneur Vampire", hp: 250, maxHp: 250, armor: 18 }
};

// Associe un socket.id à un ID de joueur. C'est notre "système de salles".
// Format: { "socketId123": 1, "socketId456": 2 }
let claimedCharacters = {};

// --- Fonctions Utilitaires ---
function rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
}

function getPlayerBySocketId(socketId) {
    const playerId = claimedCharacters[socketId];
    return gameState.players.find(p => p.id === playerId);
}

// --- Gestion des Connexions Socket.io ---
io.on('connection', (socket) => {
    console.log(`Client connecté: ${socket.id}`);

    socket.emit('gameStateUpdate', gameState);

    // --- ÉVÉNEMENTS DE GESTION DE PERSONNAGE ---
    socket.on('claimCharacter', (characterName) => {
        if (!characterName) return;

        let player = gameState.players.find(p => p.name.toLowerCase() === characterName.toLowerCase());

        if (player) {
            // Vérifie si le personnage est déjà pris
            if (Object.values(claimedCharacters).includes(player.id)) {
                socket.emit('claimError', `Le personnage "${player.name}" est déjà contrôlé par quelqu'un.`);
                return;
            }
        } else {
            // Si le joueur n'existe pas, on le crée
            player = {
                id: gameState.players.length > 0 ? Math.max(...gameState.players.map(p => p.id)) + 1 : 1,
                name: characterName,
                hp: 10, maxHp: 10, armor: 10, gold: 0
            };
            gameState.players.push(player);
        }

        claimedCharacters[socket.id] = player.id;
        console.log(`Socket ${socket.id} a pris le contrôle de ${player.name} (ID: ${player.id})`);
        socket.emit('claimSuccess', player); // Confirme au client qu'il a le contrôle
        io.emit('gameStateUpdate', gameState); // Met à jour tout le monde
    });

    // --- ÉVÉNEMENTS SÉCURISÉS ---
    socket.on('updateStats', (playerData) => {
        const player = getPlayerBySocketId(socket.id);
        if (!player) return; // Ignore si le client ne contrôle aucun personnage

        console.log(`Reçu "updateStats" de ${player.name}:`, playerData);
        player.hp = parseInt(playerData.hp_current, 10) || player.hp;
        player.maxHp = parseInt(playerData.hp_max, 10) || player.maxHp;
        player.armor = parseInt(playerData.armor, 10) || player.armor;
        player.gold = parseInt(playerData.gold, 10) || player.gold;

        io.emit('gameStateUpdate', gameState);
    });

    socket.on('rollDice', (data) => {
        const sides = parseInt(data.dice.replace('d', ''), 10);
        if (isNaN(sides)) return;

        const result = rollDie(sides);
        let rollerName = "Anonyme";

        // Si le lancer vient d'un joueur authentifié
        const player = getPlayerBySocketId(socket.id);
        if (player) {
            rollerName = player.name;
        }
        // Si le lancer vient du MJ (qui peut spécifier un nom)
        else if (data.player) {
            rollerName = data.player;
        }
        
        const diceData = { player: rollerName, dice: data.dice, result: result };
        console.log('Lancer de dé généré par le serveur:', diceData);
        io.emit('diceRolled', diceData);
    });

    // --- ÉVÉNEMENTS DU MJ (non sécurisés, car on fait confiance au MJ) ---
    socket.on('updateBoss', (bossData) => {
        console.log('Reçu "updateBoss":', bossData);
        gameState.boss = { ...gameState.boss, ...bossData };
        io.emit('gameStateUpdate', gameState);
    });

    socket.on('listImages', () => { /* ... reste identique ... */ });
    socket.on('projectImage', (imageUrl) => io.emit('showImage', imageUrl));
    socket.on('resetDice', () => io.emit('diceCleared'));

    // --- DÉCONNEXION ---
    socket.on('disconnect', () => {
        console.log(`Client déconnecté: ${socket.id}`);
        const playerId = claimedCharacters[socket.id];
        if (playerId) {
            const player = gameState.players.find(p => p.id === playerId);
            console.log(`${player ? player.name : 'Un joueur'} (ID: ${playerId}) a été libéré.`);
            delete claimedCharacters[socket.id];
        }
    });
});

// Lancement du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur JdR lancé sur http://localhost:${PORT}`);
    console.log(`Interface Joueur: http://localhost:${PORT}/`);
    console.log(`Interface MJ: http://localhost:${PORT}/gm.html`);
    console.log(`Overlay: http://localhost:${PORT}/overlay.html`);
});
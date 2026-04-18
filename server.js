// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// --- Configuration de Multer pour l'upload d'images ---
const imageDir = path.join(__dirname, 'public/images');

if (!fs.existsSync(imageDir)){
    fs.mkdirSync(imageDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, imageDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/gif') {
        cb(null, true);
    } else {
        cb(new Error('Type de fichier non supporté'), false);
    }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('Aucun fichier valide n\'a été uploadé.');
    }
    io.emit('refreshImageList');
    res.status(200).send(`Fichier ${req.file.filename} uploadé avec succès.`);
});


// --- État du Jeu & Gestion des "Sessions" ---
let gameState = {
    players: [],
    boss: { name: "Seigneur Vampire", hp: 250, maxHp: 250, armor: 18 }
};
let claimedCharacters = {}; // socket.id -> player.id

// --- Fonctions Utilitaires ---
function rollDie(sides) { return Math.floor(Math.random() * sides) + 1; }
function getPlayerBySocketId(socketId) {
    const playerId = claimedCharacters[socketId];
    return gameState.players.find(p => p.id === playerId);
}

function broadcastGameState() {
    // On ajoute une info sur qui est en ligne
    const onlinePlayerIds = Object.values(claimedCharacters);
    const updatedState = {
        ...gameState,
        players: gameState.players.map(p => ({
            ...p,
            isOnline: onlinePlayerIds.includes(p.id)
        }))
    };
    io.emit('gameStateUpdate', updatedState);
}

// --- Gestion des Connexions Socket.io ---
io.on('connection', (socket) => {
    console.log(`Client connecté: ${socket.id}`);
    broadcastGameState();

    socket.on('claimCharacter', (characterName) => {
        if (!characterName) return;
        let player = gameState.players.find(p => p.name.toLowerCase() === characterName.toLowerCase());
        if (player) {
            if (Object.values(claimedCharacters).includes(player.id)) {
                socket.emit('claimError', `Le personnage "${player.name}" est déjà contrôlé par quelqu'un.`);
                return;
            }
        } else {
            player = {
                id: gameState.players.length > 0 ? Math.max(...gameState.players.map(p => p.id)) + 1 : 1,
                name: characterName,
                hp: 10, maxHp: 10, armor: 10, gold: 0,
                customStats: []
            };
            gameState.players.push(player);
        }
        claimedCharacters[socket.id] = player.id;
        socket.emit('claimSuccess', player);
        broadcastGameState();
    });

    socket.on('updateStats', (playerData) => {
        const player = getPlayerBySocketId(socket.id);
        if (!player) return;
        player.hp = parseInt(playerData.hp_current, 10) || player.hp;
        player.maxHp = parseInt(playerData.hp_max, 10) || player.maxHp;
        player.armor = parseInt(playerData.armor, 10) || player.armor;
        player.gold = parseInt(playerData.gold, 10) || player.gold;
        if (playerData.customStats) player.customStats = playerData.customStats;
        broadcastGameState();
    });

    socket.on('rollDice', (data) => {
        let diceToRoll = [];
        let constantModifier = parseInt(data.modifier, 10) || 0;
        if (Array.isArray(data.dice)) {
            data.dice.forEach(item => {
                if (item.type && item.qty) {
                    for (let i = 0; i < item.qty; i++) diceToRoll.push(item.type);
                } else if (typeof item === 'string') diceToRoll.push(item);
            });
        } else if (typeof data.dice === 'string') diceToRoll = [data.dice];
        else return;

        let results = [];
        let total = constantModifier;
        diceToRoll.forEach(dieType => {
            const sides = parseInt(dieType.replace('d', ''), 10);
            if (!isNaN(sides)) {
                const val = rollDie(sides);
                results.push({ type: dieType, value: val });
                total += val;
            }
        });

        let rollerName = "Anonyme";
        const player = getPlayerBySocketId(socket.id);
        if (player) rollerName = player.name;
        else if (data.player) rollerName = data.player;

        const diceData = { player: rollerName, results, modifier: constantModifier, total };
        io.emit('diceRolled', diceData);
    });

    // --- MODÉRATION MJ ---
    socket.on('updateBoss', (bossData) => {
        gameState.boss = { ...gameState.boss, ...bossData };
        broadcastGameState();
    });

    socket.on('listImages', () => {
        fs.readdir(imageDir, (err, files) => {
            if (err) return socket.emit('imageList', []);
            const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));
            socket.emit('imageList', imageFiles);
        });
    });

    socket.on('deleteImage', (imageName) => {
        const filePath = path.join(imageDir, imageName);
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
                if (err) console.error("Erreur suppression:", err);
                io.emit('refreshImageList');
            });
        }
    });

    socket.on('kickPlayer', (playerId) => {
        const socketId = Object.keys(claimedCharacters).find(key => claimedCharacters[key] === playerId);
        if (socketId) {
            const targetSocket = io.sockets.sockets.get(socketId);
            if (targetSocket) {
                targetSocket.emit('kicked');
                targetSocket.disconnect(true);
            }
            delete claimedCharacters[socketId];
            broadcastGameState();
        }
    });

    socket.on('displayImage', (imageUrl) => io.emit('showImage', imageUrl));
    socket.on('hideImage', () => io.emit('hideImage'));
    socket.on('resetDice', () => io.emit('diceCleared'));

    socket.on('disconnect', () => {
        delete claimedCharacters[socket.id];
        broadcastGameState();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur JdR lancé sur http://localhost:${PORT}`);
});

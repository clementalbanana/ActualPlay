// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { extractDocId, isValidDocId, parseCharacterStats, parseDescription, fetchDocText } = require('./googleDocStats');
const auth = require('./auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.urlencoded({ extended: false }));

const pagesDir = path.join(__dirname, 'public');

// --- Protection par mot de passe des espaces joueur / MJ ---
// Le portail "/", les règles, les fiches publiques et l'overlay OBS restent
// libres ; /create et /gm.* nécessitent le cookie de connexion. La sécurité
// réelle est côté socket (voir io.use plus bas) — cette barrière-ci est surtout
// pour l'expérience utilisateur (redirection vers l'écran de connexion).
const PROTECTED_PATHS = new Set([
    '/create', '/create.html', '/create.js',
    '/gm.html', '/gm.js'
]);

function safeNext(value) {
    return typeof value === 'string' && /^\/[^/\\]/.test(value) ? value : '/create';
}

app.use((req, res, next) => {
    if (PROTECTED_PATHS.has(req.path) && !auth.isAuthedRequest(req)) {
        return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
    }
    next();
});

// --- Connexion / déconnexion ---
const loginAttempts = new Map(); // ip -> { count, blockedUntil }

app.get('/login', (req, res) => {
    if (auth.isAuthedRequest(req)) return res.redirect(safeNext(req.query.next));
    res.sendFile(path.join(pagesDir, 'login.html'));
});

app.post('/login', (req, res) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const record = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };

    if (record.blockedUntil > now) {
        return res.redirect(`/login?e=1&next=${encodeURIComponent(safeNext(req.body.next))}`);
    }

    if (auth.checkPassword(req.body.password)) {
        loginAttempts.delete(ip);
        res.setHeader('Set-Cookie', auth.serializeAuthCookie(auth.signToken(), { secure: req.secure }));
        return res.redirect(safeNext(req.body.next));
    }

    record.count += 1;
    if (record.count >= 5) {
        record.blockedUntil = now + 60 * 1000; // 1 min de blocage après 5 échecs
        record.count = 0;
    }
    loginAttempts.set(ip, record);
    res.redirect(`/login?e=1&next=${encodeURIComponent(safeNext(req.body.next))}`);
});

app.post('/logout', (req, res) => {
    res.setHeader('Set-Cookie', auth.clearAuthCookie());
    res.redirect('/');
});

app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// --- Routes des pages (le routing "fichier = URL" ne suffit plus depuis
// l'ajout du portail public : "/" ne sert plus l'interface Joueur) ---
app.get('/', (req, res) => res.sendFile(path.join(pagesDir, 'portal.html')));
app.get('/create', (req, res) => res.sendFile(path.join(pagesDir, 'create.html')));
app.get('/regles', (req, res) => res.sendFile(path.join(pagesDir, 'regles.html')));
app.get('/fiche', (req, res) => res.sendFile(path.join(pagesDir, 'fiche.html')));
// Ancienne URL de la page d'accueil (interface Joueur) -> redirigée vers /create
app.get('/index.html', (req, res) => res.redirect(301, '/create'));

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
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Type de fichier non supporté'), false);
    }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

app.post('/upload', (req, res, next) => {
    if (!auth.isAuthedRequest(req)) return res.status(401).send('Connexion requise.');
    next();
}, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('Aucun fichier valide n\'a été uploadé.');
    }
    io.emit('refreshImageList');
    res.status(200).send(`Fichier ${req.file.filename} uploadé avec succès.`);
});


// --- État du Jeu & Gestion des "Sessions" ---
let gameState = {
    players: [],
    boss: { name: "Mon boss", hp: 0, maxHp: 0 },
    currentImage: null
};
let claimedCharacters = {}; // socket.id -> player.id

// --- Persistance des fiches de personnages ---
// Les personnages en jeu sont volatils (gameState.players), mais on garde une
// copie sur disque pour : (1) restaurer une fiche quand le joueur revient,
// (2) alimenter le portail public avec les fiches marquées "publiques".
const dataDir = path.join(__dirname, 'data');
const charactersFile = process.env.CHARACTERS_FILE || path.join(dataDir, 'characters.json');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

function loadSavedCharacters() {
    try {
        if (fs.existsSync(charactersFile)) {
            const raw = fs.readFileSync(charactersFile, 'utf-8').trim();
            const parsed = raw ? JSON.parse(raw) : [];
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (err) {
        console.error('Erreur de lecture de characters.json:', err);
    }
    return [];
}

// [{ id, name, hp, maxHp, gold, customStats, isPublic, googleDocId, description }]
let savedCharacters = loadSavedCharacters();

function persistCharacters() {
    try {
        fs.writeFileSync(charactersFile, JSON.stringify(savedCharacters, null, 2));
    } catch (err) {
        console.error('Erreur d\'écriture de characters.json:', err);
    }
}

function upsertSavedCharacter(player) {
    const entry = {
        id: player.id,
        name: player.name,
        hp: player.hp,
        maxHp: player.maxHp,
        gold: player.gold,
        customStats: player.customStats || [],
        isPublic: !!player.isPublic,
        googleDocId: player.googleDocId || null,
        description: player.description || ''
    };
    const idx = savedCharacters.findIndex(c => c.id === player.id);
    if (idx === -1) savedCharacters.push(entry);
    else savedCharacters[idx] = entry;
    persistCharacters();
}

function removeSavedCharacter(playerId) {
    const before = savedCharacters.length;
    savedCharacters = savedCharacters.filter(c => c.id !== playerId);
    if (savedCharacters.length !== before) persistCharacters();
}

function nextCharacterId() {
    const ids = [
        ...gameState.players.map(p => p.id),
        ...savedCharacters.map(c => c.id)
    ];
    return ids.length > 0 ? Math.max(...ids) + 1 : 1;
}

// Vue "publique" d'une fiche : uniquement les champs affichables, jamais de
// donnée d'une fiche privée. Les valeurs live priment sur la dernière sauvegarde.
function publicCharacterView(saved) {
    const live = gameState.players.find(p => p.id === saved.id);
    const src = live || saved;
    return {
        id: saved.id,
        name: src.name,
        hp: src.hp,
        maxHp: src.maxHp,
        gold: src.gold,
        customStats: src.customStats || [],
        description: src.description || '',
        isOnline: Object.values(claimedCharacters).includes(saved.id)
    };
}

function getPublicCharacters() {
    return savedCharacters.filter(c => c.isPublic).map(publicCharacterView);
}

function broadcastPublicCharacters() {
    io.emit('publicCharactersUpdate', getPublicCharacters());
}

// --- Import Google Docs : cibles de parsing + application des valeurs ---
// Le parser ne connaît pas le modèle : on lui décrit quelles stats chercher
// (PV + Or + chaque stat perso du personnage) et leurs bornes.
// Les fiches n'ont pas de "PV Max" : la valeur "PV" du document remplit à la
// fois les PV courants et les PV max (les PV sont réinitialisés au max chaque
// début de séance). Le format "PV: 10 / 20" reste géré (10 -> hp, 20 -> maxHp).
function buildImportTargets(player) {
    const targets = [
        { key: 'hp', label: 'PV', aliases: ['PV Actuels', 'PV Actuel', 'Points de Vie', 'Points de Vie Actuels', 'PdV', 'Vie', 'HP'] },
        { key: 'gold', label: 'Or', aliases: ['Gold', "Pièces d'or", 'Pièces', 'Po'] }
    ];
    (player.customStats || []).forEach((stat, index) => {
        targets.push({ key: `custom:${index}`, label: stat.name, min: 0, max: stat.max });
    });
    return targets;
}

// Applique les valeurs déjà validées/bornées par le parser sur l'objet joueur.
function applyImportedValues(player, values) {
    if (values.hp !== undefined) {
        player.hp = values.hp;
        player.maxHp = values.hpMax !== undefined ? values.hpMax : values.hp;
    }
    if (values.gold !== undefined) player.gold = values.gold;
    Object.keys(values).forEach((key) => {
        const m = /^custom:(\d+)$/.exec(key);
        if (m && player.customStats && player.customStats[Number(m[1])]) {
            player.customStats[Number(m[1])].current = values[key];
        }
    });
}

// --- API publique (lecture seule) pour le portail ---
app.get('/api/characters/public', (req, res) => {
    res.json(getPublicCharacters());
});

app.get('/api/characters/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const saved = savedCharacters.find(c => c.id === id && c.isPublic);
    if (!saved) return res.status(404).json({ error: 'Fiche introuvable ou privée.' });
    res.json(publicCharacterView(saved));
});

// --- Fonctions Utilitaires ---
function rollDie(sides) { return Math.floor(Math.random() * sides) + 1; }
function getPlayerBySocketId(socketId) {
    const playerId = claimedCharacters[socketId];
    return gameState.players.find(p => p.id === playerId);
}

function broadcastGameState() {
    const onlinePlayerIds = Object.values(claimedCharacters);
    const updatedState = {
        ...gameState,
        // Diffusé à tous (dont l'overlay OBS et le portail, non authentifiés) :
        // on n'expose que les champs affichables, pas googleDocId ni description.
        players: gameState.players.map(p => ({
            id: p.id,
            name: p.name,
            hp: p.hp,
            maxHp: p.maxHp,
            gold: p.gold,
            customStats: p.customStats || [],
            isPublic: !!p.isPublic,
            isOnline: onlinePlayerIds.includes(p.id)
        }))
    };
    io.emit('gameStateUpdate', updatedState);
}

// --- Gestion des Connexions Socket.io ---

// Authentification de la connexion : la socket reçoit les broadcasts en lecture
// (overlay, portail…), mais tout événement de mutation exige `socket.data.authed`.
io.use((socket, next) => {
    const cookies = auth.parseCookies(socket.request.headers.cookie || '');
    socket.data.authed = auth.verifyToken(cookies[auth.AUTH_COOKIE_NAME]);
    next();
});

io.on('connection', (socket) => {
    console.log(`Client connecté: ${socket.id} (authed: ${socket.data.authed})`);
    broadcastGameState();
    socket.emit('publicCharactersUpdate', getPublicCharacters());

    // Enveloppe un gestionnaire d'événement réservé aux joueurs connectés.
    const guarded = (handler) => function (...args) {
        if (!socket.data.authed) {
            socket.emit('authRequired', 'Session expirée ou accès non autorisé. Reconnectez-vous.');
            return;
        }
        return handler.apply(this, args);
    };

    // Renvoyer l'image actuelle si elle existe
    if (gameState.currentImage) {
        socket.emit('imageDisplayed', gameState.currentImage);
    }

    socket.on('claimCharacter', guarded((characterName) => {
        if (!characterName) return;
        let player = gameState.players.find(p => p.name.toLowerCase() === characterName.toLowerCase());
        if (player) {
            if (Object.values(claimedCharacters).includes(player.id)) {
                socket.emit('claimError', `Le personnage "${player.name}" est déjà contrôlé par quelqu'un.`);
                return;
            }
        } else {
            const saved = savedCharacters.find(c => c.name.toLowerCase() === characterName.toLowerCase());
            if (saved) {
                // La fiche existe déjà sur disque : on la restaure telle quelle.
                player = {
                    id: saved.id,
                    name: saved.name,
                    hp: saved.hp, maxHp: saved.maxHp, gold: saved.gold,
                    customStats: saved.customStats || [],
                    isPublic: !!saved.isPublic,
                    googleDocId: saved.googleDocId || null,
                    description: saved.description || ''
                };
            } else {
                player = {
                    id: nextCharacterId(),
                    name: characterName,
                    hp: 10, maxHp: 10, gold: 0,
                    customStats: [],
                    isPublic: false,
                    googleDocId: null,
                    description: ''
                };
            }
            gameState.players.push(player);
            upsertSavedCharacter(player);
        }
        claimedCharacters[socket.id] = player.id;
        socket.emit('claimSuccess', player);
        broadcastGameState();
        broadcastPublicCharacters();
    }));

    socket.on('updateStats', guarded((playerData) => {
        const player = getPlayerBySocketId(socket.id);
        if (!player) return;
        player.hp = parseInt(playerData.hp_current, 10) || player.hp;
        player.maxHp = parseInt(playerData.hp_max, 10) || player.maxHp;
        player.gold = parseInt(playerData.gold, 10) || player.gold;
        if (playerData.customStats) player.customStats = playerData.customStats;
        if (typeof playerData.isPublic === 'boolean') player.isPublic = playerData.isPublic;
        if (typeof playerData.googleDocId === 'string') {
            player.googleDocId = extractDocId(playerData.googleDocId) || null;
        }
        upsertSavedCharacter(player);
        broadcastGameState();
        broadcastPublicCharacters();
    }));

    // --- Import des statistiques depuis un Google Doc public ---
    // Toujours déclenché explicitement par le joueur (bouton), jamais en fond.
    socket.on('importGoogleDocStats', guarded(async (payload) => {
        const player = getPlayerBySocketId(socket.id);
        if (!player) return;

        const rawInput = payload && typeof payload.docId === 'string' ? payload.docId : '';
        const docId = extractDocId(rawInput) || player.googleDocId;

        if (!isValidDocId(docId)) {
            socket.emit('googleDocImportResult', {
                ok: false,
                error: "Aucun identifiant de document Google Docs valide n'est associé à ce personnage."
            });
            return;
        }

        let text;
        try {
            text = await fetchDocText(docId);
        } catch (err) {
            socket.emit('googleDocImportResult', { ok: false, error: err.message });
            return;
        }

        const targets = buildImportTargets(player);
        const { values, applied, warnings } = parseCharacterStats(text, targets);
        const description = parseDescription(text);
        if (description === null) {
            warnings.push('« Description » : introuvable dans le document, description inchangée.');
        }

        // Résumé avant / après pour chaque valeur qui va changer.
        const currentValue = (key) => {
            if (key === 'hp') return player.hp;
            if (key === 'maxHp') return player.maxHp;
            if (key === 'gold') return player.gold;
            const m = /^custom:(\d+)$/.exec(key);
            return m && player.customStats[Number(m[1])] ? player.customStats[Number(m[1])].current : undefined;
        };
        const changes = applied
            .map(a => ({ label: a.label, before: currentValue(a.key), after: a.value }))
            .filter(c => c.before !== c.after);
        if (description !== null && description !== (player.description || '')) {
            changes.push({ label: 'Description', note: 'mise à jour depuis le document' });
        }

        applyImportedValues(player, values);
        if (description !== null) player.description = description;
        player.googleDocId = docId;
        upsertSavedCharacter(player);
        broadcastGameState();
        broadcastPublicCharacters();

        socket.emit('googleDocImportResult', {
            ok: true,
            changes,
            warnings,
            player
        });
    }));

    socket.on('rollDice', guarded((data) => {
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
    }));

    // --- MODÉRATION MJ ---
    socket.on('updateBoss', guarded((bossData) => {
        gameState.boss = { ...gameState.boss, ...bossData };
        broadcastGameState();
    }));

    socket.on('listImages', guarded(() => {
        fs.readdir(imageDir, (err, files) => {
            if (err) return socket.emit('imageList', []);
            const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));
            socket.emit('imageList', imageFiles);
        });
    }));

    socket.on('deleteImage', guarded((imageName) => {
        const filePath = path.join(imageDir, imageName);
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
                if (err) console.error("Erreur suppression:", err);
                if (gameState.currentImage === `images/${imageName}`) {
                    gameState.currentImage = null;
                    io.emit('imageHidden');
                }
                io.emit('refreshImageList');
            });
        }
    }));

    socket.on('kickPlayer', guarded((playerId) => {
        const socketId = Object.keys(claimedCharacters).find(key => claimedCharacters[key] === playerId);
        if (socketId) {
            const targetSocket = io.sockets.sockets.get(socketId);
            if (targetSocket) {
                targetSocket.emit('kicked');
                targetSocket.disconnect(true);
            }
            delete claimedCharacters[socketId];
        }
        // Supprimer définitivement le joueur de l'état du jeu pour qu'il disparaisse de l'overlay
        gameState.players = gameState.players.filter(p => p.id !== playerId);
        removeSavedCharacter(playerId);
        broadcastGameState();
        broadcastPublicCharacters();
    }));

    socket.on('displayImage', guarded((imageUrl) => {
        gameState.currentImage = imageUrl;
        io.emit('showImage', imageUrl);
        io.emit('imageDisplayed', imageUrl);
    }));

    socket.on('hideImage', guarded(() => {
        gameState.currentImage = null;
        io.emit('hideImage');
        io.emit('imageHidden');
    }));

    socket.on('resetDice', guarded(() => io.emit('diceCleared')));

    socket.on('disconnect', () => {
        delete claimedCharacters[socket.id];
        broadcastGameState();
        broadcastPublicCharacters();
    });
});

const PORT = process.env.PORT || 3000;

// Ne démarre le serveur que lorsqu'on lance directement `node server.js`
// (les tests l'importent et gèrent eux-mêmes l'écoute).
if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`Serveur JdR lancé sur http://localhost:${PORT}`);
    });
}

module.exports = { app, server, io };

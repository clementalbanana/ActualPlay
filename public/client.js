// Initialisation de la connexion
const socket = io();

// Écoute de l'événement 'initGame' envoyé par le serveur
socket.on('initGame', (data) => {
    console.log("Données reçues du serveur :", data);

    // Exemple simple d'affichage
    const displayArea = document.getElementById('game-info');

    // On formate le JSON pour l'afficher (juste pour tester)
    displayArea.innerHTML = `
        <h2>Boss: ${data.boss.name} (PV: ${data.boss.hp}/${data.boss.maxHp})</h2>
        <h3>Joueurs:</h3>
        <ul>
            ${data.players.map(p => `<li>${p.name} - PV: ${p.hp} - AC: ${p.armor}</li>`).join('')}
        </ul>
    `;
});
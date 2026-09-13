// portal.js — portail public : liste en lecture seule des fiches marquées publiques
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function characterCard(character) {
    const hpPercent = character.maxHp > 0 ? Math.max(0, Math.min(100, (character.hp / character.maxHp) * 100)) : 0;
    const statsHtml = (character.customStats || []).map((stat) => `
        <div class="flex items-center justify-between text-xs text-gray-400">
            <span>${escapeHtml(stat.name)}</span>
            <span>${stat.current} / ${stat.max}</span>
        </div>
    `).join('');

    return `
        <a href="/fiche?id=${encodeURIComponent(character.id)}" class="block bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-indigo-500 transition-colors">
            <div class="flex items-center justify-between mb-2">
                <span class="font-bold">${escapeHtml(character.name)}</span>
                ${character.isOnline ? '<span class="text-[10px] uppercase tracking-wide text-green-400">En ligne</span>' : ''}
            </div>
            <div class="w-full bg-gray-700 rounded-full h-2 mb-1">
                <div class="bg-red-500 h-2 rounded-full" style="width: ${hpPercent}%"></div>
            </div>
            <div class="flex items-center justify-between text-xs text-gray-400 mb-2">
                <span>PV ${character.hp} / ${character.maxHp}</span>
                <span>${character.gold} Or</span>
            </div>
            ${statsHtml}
        </a>
    `;
}

async function loadPublicCharacters() {
    const listEl = document.getElementById('characters-list');
    const emptyMsg = document.getElementById('empty-msg');
    try {
        const res = await fetch('/api/characters/public');
        const characters = await res.json();
        listEl.querySelectorAll('.character-card').forEach((el) => el.remove());
        if (characters.length === 0) {
            emptyMsg.classList.remove('hidden');
            return;
        }
        emptyMsg.classList.add('hidden');
        characters.forEach((character) => {
            listEl.insertAdjacentHTML('beforeend', `<div class="character-card">${characterCard(character)}</div>`);
        });
    } catch (err) {
        console.error('Erreur de chargement des fiches publiques:', err);
    }
}

loadPublicCharacters();

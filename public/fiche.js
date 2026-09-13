// fiche.js — fiche de personnage publique en lecture seule (/fiche?id=…)
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function renderError(message) {
    document.getElementById('fiche-content').innerHTML = `<p class="text-sm text-red-400">${escapeHtml(message)}</p>`;
}

function renderCharacter(character) {
    const hpPercent = character.maxHp > 0 ? Math.max(0, Math.min(100, (character.hp / character.maxHp) * 100)) : 0;
    const statsHtml = (character.customStats || []).map((stat) => {
        const percent = stat.max > 0 ? Math.max(0, Math.min(100, (stat.current / stat.max) * 100)) : 0;
        return `
            <div>
                <div class="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>${escapeHtml(stat.name)}</span>
                    <span>${stat.current} / ${stat.max}</span>
                </div>
                <div class="w-full bg-gray-700 rounded-full h-2">
                    <div class="h-2 rounded-full" style="width: ${percent}%; background-color: ${escapeHtml(stat.color || '#4F46E5')}"></div>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('fiche-content').innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <div class="uppercase tracking-wide text-xs md:text-sm text-indigo-500 font-semibold">${escapeHtml(character.name)}</div>
            ${character.isOnline ? '<span class="text-[10px] uppercase tracking-wide text-green-400">En ligne</span>' : ''}
        </div>

        <div class="space-y-4">
            <div>
                <div class="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Points de Vie</span>
                    <span>${character.hp} / ${character.maxHp}</span>
                </div>
                <div class="w-full bg-gray-700 rounded-full h-3">
                    <div class="bg-red-500 h-3 rounded-full" style="width: ${hpPercent}%"></div>
                </div>
            </div>

            <div class="flex items-center justify-between text-sm">
                <span class="text-gray-400">Or</span>
                <span class="font-bold">${character.gold}</span>
            </div>

            ${statsHtml ? `<div class="space-y-3 pt-2 border-t border-gray-700">${statsHtml}</div>` : ''}

            ${character.description ? `<p class="text-sm text-gray-300 whitespace-pre-wrap pt-2 border-t border-gray-700">${escapeHtml(character.description)}</p>` : ''}
        </div>
    `;
}

async function loadCharacter() {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) {
        renderError("Aucune fiche demandée.");
        return;
    }
    try {
        const res = await fetch(`/api/characters/${encodeURIComponent(id)}`);
        if (!res.ok) {
            renderError('Fiche introuvable ou privée.');
            return;
        }
        renderCharacter(await res.json());
    } catch (err) {
        renderError('Erreur de chargement de la fiche.');
    }
}

loadCharacter();

// googleDocStats.js
// Import de statistiques de personnage depuis un Google Doc public : extraction
// de l'ID, récupération du texte brut, puis parsing "Label: valeur" ligne par
// ligne. Le document doit être partagé en lecture ("Toute personne disposant
// du lien"), sinon Google répond avec une page de connexion HTML.

function extractDocId(input) {
    if (typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (!trimmed) return null;
    const urlMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) return urlMatch[1];
    if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
    return null;
}

function isValidDocId(docId) {
    return typeof docId === 'string' && /^[a-zA-Z0-9_-]{15,}$/.test(docId);
}

async function fetchDocText(docId) {
    const url = `https://docs.google.com/document/d/${docId}/export?format=txt`;
    let response;
    try {
        response = await fetch(url);
    } catch (err) {
        throw new Error('Impossible de contacter Google Docs. Vérifiez la connexion du serveur.');
    }
    if (!response.ok) {
        throw new Error("Impossible de récupérer le document (identifiant invalide ?).");
    }
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    if (contentType.includes('text/html') || /<!DOCTYPE html>/i.test(text)) {
        throw new Error(
            "Le document n'est pas accessible publiquement. Partagez-le avec « Toute personne disposant du lien » (lecture), puis réessayez."
        );
    }
    return text;
}

function parseDescription(text) {
    if (typeof text !== 'string') return null;
    const match = text.match(/^\s*description\s*:\s*(.*)$/im);
    if (!match) return null;
    return match[1].trim() || null;
}

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildLabelPattern(target) {
    const labels = [target.label, ...(target.aliases || [])].filter(Boolean);
    const alternation = labels.map(escapeRegExp).join('|');
    return new RegExp(`^\\s*(?:${alternation})\\s*:\\s*(.+?)\\s*$`, 'i');
}

function extractNumber(raw) {
    const match = raw.match(/-?\d+([.,]\d+)?/);
    if (!match) return null;
    return parseInt(match[0].replace(',', '.'), 10);
}

// targets: [{ key, label, aliases?, min?, max? }]
// Retourne { values, applied, warnings } :
// - values : { hp?, hpMax?, gold?, 'custom:N'?: number } déjà bornées
// - applied : [{ key, label, value }] pour chaque valeur effectivement lue
// - warnings : messages pour les valeurs trouvées mais non exploitables
function parseCharacterStats(text, targets) {
    const values = {};
    const applied = [];
    const warnings = [];
    if (typeof text !== 'string' || !Array.isArray(targets)) {
        return { values, applied, warnings };
    }
    const lines = text.split(/\r?\n/);

    targets.forEach((target) => {
        const pattern = buildLabelPattern(target);
        const line = lines.find((l) => pattern.test(l));
        if (!line) return;
        const raw = line.match(pattern)[1].trim();

        if (target.key === 'hp') {
            const [hpPart, hpMaxPart] = raw.split('/');
            const hp = extractNumber(hpPart);
            if (hp === null) {
                warnings.push(`« ${target.label} » : valeur non numérique ignorée ("${raw}").`);
                return;
            }
            values.hp = hp;
            applied.push({ key: 'hp', label: target.label, value: hp });
            if (hpMaxPart !== undefined) {
                const hpMax = extractNumber(hpMaxPart);
                if (hpMax !== null) {
                    values.hpMax = hpMax;
                    applied.push({ key: 'maxHp', label: `${target.label} Max`, value: hpMax });
                }
            }
            return;
        }

        const num = extractNumber(raw);
        if (num === null) {
            warnings.push(`« ${target.label} » : valeur non numérique ignorée ("${raw}").`);
            return;
        }
        let value = num;
        if (typeof target.min === 'number') value = Math.max(target.min, value);
        if (typeof target.max === 'number') value = Math.min(target.max, value);

        values[target.key] = value;
        applied.push({ key: target.key, label: target.label, value });
    });

    return { values, applied, warnings };
}

module.exports = {
    extractDocId,
    isValidDocId,
    fetchDocText,
    parseDescription,
    parseCharacterStats
};

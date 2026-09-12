// auth.js
// Authentification simple par mot de passe partagé : un cookie signé (HMAC)
// prouve la connexion, sans session serveur ni base de données.
const crypto = require('crypto');

const AUTH_COOKIE_NAME = 'jdr_auth';
const SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';
const PASSWORD = process.env.SITE_PASSWORD || 'ElieEnBikini!2026';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

function sign(value) {
    return crypto.createHmac('sha256', SECRET).update(value).digest('hex');
}

function signToken() {
    const payload = String(Date.now() + TOKEN_TTL_MS);
    return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
    if (typeof token !== 'string' || !token.includes('.')) return false;
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return false;
    const expected = sign(payload);
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length) return false;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;
    const expires = parseInt(payload, 10);
    return Number.isFinite(expires) && Date.now() < expires;
}

function checkPassword(candidate) {
    if (typeof candidate !== 'string') return false;
    const a = Buffer.from(candidate);
    const b = Buffer.from(PASSWORD);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

function parseCookies(header) {
    const out = {};
    if (!header) return out;
    header.split(';').forEach((pair) => {
        const idx = pair.indexOf('=');
        if (idx === -1) return;
        const key = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (key) out[key] = decodeURIComponent(value);
    });
    return out;
}

function serializeAuthCookie(token, { secure } = {}) {
    const parts = [
        `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${Math.floor(TOKEN_TTL_MS / 1000)}`
    ];
    if (secure) parts.push('Secure');
    return parts.join('; ');
}

function clearAuthCookie() {
    return `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function isAuthedRequest(req) {
    const cookies = parseCookies(req.headers.cookie || '');
    return verifyToken(cookies[AUTH_COOKIE_NAME]);
}

module.exports = {
    AUTH_COOKIE_NAME,
    signToken,
    verifyToken,
    checkPassword,
    parseCookies,
    serializeAuthCookie,
    clearAuthCookie,
    isAuthedRequest
};

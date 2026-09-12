import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { io as Client } from 'socket.io-client';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Isole la persistance des personnages dans un fichier temporaire pour ne pas
// polluer data/characters.json. Doit être défini AVANT le chargement du serveur.
const tmpCharactersFile = path.join(os.tmpdir(), `characters-test-${Date.now()}.json`);
process.env.CHARACTERS_FILE = tmpCharactersFile;

const { server } = await import('../server.js'); // import dynamique : après la variable d'env
const auth = (await import('../auth.js')).default;

// Cookie de connexion valide, injecté dans le handshake des sockets de test.
const authCookie = `${auth.AUTH_COOKIE_NAME}=${auth.signToken()}`;

describe('Server Tests', () => {
  let clientSocket;
  let port;

  beforeAll(() => {
    return new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  afterAll(() => {
    return new Promise((resolve) => {
      server.close(() => {
        try { fs.unlinkSync(tmpCharactersFile); } catch (e) { /* déjà absent */ }
        resolve();
      });
    });
  });

  beforeEach(() => {
    return new Promise((resolve) => {
      clientSocket = new Client(`http://localhost:${port}`, {
        extraHeaders: { Cookie: authCookie }
      });
      clientSocket.on('connect', resolve);
    });
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  it('GET / sert le portail public (non protégé)', async () => {
    const response = await fetch(`http://localhost:${port}/`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Fiches de personnages publiques');
  });

  it('GET /overlay.html reste accessible sans connexion', async () => {
    const response = await fetch(`http://localhost:${port}/overlay.html`);
    expect(response.status).toBe(200);
  });

  it('GET /regles sert la page des règles', async () => {
    const response = await fetch(`http://localhost:${port}/regles`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Règles à compléter');
  });

  it('GET /index.html redirige vers /create', async () => {
    const response = await fetch(`http://localhost:${port}/index.html`, { redirect: 'manual' });
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('/create');
  });

  it('GET /api/characters/public renvoie un tableau', async () => {
    const response = await fetch(`http://localhost:${port}/api/characters/public`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  describe('Protection par mot de passe', () => {
    it('GET /create sans cookie redirige vers /login', async () => {
      const res = await fetch(`http://localhost:${port}/create`, { redirect: 'manual' });
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('/login');
    });

    it('GET /gm.html sans cookie redirige vers /login', async () => {
      const res = await fetch(`http://localhost:${port}/gm.html`, { redirect: 'manual' });
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('/login');
    });

    it('POST /login avec le bon mot de passe pose un cookie, puis /create est accessible', async () => {
      const login = await fetch(`http://localhost:${port}/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'password=ElieEnBikini!2026&next=/create',
        redirect: 'manual'
      });
      expect(login.status).toBe(302);
      expect(login.headers.get('location')).toBe('/create');
      const cookie = login.headers.get('set-cookie');
      expect(cookie).toContain(auth.AUTH_COOKIE_NAME);

      const page = await fetch(`http://localhost:${port}/create`, {
        headers: { Cookie: cookie.split(';')[0] }
      });
      expect(page.status).toBe(200);
      expect(await page.text()).toContain('Fiche de Personnage');
    });

    it('POST /login avec un mauvais mot de passe ne pose pas de cookie', async () => {
      const res = await fetch(`http://localhost:${port}/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'password=faux',
        redirect: 'manual'
      });
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('e=1');
      expect(res.headers.get('set-cookie')).toBeNull();
    });

    it('une socket non authentifiée ne peut pas muter l\'état', () => {
      return new Promise((resolve, reject) => {
        const anon = new Client(`http://localhost:${port}`); // pas de cookie
        const timer = setTimeout(() => { anon.disconnect(); resolve(); }, 400);
        anon.on('claimSuccess', () => {
          clearTimeout(timer);
          anon.disconnect();
          reject(new Error('claimSuccess reçu par une socket non authentifiée'));
        });
        anon.on('authRequired', () => {
          clearTimeout(timer);
          anon.disconnect();
          resolve();
        });
        anon.on('connect', () => anon.emit('claimCharacter', 'IntrusSpectateur'));
      });
    });
  });

  it('expose une fiche via l\'API seulement si elle est publique', () => {
    return new Promise((resolve) => {
      const charName = 'PublicHero';

      clientSocket.on('claimSuccess', () => {
        clientSocket.emit('updateStats', {
          hp_current: 8, hp_max: 12, gold: 3, customStats: [], isPublic: true
        });

        setTimeout(async () => {
          const listRes = await fetch(`http://localhost:${port}/api/characters/public`);
          const list = await listRes.json();
          const entry = list.find(c => c.name === charName);
          expect(entry).toBeTruthy();

          const oneRes = await fetch(`http://localhost:${port}/api/characters/${entry.id}`);
          expect(oneRes.status).toBe(200);
          const one = await oneRes.json();
          expect(one.hp).toBe(8);
          expect(one).not.toHaveProperty('isPublic');
          resolve();
        }, 150);
      });

      clientSocket.emit('claimCharacter', charName);
    });
  });

  it('importe stats + description depuis un Google Doc (fetch simulé)', () => {
    return new Promise((resolve) => {
      const charName = 'DocImportHero';
      const fakeDoc = [
        'Fiche',
        'PV: 15 / 30',
        'Or: 200',
        'Force: dix',
        'Description : Un héros forgé pour les tests.',
        ''
      ].join('\n');

      vi.stubGlobal('fetch', async (url) => {
        expect(String(url)).toContain('/document/d/');
        expect(String(url)).toContain('export?format=txt');
        return new Response(fakeDoc, { status: 200, headers: { 'content-type': 'text/plain' } });
      });

      clientSocket.on('claimSuccess', () => {
        clientSocket.emit('updateStats', {
          hp_current: 1, hp_max: 1, gold: 0,
          customStats: [{ name: 'Force', current: 5, max: 12, color: '#fff' }]
        });
      });

      clientSocket.on('googleDocImportResult', (result) => {
        vi.unstubAllGlobals();
        expect(result.ok).toBe(true);
        expect(result.player.hp).toBe(15);
        expect(result.player.maxHp).toBe(30); // "PV: 15 / 30"
        expect(result.player.gold).toBe(200);
        expect(result.player.description).toBe('Un héros forgé pour les tests.');
        // "Force: dix" -> non numérique -> inchangé + avertissement
        expect(result.player.customStats[0].current).toBe(5);
        expect(result.warnings.join(' ')).toContain('Force');
        expect(result.changes).toEqual(expect.arrayContaining([
          expect.objectContaining({ label: 'PV', after: 15 })
        ]));
        resolve();
      });

      clientSocket.emit('claimCharacter', charName);
      setTimeout(() => {
        clientSocket.emit('importGoogleDocStats', {
          docId: 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit'
        });
      }, 120);
    });
  });

  it('signale un document non public', () => {
    return new Promise((resolve) => {
      vi.stubGlobal('fetch', async () => new Response('<!DOCTYPE html><html>Sign in</html>', {
        status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }
      }));

      clientSocket.on('claimSuccess', () => {
        clientSocket.emit('importGoogleDocStats', {
          docId: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'
        });
      });
      clientSocket.on('googleDocImportResult', (result) => {
        vi.unstubAllGlobals();
        expect(result.ok).toBe(false);
        expect(result.error).toContain('accessible publiquement');
        resolve();
      });

      clientSocket.emit('claimCharacter', 'NonPublicDocHero');
    });
  });

  it('should connect to the socket server', () => {
    expect(clientSocket.connected).toBe(true);
  });

  it('should update player stats and broadcast gameStateUpdate', () => {
    return new Promise((resolve) => {
      const charName = 'TestPlayer';

      clientSocket.on('gameStateUpdate', (gameState) => {
        const player = gameState.players.find(p => p.name === charName);
        if (player && player.hp === 5 && player.maxHp === 20) {
          expect(player.hp).toBe(5);
          expect(player.maxHp).toBe(20);
          expect(player.gold).toBe(100);
          resolve();
        }
      });

      clientSocket.on('claimSuccess', () => {
        clientSocket.emit('updateStats', { hp_current: 5, hp_max: 20, gold: 100 });
      });

      clientSocket.emit('claimCharacter', charName);
    });
  });

  it('should handle custom stats correctly', () => {
    return new Promise((resolve) => {
      const charName = 'CustomStatsPlayer';
      const customStatsData = [
        { name: 'Mana', current: 10, max: 20 },
        { name: 'Stamina', current: 5, max: 10 }
      ];

      clientSocket.on('gameStateUpdate', (gameState) => {
        const player = gameState.players.find(p => p.name === charName);
        if (player && player.customStats && player.customStats.length === 2) {
          expect(player.customStats[0].name).toBe('Mana');
          expect(player.customStats[0].current).toBe(10);
          expect(player.customStats[1].name).toBe('Stamina');
          resolve();
        }
      });

      clientSocket.on('claimSuccess', () => {
        clientSocket.emit('updateStats', {
          hp_current: 10, hp_max: 10, gold: 0, customStats: customStatsData
        });
      });

      clientSocket.emit('claimCharacter', charName);
    });
  });
});

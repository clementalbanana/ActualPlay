import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { io as Client } from 'socket.io-client';
import { server } from '../server';

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
      server.close(resolve);
    });
  });

  beforeEach(() => {
    return new Promise((resolve) => {
      clientSocket = new Client(`http://localhost:${port}`);
      clientSocket.on('connect', resolve);
    });
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  it('should respond to HTTP GET /', async () => {
    const response = await fetch(`http://localhost:${port}/`);
    expect(response.status).toBe(200);
  });

  it('should connect to the socket server', () => {
    expect(clientSocket.connected).toBe(true);
  });

  it('should update player stats and broadcast gameStateUpdate', () => {
    return new Promise((resolve) => {
      const charName = 'TestPlayer';
      
      // Écouter les mises à jour de l'état du jeu
      clientSocket.on('gameStateUpdate', (gameState) => {
        const player = gameState.players.find(p => p.name === charName);
        
        // Vérifier si la mise à jour correspond à nos attentes
        if (player && player.hp === 5 && player.maxHp === 20) {
          expect(player.hp).toBe(5);
          expect(player.maxHp).toBe(20);
          expect(player.armor).toBe(15);
          expect(player.gold).toBe(100);
          resolve();
        }
      });

      // Une fois claim, mettre à jour les stats
      clientSocket.on('claimSuccess', () => {
        const updateData = {
          hp_current: 5,
          hp_max: 20,
          armor: 15,
          gold: 100
        };
        clientSocket.emit('updateStats', updateData);
      });

      // Claim le personnage
      clientSocket.emit('claimCharacter', charName);
    });
  });
});

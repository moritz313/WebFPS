const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Statische Dateien servieren
app.use(express.static(path.join(__dirname, 'public')));

// Spieler-Daten
const players = {};
const bullets = [];

// Map-Hindernisse (server-seitig generiert, für alle gleich)
const mapObstacles = [];

// Map-Hindernisse generieren
function generateMapObstacles() {
    console.log('Generiere Map-Hindernisse...');
    
    // Feste Seed für konsistente Map
    const obstacles = [
        { x: 10, y: 1.5, z: 5, width: 3, height: 3, depth: 2 },
        { x: -8, y: 1.5, z: -12, width: 2, height: 4, depth: 3 },
        { x: 15, y: 1, z: -8, width: 2.5, height: 2, depth: 2.5 },
        { x: -15, y: 2, z: 10, width: 3, height: 4, depth: 2 },
        { x: 5, y: 1.5, z: -15, width: 2, height: 3, depth: 2 },
        { x: -5, y: 1, z: 8, width: 4, height: 2, depth: 3 },
        { x: 0, y: 2.5, z: 0, width: 2, height: 5, depth: 2 }, // Zentrale Säule
        { x: -20, y: 1, z: -5, width: 3, height: 2, depth: 4 },
        { x: 12, y: 1.5, z: 12, width: 2, height: 3, depth: 2 },
        { x: -10, y: 1, z: 15, width: 2.5, height: 2, depth: 3 }
    ];
    
    mapObstacles.push(...obstacles);
    console.log(`${mapObstacles.length} Hindernisse generiert`);
}

// Map bei Server-Start generieren
generateMapObstacles();
console.log('Server Map-Daten:', mapObstacles);

// Haupt-Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io Verbindungen
io.on('connection', (socket) => {
    console.log('Spieler verbunden:', socket.id);

    // Neuen Spieler erstellen
    players[socket.id] = {
        id: socket.id,
        x: Math.random() * 20 - 10, // Zufällige Position in der Arena
        y: 1.8, // Augenhöhe
        z: Math.random() * 20 - 10,
        rotationY: 0,
        health: 100,
        alive: true
    };

    // Aktuellen Spielerstatus und Map an neuen Spieler senden
    socket.emit('currentPlayers', players);
    console.log('Sende Map-Daten an neuen Spieler:', socket.id, 'Anzahl Hindernisse:', mapObstacles.length);
    socket.emit('mapData', mapObstacles);
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Spieler-Update
    socket.on('playerUpdate', (playerData) => {
        if (players[socket.id]) {
            players[socket.id].x = playerData.x;
            players[socket.id].y = playerData.y;
            players[socket.id].z = playerData.z;
            players[socket.id].rotationY = playerData.rotationY;
            
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Schuss-Event
    socket.on('shoot', (bulletData) => {
        const bullet = {
            id: Date.now() + Math.random(),
            playerId: socket.id,
            x: bulletData.x,
            y: bulletData.y,
            z: bulletData.z,
            directionX: bulletData.directionX,
            directionY: bulletData.directionY,
            directionZ: bulletData.directionZ,
            speed: 50,
            lifetime: 3000, // 3 Sekunden
            damage: bulletData.damage || 25,
            weaponType: bulletData.weaponType || 'rifle'
        };
        
        bullets.push(bullet);
        io.emit('bulletFired', bullet);
        
        // Bullet Kollisionserkennung mit Hindernissen
        const checkBulletCollision = setInterval(() => {
            const currentBullet = bullets.find(b => b.id === bullet.id);
            if (!currentBullet) {
                clearInterval(checkBulletCollision);
                return;
            }
            
            // Position aktualisieren
            currentBullet.x += currentBullet.directionX * currentBullet.speed * 0.016;
            currentBullet.y += currentBullet.directionY * currentBullet.speed * 0.016;
            currentBullet.z += currentBullet.directionZ * currentBullet.speed * 0.016;
            
            // Kollision mit Hindernissen prüfen
            for (const obstacle of mapObstacles) {
                const dx = Math.abs(currentBullet.x - obstacle.x);
                const dy = Math.abs(currentBullet.y - obstacle.y);
                const dz = Math.abs(currentBullet.z - obstacle.z);
                
                if (dx < obstacle.width / 2 && 
                    dy < obstacle.height / 2 && 
                    dz < obstacle.depth / 2) {
                    
                    // Bullet getroffen
                    const index = bullets.findIndex(b => b.id === bullet.id);
                    if (index > -1) {
                        bullets.splice(index, 1);
                        io.emit('bulletDestroyed', bullet.id);
                        clearInterval(checkBulletCollision);
                        console.log('Bullet trifft Hindernis');
                        return;
                    }
                }
            }
            
            // Arena-Grenzen prüfen
            if (Math.abs(currentBullet.x) > 50 || Math.abs(currentBullet.z) > 50 || 
                currentBullet.y < 0 || currentBullet.y > 10) {
                const index = bullets.findIndex(b => b.id === bullet.id);
                if (index > -1) {
                    bullets.splice(index, 1);
                    io.emit('bulletDestroyed', bullet.id);
                    clearInterval(checkBulletCollision);
                }
            }
        }, 16); // ~60 FPS
        
        // Bullet nach Lifetime entfernen
        setTimeout(() => {
            const index = bullets.findIndex(b => b.id === bullet.id);
            if (index > -1) {
                bullets.splice(index, 1);
                io.emit('bulletDestroyed', bullet.id);
            }
            clearInterval(checkBulletCollision);
        }, bullet.lifetime);
    });

    // Spieler-Treffer
    socket.on('playerHit', (data) => {
        const targetPlayer = players[data.targetId];
        const shooterPlayer = players[socket.id];
        
        // Verhindern dass Spieler sich selbst treffen
        if (data.targetId === socket.id) {
            return;
        }
        
        if (targetPlayer && targetPlayer.alive && shooterPlayer && shooterPlayer.alive) {
            console.log(`Spieler ${socket.id} trifft ${data.targetId} für ${data.damage} Schaden`);
            
            targetPlayer.health -= data.damage;
            
            if (targetPlayer.health <= 0) {
                targetPlayer.alive = false;
                targetPlayer.health = 0;
                io.emit('playerDied', data.targetId);
                
                // Respawn nach 5 Sekunden
                setTimeout(() => {
                    if (players[data.targetId]) {
                        players[data.targetId].health = 100;
                        players[data.targetId].alive = true;
                        players[data.targetId].x = Math.random() * 20 - 10;
                        players[data.targetId].z = Math.random() * 20 - 10;
                        io.emit('playerRespawned', players[data.targetId]);
                    }
                }, 5000);
            }
            
            io.emit('playerHealthUpdate', {
                playerId: data.targetId,
                health: targetPlayer.health,
                alive: targetPlayer.alive
            });
        }
    });

    // Spieler Disconnect
    socket.on('disconnect', () => {
        console.log('Spieler getrennt:', socket.id);
        delete players[socket.id];
        socket.broadcast.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
    console.log(`Öffne http://localhost:${PORT} in zwei Browser-Fenstern zum Testen`);
}); 
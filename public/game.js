// Game Variablen
let scene, camera, renderer, socket;
let player, players = {};
let bullets = [];
let gameStarted = false;
let isPointerLocked = false;
let mapObstacles = [];

// Steuerung
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    space: false,
    shift: false
};

// Player Eigenschaften
const PLAYER_HEIGHT = 1.8;
const PLAYER_SPEED = 5;
const SPRINT_MULTIPLIER = 2;
const JUMP_FORCE = 8;
const GRAVITY = -20;
const GROUND_Y = 1.8;
const MOUSE_SENSITIVITY = 0.002;

// Waffen-System
const WEAPONS = {
    RIFLE: {
        name: 'Gewehr',
        damage: 25,
        bulletsPerShot: 1,
        spread: 0,
        color: 0x00ff00
    },
    SHOTGUN: {
        name: 'Shotgun',
        damage: 15,
        bulletsPerShot: 8,
        spread: 0.15,
        color: 0xff4444
    }
};

let currentWeapon = WEAPONS.RIFLE;

// Bewegungs-Variablen
let velocityY = 0;
let isGrounded = true;

// Kollisionserkennung mit Hindernissen
function checkCollisionWithObstacles(x, z, playerRadius = 0.5) {
    for (const obstacle of mapObstacles) {
        // AABB Kollisionserkennung (Axis-Aligned Bounding Box)
        const dx = Math.abs(x - obstacle.x);
        const dz = Math.abs(z - obstacle.z);
        
        // Erweiterte Bounding Box um Player-Radius
        const halfWidth = obstacle.width / 2 + playerRadius;
        const halfDepth = obstacle.depth / 2 + playerRadius;
        
        if (dx < halfWidth && dz < halfDepth) {
            return true; // Kollision erkannt
        }
    }
    return false; // Keine Kollision
}

// UI Elemente
const menu = document.getElementById('menu');
const startBtn = document.getElementById('startBtn');
const healthValue = document.getElementById('healthValue');
const healthBar = document.getElementById('health');
const deathScreen = document.getElementById('death-screen');
const respawnTimer = document.getElementById('respawn-timer');

// Event Listeners
startBtn.addEventListener('click', startGame);
document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);
document.addEventListener('click', onMouseClick);
document.addEventListener('pointerlockchange', onPointerLockChange);
document.addEventListener('mousemove', onMouseMove);

// Socket.io Verbindung  
socket = io();

// Debug: Alle Socket-Events loggen
socket.onAny((eventName, ...args) => {
    console.log(`📡 Socket Event: ${eventName}`, args);
});

// Socket Events sofort aktivieren (nicht erst bei Spiel-Start!)
socket.on('currentPlayers', (serverPlayers) => {
    console.log('Aktuelle Spieler erhalten:', Object.keys(serverPlayers));
    Object.keys(serverPlayers).forEach(id => {
        if (id !== socket.id) {
            console.log('Füge anderen Spieler hinzu:', id);
            // Nur hinzufügen wenn Spiel läuft UND Szene existiert
            if (gameStarted && scene) {
                addOtherPlayer(serverPlayers[id]);
            } else {
                // Speichern für später wenn Spiel startet
                window.pendingPlayers = window.pendingPlayers || {};
                window.pendingPlayers[id] = serverPlayers[id];
                console.log('Spieler für später gespeichert (Spiel nicht gestartet)');
            }
        } else {
            console.log('Das bin ich selbst:', id);
        }
    });
});

socket.on('newPlayer', (playerData) => {
    console.log('Neuer Spieler Event erhalten:', playerData);
    if (gameStarted && scene) {
        addOtherPlayer(playerData);
    } else {
        window.pendingPlayers = window.pendingPlayers || {};
        window.pendingPlayers[playerData.id] = playerData;
        console.log('Neuer Spieler für später gespeichert');
    }
});

socket.on('playerMoved', (playerData) => {
    if (players[playerData.id]) {
        players[playerData.id].position.x = playerData.x;
        players[playerData.id].position.y = playerData.y - 1; // Anpassung für Boden-Position
        players[playerData.id].position.z = playerData.z;
        players[playerData.id].rotation.y = playerData.rotationY;
    } else {
        console.log('Spieler-Update für unbekannten Spieler:', playerData.id);
    }
});

socket.on('playerDisconnected', (playerId) => {
    if (players[playerId]) {
        scene.remove(players[playerId]);
        delete players[playerId];
    }
    // Auch aus pending entfernen
    if (window.pendingPlayers && window.pendingPlayers[playerId]) {
        delete window.pendingPlayers[playerId];
    }
});

socket.on('bulletFired', (bulletData) => {
    // Alle Bullets visualisieren, auch eigene (für andere Spieler sichtbar)
    if (gameStarted && scene) {
        createBulletVisual(bulletData);
    }
});

socket.on('bulletDestroyed', (bulletId) => {
    if (gameStarted && scene) {
        const bulletIndex = bullets.findIndex(b => b.userData.id === bulletId);
        if (bulletIndex > -1) {
            scene.remove(bullets[bulletIndex]);
            bullets.splice(bulletIndex, 1);
        }
    }
});

socket.on('playerHealthUpdate', (data) => {
    if (data.playerId === socket.id) {
        updateHealth(data.health);
        if (!data.alive) {
            showDeathScreen();
        }
    }
});

socket.on('playerDied', (playerId) => {
    // Visueller Effekt für andere Spieler
    if (players[playerId]) {
        players[playerId].visible = false;
    }
});

socket.on('playerRespawned', (playerData) => {
    if (playerData.id === socket.id) {
        hideDeathScreen();
        camera.position.set(playerData.x, playerData.y, playerData.z);
        updateHealth(100);
    } else if (players[playerData.id]) {
        players[playerData.id].position.set(playerData.x, playerData.y, playerData.z);
        players[playerData.id].visible = true;
    }
});

socket.on('mapData', (obstacles) => {
    console.log('🗺️ Map-Daten erhalten:', obstacles.length, 'Hindernisse');
    console.log('Erste Hindernisse:', obstacles.slice(0, 3));
    mapObstacles = obstacles;
    
    // Wenn Spiel bereits gestartet, Hindernisse sofort laden
    if (gameStarted && scene) {
        console.log('Spiel läuft bereits, lade Hindernisse sofort...');
        createObstacles();
    } else {
        console.log('Spiel noch nicht gestartet, Hindernisse werden später geladen');
    }
});

function loadPendingPlayers() {
    console.log('Lade pending Spieler...');
    if (window.pendingPlayers) {
        Object.keys(window.pendingPlayers).forEach(id => {
            console.log('Lade pending Spieler:', id);
            addOtherPlayer(window.pendingPlayers[id]);
        });
        window.pendingPlayers = {}; // Clear nach dem Laden
    }
}

function startGame() {
    if (gameStarted) return;
    
    // Prüfen ob Three.js geladen ist
    if (typeof THREE === 'undefined') {
        alert('Three.js konnte nicht geladen werden. Bitte lade die Seite neu.');
        return;
    }
    
    gameStarted = true;
    menu.classList.add('hidden');
    document.body.classList.add('playing');
    
    initThreeJS();
    createArena();
    setupCamera();
    
    // Debug-Timer setzen
    window.gameStartTime = Date.now();
    
    // Pending Spieler laden die vor Spiel-Start empfangen wurden
    loadPendingPlayers();
    
    // Hindernisse laden falls Map-Daten bereits vorhanden
    console.log('🎮 Spiel gestartet. Map-Daten verfügbar:', mapObstacles.length, 'Hindernisse');
    if (mapObstacles.length > 0) {
        console.log('Lade Hindernisse beim Spiel-Start...');
        createObstacles();
    } else {
        console.log('❌ Keine Map-Daten verfügbar beim Spiel-Start. Warte auf Server...');
    }
    
    animate();
    
    // UI initialisieren
    updateWeaponUI();
    
    // Pointer Lock für FPS-Steuerung
    document.body.requestPointerLock();
}

function initThreeJS() {
    // Szene erstellen
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x888888, 50, 200); // Hellerer Nebel
    
    // Renderer erstellen
    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('gameCanvas'),
        antialias: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Licht hinzufügen - viel heller!
    const ambientLight = new THREE.AmbientLight(0x808080, 0.8); // Helleres ambient light
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); // Stärkeres directional light
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Zusätzliche Lichtquellen für bessere Ausleuchtung
    const pointLight1 = new THREE.PointLight(0xffffff, 0.6, 100);
    pointLight1.position.set(25, 15, 25);
    scene.add(pointLight1);
    
    const pointLight2 = new THREE.PointLight(0xffffff, 0.6, 100);
    pointLight2.position.set(-25, 15, -25);
    scene.add(pointLight2);
    
    const pointLight3 = new THREE.PointLight(0xffffff, 0.6, 100);
    pointLight3.position.set(25, 15, -25);
    scene.add(pointLight3);
    
    const pointLight4 = new THREE.PointLight(0xffffff, 0.6, 100);
    pointLight4.position.set(-25, 15, 25);
    scene.add(pointLight4);
}

function createArena() {
    // Boden - heller
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 }); // Hellerer Boden
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    
    // Wände
    const wallHeight = 10;
    const wallThickness = 1;
    
    // Wand Material - heller
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xaaaaaa }); // Hellere Wände
    
    // Nord-Wand
    const northWall = new THREE.Mesh(
        new THREE.BoxGeometry(100, wallHeight, wallThickness),
        wallMaterial
    );
    northWall.position.set(0, wallHeight/2, -50);
    northWall.castShadow = true;
    scene.add(northWall);
    
    // Süd-Wand
    const southWall = new THREE.Mesh(
        new THREE.BoxGeometry(100, wallHeight, wallThickness),
        wallMaterial
    );
    southWall.position.set(0, wallHeight/2, 50);
    southWall.castShadow = true;
    scene.add(southWall);
    
    // West-Wand
    const westWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, wallHeight, 100),
        wallMaterial
    );
    westWall.position.set(-50, wallHeight/2, 0);
    westWall.castShadow = true;
    scene.add(westWall);
    
    // Ost-Wand
    const eastWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, wallHeight, 100),
        wallMaterial
    );
    eastWall.position.set(50, wallHeight/2, 0);
    eastWall.castShadow = true;
    scene.add(eastWall);
    
    // Hindernisse werden jetzt server-seitig geladen
    // createObstacles() wird nach Erhalt der Map-Daten aufgerufen
}

function setupCamera() {
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Sichere Spawn-Position finden
    let spawnX = 0;
    let spawnZ = 0;
    let attempts = 0;
    
    // Versuche eine freie Position zu finden
    while (checkCollisionWithObstacles(spawnX, spawnZ) && attempts < 50) {
        spawnX = (Math.random() - 0.5) * 40; // Kleinerer Spawn-Bereich
        spawnZ = (Math.random() - 0.5) * 40;
        attempts++;
    }
    
    camera.position.set(spawnX, PLAYER_HEIGHT, spawnZ);
    console.log(`Spieler gespawnt bei (${spawnX.toFixed(2)}, ${PLAYER_HEIGHT}, ${spawnZ.toFixed(2)}) nach ${attempts} Versuchen`);
}

function createObstacles() {
    console.log('🏗️ Erstelle Hindernisse basierend auf Server-Daten...');
    console.log('Szene vorhanden:', !!scene);
    console.log('Map-Daten:', mapObstacles);
    
    if (!mapObstacles || mapObstacles.length === 0) {
        console.log('❌ Keine Map-Daten verfügbar');
        return;
    }
    
    if (!scene) {
        console.log('❌ Keine Szene verfügbar');
        return;
    }
    
    const boxMaterial = new THREE.MeshLambertMaterial({ color: 0xCD853F }); // Hellere Hindernisse (Sandy Brown)
    
    mapObstacles.forEach((obstacle, index) => {
        console.log(`Erstelle Hindernis ${index + 1}:`, obstacle);
        
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(obstacle.width, obstacle.height, obstacle.depth),
            boxMaterial
        );
        
        box.position.set(obstacle.x, obstacle.y, obstacle.z);
        box.castShadow = true;
        box.receiveShadow = true;
        box.userData.isObstacle = true;
        box.userData.obstacleData = obstacle;
        
        scene.add(box);
        console.log(`✅ Hindernis ${index + 1} zur Szene hinzugefügt bei (${obstacle.x}, ${obstacle.y}, ${obstacle.z})`);
    });
    
    console.log(`🎉 ${mapObstacles.length} Hindernisse erfolgreich erstellt. Szenen-Kinder:`, scene.children.length);
}

function addOtherPlayer(playerData) {
    console.log('Neuer Spieler hinzugefügt:', playerData.id, 'Position:', playerData.x, playerData.y, playerData.z);
    
    // Prüfen ob Spieler bereits existiert
    if (players[playerData.id]) {
        console.log('Spieler existiert bereits, entferne alten...');
        scene.remove(players[playerData.id]);
        delete players[playerData.id];
    }
    
    // Einfacher Box-Körper (erst mal für Tests)
    const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
    const playerMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
    
    // Kopf
    const headGeometry = new THREE.SphereGeometry(0.4, 8, 8);
    const headMaterial = new THREE.MeshLambertMaterial({ color: 0xffff00 });
    const headMesh = new THREE.Mesh(headGeometry, headMaterial);
    headMesh.position.set(0, 1.2, 0);
    
    // Name-Tag über dem Kopf
    const nameGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const nameMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const nameMesh = new THREE.Mesh(nameGeometry, nameMaterial);
    nameMesh.position.set(0, 2, 0);
    
    // Gruppe erstellen
    const playerGroup = new THREE.Group();
    playerGroup.add(playerMesh);
    playerGroup.add(headMesh);
    playerGroup.add(nameMesh);
    
    // Position setzen
    playerGroup.position.set(playerData.x, playerData.y - 1, playerData.z); // Y-1 da Player auf Boden steht
    playerGroup.rotation.y = playerData.rotationY || 0;
    
    // Schatten aktivieren
    playerMesh.castShadow = true;
    headMesh.castShadow = true;
    playerMesh.receiveShadow = true;
    
    players[playerData.id] = playerGroup;
    scene.add(playerGroup);
    
    console.log('Spieler erfolgreich zur Szene hinzugefügt. Anzahl Spieler in Szene:', Object.keys(players).length);
    console.log('Szenen-Kinder:', scene.children.length);
}

function createBulletVisual(bulletData) {
    const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    
    // Farbe basierend auf Waffe und Spieler
    let bulletColor;
    if (bulletData.playerId === socket.id) {
        // Meine Bullets - Farbe je nach Waffe
        bulletColor = bulletData.color || 0x00ff00;
    } else {
        // Gegner-Bullets - immer rot
        bulletColor = 0xff0000;
    }
    
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: bulletColor });
    const bulletMesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
    
    bulletMesh.position.set(bulletData.x, bulletData.y, bulletData.z);
    bulletMesh.userData = {
        id: bulletData.id,
        playerId: bulletData.playerId,
        direction: new THREE.Vector3(bulletData.directionX, bulletData.directionY, bulletData.directionZ),
        speed: bulletData.speed,
        damage: bulletData.damage || 25
    };
    
    bullets.push(bulletMesh);
    scene.add(bulletMesh);
}

function shoot() {
    const baseDirection = new THREE.Vector3(0, 0, -1);
    baseDirection.applyQuaternion(camera.quaternion);
    
    // Je nach Waffe verschiedene Anzahl Bullets erstellen
    for (let i = 0; i < currentWeapon.bulletsPerShot; i++) {
        const direction = baseDirection.clone();
        
        // Spread für Shotgun hinzufügen
        if (currentWeapon.spread > 0) {
            const spreadX = (Math.random() - 0.5) * currentWeapon.spread;
            const spreadY = (Math.random() - 0.5) * currentWeapon.spread;
            
            direction.x += spreadX;
            direction.y += spreadY;
            direction.normalize();
        }
        
        const bulletData = {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            directionX: direction.x,
            directionY: direction.y,
            directionZ: direction.z,
            damage: currentWeapon.damage,
            weaponType: currentWeapon === WEAPONS.RIFLE ? 'rifle' : 'shotgun'
        };
        
        socket.emit('shoot', bulletData);
        createBulletVisual({
            ...bulletData,
            id: Date.now() + Math.random() + i,
            playerId: socket.id,
            speed: 50,
            color: currentWeapon.color
        });
    }
    
    // Rückstoß-Effekt - stärker bei Shotgun
    const recoilMultiplier = currentWeapon === WEAPONS.SHOTGUN ? 2 : 1;
    camera.rotation.x += (Math.random() - 0.5) * 0.02 * recoilMultiplier;
    camera.rotation.y += (Math.random() - 0.5) * 0.02 * recoilMultiplier;
}

function updatePlayer() {
    if (!gameStarted) return;
    
    const deltaTime = 0.016; // 60 FPS
    
    // Bewegungsrichtung berechnen
    const direction = new THREE.Vector3();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    
    if (keys.w) direction.add(forward);
    if (keys.s) direction.sub(forward);
    if (keys.a) direction.sub(right);
    if (keys.d) direction.add(right);
    
    direction.normalize();
    
    // Geschwindigkeit bestimmen (Sprint oder normal)
    let currentSpeed = PLAYER_SPEED;
    if (keys.shift) {
        currentSpeed *= SPRINT_MULTIPLIER;
    }
    
    direction.multiplyScalar(currentSpeed * deltaTime);
    
    // Springen
    if (keys.space && isGrounded) {
        velocityY = JUMP_FORCE;
        isGrounded = false;
    }
    
    // Schwerkraft anwenden
    velocityY += GRAVITY * deltaTime;
    
    // Y-Position aktualisieren
    camera.position.y += velocityY * deltaTime;
    
    // Boden-Kollision
    if (camera.position.y <= GROUND_Y) {
        camera.position.y = GROUND_Y;
        velocityY = 0;
        isGrounded = true;
    }
    
    // Kollisionserkennung mit Wänden und Hindernissen
    const newX = camera.position.x + direction.x;
    const newZ = camera.position.z + direction.z;
    
    // Versuch beide Achsen gleichzeitig zu bewegen
    if (Math.abs(newX) < 49 && Math.abs(newZ) < 49 && 
        !checkCollisionWithObstacles(newX, newZ)) {
        // Beide Richtungen frei - normale Bewegung
        camera.position.x = newX;
        camera.position.z = newZ;
    } else {
        // Kollision detected - versuche entlang Wänden zu gleiten
        
        // Nur X-Achse bewegen (Z bleibt gleich)
        if (Math.abs(newX) < 49 && !checkCollisionWithObstacles(newX, camera.position.z)) {
            camera.position.x = newX;
        }
        
        // Nur Z-Achse bewegen (X bleibt gleich)
        if (Math.abs(newZ) < 49 && !checkCollisionWithObstacles(camera.position.x, newZ)) {
            camera.position.z = newZ;
        }
    }
    
    // Position an Server senden
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(camera.quaternion);
    
    socket.emit('playerUpdate', {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        rotationY: euler.y
    });
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        const direction = bullet.userData.direction;
        const speed = bullet.userData.speed * 0.016;
        
        bullet.position.add(direction.clone().multiplyScalar(speed));
        
        // Kollisionserkennung mit anderen Spielern (NICHT mit sich selbst!)
        let hitDetected = false;
        Object.keys(players).forEach(playerId => {
            const otherPlayer = players[playerId];
            if (otherPlayer && bullet.userData.playerId !== playerId && 
                bullet.position.distanceTo(otherPlayer.position) < 1) {
                
                // Nur wenn es MEIN Bullet ist, Hit an Server senden
                if (bullet.userData.playerId === socket.id) {
                    socket.emit('playerHit', {
                        targetId: playerId,
                        damage: bullet.userData.damage
                    });
                }
                
                // Bullet entfernen
                scene.remove(bullet);
                bullets.splice(i, 1);
                hitDetected = true;
            }
        });
        
        if (hitDetected) continue;
        
        // Client-seitige Kollisionserkennung mit Hindernissen (für sofortiges visuelles Feedback)
        mapObstacles.forEach(obstacle => {
            const dx = Math.abs(bullet.position.x - obstacle.x);
            const dy = Math.abs(bullet.position.y - obstacle.y);
            const dz = Math.abs(bullet.position.z - obstacle.z);
            
            if (dx < obstacle.width / 2 && 
                dy < obstacle.height / 2 && 
                dz < obstacle.depth / 2) {
                
                // Bullet trifft Hindernis - visuell entfernen
                scene.remove(bullet);
                bullets.splice(i, 1);
                hitDetected = true;
            }
        });
        
        if (hitDetected) continue;
        
        // Bullet entfernen wenn außerhalb der Arena
        if (Math.abs(bullet.position.x) > 50 || Math.abs(bullet.position.z) > 50 || 
            bullet.position.y < 0 || bullet.position.y > 10) {
            scene.remove(bullet);
            bullets.splice(i, 1);
        }
    }
}

function updateWeaponUI() {
    const weaponDisplay = document.getElementById('weapon-display');
    const weaponIcon = document.getElementById('weapon-icon');
    
    if (weaponDisplay) {
        weaponDisplay.textContent = currentWeapon.name;
        weaponDisplay.style.color = `#${currentWeapon.color.toString(16).padStart(6, '0')}`;
    }
    
    if (weaponIcon) {
        // Verschiedene Icons für verschiedene Waffen
        if (currentWeapon === WEAPONS.RIFLE) {
            weaponIcon.textContent = '🔫'; // Pistole/Gewehr
        } else if (currentWeapon === WEAPONS.SHOTGUN) {
            weaponIcon.textContent = '💥'; // Explosion/Shotgun
        }
        weaponIcon.style.color = `#${currentWeapon.color.toString(16).padStart(6, '0')}`;
    }
}

function updateHealth(health) {
    healthValue.textContent = health;
    if (health <= 30) {
        healthBar.classList.add('low');
    } else {
        healthBar.classList.remove('low');
    }
}

function showDeathScreen() {
    deathScreen.classList.remove('hidden');
    let timer = 5;
    respawnTimer.textContent = timer;
    
    const countdown = setInterval(() => {
        timer--;
        respawnTimer.textContent = timer;
        if (timer <= 0) {
            clearInterval(countdown);
        }
    }, 1000);
}

function hideDeathScreen() {
    deathScreen.classList.add('hidden');
}

function animate() {
    if (!gameStarted) return;
    
    requestAnimationFrame(animate);
    
    updatePlayer();
    updateBullets();
    
    renderer.render(scene, camera);
}

// Event Handler
function onKeyDown(event) {
    switch(event.code) {
        case 'KeyW':
            keys.w = true;
            break;
        case 'KeyA':
            keys.a = true;
            break;
        case 'KeyS':
            keys.s = true;
            break;
        case 'KeyD':
            keys.d = true;
            break;
        case 'Space':
            event.preventDefault(); // Verhindert Scrollen
            keys.space = true;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            keys.shift = true;
            break;
        case 'Digit1':
            currentWeapon = WEAPONS.RIFLE;
            updateWeaponUI();
            break;
        case 'Digit2':
            currentWeapon = WEAPONS.SHOTGUN;
            updateWeaponUI();
            break;
        case 'Escape':
            if (isPointerLocked) {
                document.exitPointerLock();
            }
            break;
    }
}

function onKeyUp(event) {
    switch(event.code) {
        case 'KeyW':
            keys.w = false;
            break;
        case 'KeyA':
            keys.a = false;
            break;
        case 'KeyS':
            keys.s = false;
            break;
        case 'KeyD':
            keys.d = false;
            break;
        case 'Space':
            keys.space = false;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            keys.shift = false;
            break;
    }
}

function onMouseClick(event) {
    if (gameStarted && isPointerLocked && event.button === 0) {
        shoot();
    }
    
    if (!isPointerLocked && gameStarted) {
        document.body.requestPointerLock();
    }
}

function onPointerLockChange() {
    isPointerLocked = document.pointerLockElement === document.body;
}

function onMouseMove(event) {
    if (!isPointerLocked || !gameStarted) return;
    
    // Euler-Objekt für bessere Rotation verwenden
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(camera.quaternion);
    
    euler.y -= event.movementX * MOUSE_SENSITIVITY;
    euler.x -= event.movementY * MOUSE_SENSITIVITY;
    
    // Vertikale Rotation begrenzen
    euler.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, euler.x));
    
    camera.quaternion.setFromEuler(euler);
}

// Window Resize Handler
window.addEventListener('resize', () => {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});

// Menü initial anzeigen
menu.classList.remove('hidden'); 
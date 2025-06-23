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
const JUMP_FORCE = 12;
const GRAVITY = -12;
const GROUND_Y = 1.8;
const MOUSE_SENSITIVITY = 0.002;

// Waffen-System
const WEAPONS = {
    RIFLE: {
        name: 'Gewehr',
        damage: 25,
        bulletsPerShot: 1,
        spread: 0,
        color: 0x00ff00,
        cooldown: 150 // 0.15 Sekunden
    },
    SHOTGUN: {
        name: 'Shotgun',
        damage: 15,
        bulletsPerShot: 8,
        spread: 0.15,
        color: 0xff4444,
        cooldown: 800 // 0.8 Sekunden
    },
    SNIPER: {
        name: 'Sniper',
        damage: 80,
        bulletsPerShot: 1,
        spread: 0,
        color: 0x0088ff,
        cooldown: 1000 // 1 Sekunde
    }
};

let currentWeapon = WEAPONS.RIFLE;

// Bewegungs-Variablen
let velocityY = 0;
let isGrounded = true;

// Sniper-spezifische Variablen
let isZoomed = false;
let normalFOV = 75;
let zoomedFOV = 25;
let lastShotTime = 0;

// Kollisionserkennung mit Hindernissen - nur horizontal (für Bewegung)
function checkHorizontalCollisionWithObstacles(x, z, playerRadius = 0.5) {
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

// Erweiterte Kollisionserkennung für Boden (Blöcke als Plattformen)
function getGroundHeightAt(x, z, currentY, playerRadius = 0.5) {
    let maxGroundHeight = GROUND_Y; // Standard-Bodenhöhe
    
    for (const obstacle of mapObstacles) {
        // Prüfen ob Spieler über dem Block ist
        const dx = Math.abs(x - obstacle.x);
        const dz = Math.abs(z - obstacle.z);
        
        // Etwas kleinere Bounding Box für Boden-Kollision (damit man nicht an den Kanten hängen bleibt)
        const halfWidth = obstacle.width / 2 - 0.1;
        const halfDepth = obstacle.depth / 2 - 0.1;
        
        if (dx < halfWidth && dz < halfDepth) {
            // Spieler ist über dem Block - Block-Oberkante als Boden verwenden
            const blockTop = obstacle.y + obstacle.height / 2;
            
            // Nur als Boden verwenden wenn Spieler nah genug ist (nicht weit drüber)
            if (blockTop > maxGroundHeight && currentY <= blockTop + 0.5) {
                maxGroundHeight = blockTop;
            }
        }
    }
    
    return maxGroundHeight;
}

// Prüfen ob Spieler in einen Block fallen würde (für vertikal nach unten)
function checkVerticalCollisionFromAbove(x, y, z, playerRadius = 0.5) {
    // Diese Funktion ist jetzt deaktiviert - nur noch einfache Boden-Kollision
    return { collision: false };
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
document.addEventListener('mousedown', onMouseDown);
document.addEventListener('mouseup', onMouseUp);
document.addEventListener('contextmenu', (event) => event.preventDefault()); // Kontextmenü deaktivieren
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
    createSkybox();
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

function createSkybox() {
    console.log('🌤️ Lade Skybox...');
    
    // Texture Loader
    const loader = new THREE.TextureLoader();
    
    // Skybox Texture laden
    loader.load(
        'https://i.imgur.com/3w4dMZJ.jpeg',
        function(texture) {
            // Texture erfolgreich geladen
            console.log('✅ Skybox Texture geladen');
            
            // Große Sphere für Skybox erstellen
            const skyboxGeometry = new THREE.SphereGeometry(500, 32, 32);
            
            // Material mit der Texture, von innen sichtbar
            const skyboxMaterial = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.BackSide // Von innen sichtbar
            });
            
            // Skybox Mesh erstellen
            const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
            skybox.name = 'skybox';
            
            // Zur Szene hinzufügen
            scene.add(skybox);
            console.log('🌤️ Skybox zur Szene hinzugefügt');
        },
        function(progress) {
            // Loading Progress
            console.log('📥 Skybox Loading Progress:', (progress.loaded / progress.total * 100).toFixed(1) + '%');
        },
        function(error) {
            // Loading Error
            console.error('❌ Fehler beim Laden der Skybox:', error);
            console.log('🔄 Verwende Fallback-Skybox...');
            createFallbackSkybox();
        }
    );
}

function createFallbackSkybox() {
    // Einfache Gradient-Skybox als Fallback
    const skyboxGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyboxMaterial = new THREE.MeshBasicMaterial({
        color: 0x87CEEB, // Sky Blue
        side: THREE.BackSide
    });
    
    const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
    skybox.name = 'fallback-skybox';
    scene.add(skybox);
    console.log('🌤️ Fallback-Skybox erstellt');
}

function createArena() {
    // Boden mit Textur
    console.log('🏗️ Erstelle Arena mit Boden-Textur...');
    
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    
    // Texture Loader für Boden-Textur
    const textureLoader = new THREE.TextureLoader();
    
    textureLoader.load(
        'https://i.imgur.com/5dx4Y0V.png',
        function(texture) {
            // Texture erfolgreich geladen
            console.log('✅ Boden-Textur geladen');
            
            // Textur-Einstellungen für Wiederholung
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(10, 10); // 10x10 Wiederholungen für große Fläche
            
            // Material mit Textur erstellen
            const floorMaterial = new THREE.MeshLambertMaterial({ 
                map: texture
            });
            
            // Boden erstellen und zur Szene hinzufügen
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.rotation.x = -Math.PI / 2;
            floor.receiveShadow = true;
            floor.name = 'textured-floor';
            scene.add(floor);
            
            console.log('🏗️ Texturierter Boden zur Szene hinzugefügt');
        },
        function(progress) {
            // Loading Progress
            console.log('📥 Boden-Textur Loading Progress:', (progress.loaded / progress.total * 100).toFixed(1) + '%');
        },
        function(error) {
            // Loading Error - Fallback zu einfarbigem Boden
            console.error('❌ Fehler beim Laden der Boden-Textur:', error);
            console.log('🔄 Verwende Fallback-Boden...');
            
            const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.rotation.x = -Math.PI / 2;
            floor.receiveShadow = true;
            floor.name = 'fallback-floor';
            scene.add(floor);
            
            console.log('🏗️ Fallback-Boden zur Szene hinzugefügt');
        }
    );
    
    // Wände
    const wallHeight = 10;
    const wallThickness = 1;
    
    // Wand-Textur laden
    console.log('🧱 Lade Wand-Textur...');
    const wallTextureLoader = new THREE.TextureLoader();
    
    wallTextureLoader.load(
        'https://i.imgur.com/VMcr38J.png',
        function(wallTexture) {
            // Texture erfolgreich geladen
            console.log('✅ Wand-Textur geladen');
            
            // Textur-Einstellungen für Wiederholung
            wallTexture.wrapS = THREE.RepeatWrapping;
            wallTexture.wrapT = THREE.RepeatWrapping;
            
            // Wand Material mit Textur
            const wallMaterial = new THREE.MeshLambertMaterial({ 
                map: wallTexture
            });
            
            // Nord-Wand
            wallTexture.repeat.set(20, 2); // Angepasst für Wand-Dimensionen
            const northWall = new THREE.Mesh(
                new THREE.BoxGeometry(100, wallHeight, wallThickness),
                wallMaterial
            );
            northWall.position.set(0, wallHeight/2, -50);
            northWall.castShadow = true;
            northWall.name = 'north-wall';
            scene.add(northWall);
            
            // Süd-Wand
            const southWallTexture = wallTexture.clone();
            southWallTexture.repeat.set(20, 2);
            const southWallMaterial = new THREE.MeshLambertMaterial({ map: southWallTexture });
            const southWall = new THREE.Mesh(
                new THREE.BoxGeometry(100, wallHeight, wallThickness),
                southWallMaterial
            );
            southWall.position.set(0, wallHeight/2, 50);
            southWall.castShadow = true;
            southWall.name = 'south-wall';
            scene.add(southWall);
            
            // West-Wand
            const westWallTexture = wallTexture.clone();
            westWallTexture.repeat.set(20, 2);
            const westWallMaterial = new THREE.MeshLambertMaterial({ map: westWallTexture });
            const westWall = new THREE.Mesh(
                new THREE.BoxGeometry(wallThickness, wallHeight, 100),
                westWallMaterial
            );
            westWall.position.set(-50, wallHeight/2, 0);
            westWall.castShadow = true;
            westWall.name = 'west-wall';
            scene.add(westWall);
            
            // Ost-Wand
            const eastWallTexture = wallTexture.clone();
            eastWallTexture.repeat.set(20, 2);
            const eastWallMaterial = new THREE.MeshLambertMaterial({ map: eastWallTexture });
            const eastWall = new THREE.Mesh(
                new THREE.BoxGeometry(wallThickness, wallHeight, 100),
                eastWallMaterial
            );
            eastWall.position.set(50, wallHeight/2, 0);
            eastWall.castShadow = true;
            eastWall.name = 'east-wall';
            scene.add(eastWall);
            
            console.log('🧱 Alle texturierten Wände zur Szene hinzugefügt');
        },
        function(progress) {
            // Loading Progress
            console.log('📥 Wand-Textur Loading Progress:', (progress.loaded / progress.total * 100).toFixed(1) + '%');
        },
        function(error) {
            // Loading Error - Fallback zu einfarbigen Wänden
            console.error('❌ Fehler beim Laden der Wand-Textur:', error);
            console.log('🔄 Verwende Fallback-Wände...');
            
            // Fallback: Einfarbige Wände
            const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
            
            // Nord-Wand
            const northWall = new THREE.Mesh(
                new THREE.BoxGeometry(100, wallHeight, wallThickness),
                wallMaterial
            );
            northWall.position.set(0, wallHeight/2, -50);
            northWall.castShadow = true;
            northWall.name = 'fallback-north-wall';
            scene.add(northWall);
            
            // Süd-Wand
            const southWall = new THREE.Mesh(
                new THREE.BoxGeometry(100, wallHeight, wallThickness),
                wallMaterial
            );
            southWall.position.set(0, wallHeight/2, 50);
            southWall.castShadow = true;
            southWall.name = 'fallback-south-wall';
            scene.add(southWall);
            
            // West-Wand
            const westWall = new THREE.Mesh(
                new THREE.BoxGeometry(wallThickness, wallHeight, 100),
                wallMaterial
            );
            westWall.position.set(-50, wallHeight/2, 0);
            westWall.castShadow = true;
            westWall.name = 'fallback-west-wall';
            scene.add(westWall);
            
            // Ost-Wand
            const eastWall = new THREE.Mesh(
                new THREE.BoxGeometry(wallThickness, wallHeight, 100),
                wallMaterial
            );
            eastWall.position.set(50, wallHeight/2, 0);
            eastWall.castShadow = true;
            eastWall.name = 'fallback-east-wall';
            scene.add(eastWall);
            
            console.log('🧱 Fallback-Wände zur Szene hinzugefügt');
        }
    );
    
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
    while (checkHorizontalCollisionWithObstacles(spawnX, spawnZ) && attempts < 50) {
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
    
    // Box-Textur laden
    console.log('📦 Lade Box-Textur...');
    const boxTextureLoader = new THREE.TextureLoader();
    
    boxTextureLoader.load(
        'https://i.imgur.com/DiMAnF6.png',
        function(boxTexture) {
            // Texture erfolgreich geladen
            console.log('✅ Box-Textur geladen');
            
            // Textur-Einstellungen für Wiederholung
            boxTexture.wrapS = THREE.RepeatWrapping;
            boxTexture.wrapT = THREE.RepeatWrapping;
            
            // Hindernisse mit Textur erstellen
            mapObstacles.forEach((obstacle, index) => {
                console.log(`Erstelle texturiertes Hindernis ${index + 1}:`, obstacle);
                
                // Individuelle Textur für jede Box
                const obstacleTexture = boxTexture.clone();
                
                // Textur-Wiederholung basierend auf Box-Größe anpassen
                const scaleX = obstacle.width / 2;
                const scaleY = obstacle.height / 2;
                obstacleTexture.repeat.set(scaleX, scaleY);
                
                // Material mit Textur
                const boxMaterial = new THREE.MeshLambertMaterial({ 
                    map: obstacleTexture
                });
                
                const box = new THREE.Mesh(
                    new THREE.BoxGeometry(obstacle.width, obstacle.height, obstacle.depth),
                    boxMaterial
                );
                
                box.position.set(obstacle.x, obstacle.y, obstacle.z);
                box.castShadow = true;
                box.receiveShadow = true;
                box.userData.isObstacle = true;
                box.userData.obstacleData = obstacle;
                box.name = `textured-obstacle-${index + 1}`;
                
                scene.add(box);
                console.log(`✅ Texturiertes Hindernis ${index + 1} zur Szene hinzugefügt bei (${obstacle.x}, ${obstacle.y}, ${obstacle.z})`);
            });
            
            console.log(`🎉 ${mapObstacles.length} texturierte Hindernisse erfolgreich erstellt. Szenen-Kinder:`, scene.children.length);
        },
        function(progress) {
            // Loading Progress
            console.log('📥 Box-Textur Loading Progress:', (progress.loaded / progress.total * 100).toFixed(1) + '%');
        },
        function(error) {
            // Loading Error - Fallback zu einfarbigen Boxen
            console.error('❌ Fehler beim Laden der Box-Textur:', error);
            console.log('🔄 Verwende Fallback-Boxen...');
            
            // Fallback: Einfarbige Boxen
            const boxMaterial = new THREE.MeshLambertMaterial({ color: 0xCD853F });
            
            mapObstacles.forEach((obstacle, index) => {
                console.log(`Erstelle Fallback-Hindernis ${index + 1}:`, obstacle);
                
                const box = new THREE.Mesh(
                    new THREE.BoxGeometry(obstacle.width, obstacle.height, obstacle.depth),
                    boxMaterial
                );
                
                box.position.set(obstacle.x, obstacle.y, obstacle.z);
                box.castShadow = true;
                box.receiveShadow = true;
                box.userData.isObstacle = true;
                box.userData.obstacleData = obstacle;
                box.name = `fallback-obstacle-${index + 1}`;
                
                scene.add(box);
                console.log(`✅ Fallback-Hindernis ${index + 1} zur Szene hinzugefügt bei (${obstacle.x}, ${obstacle.y}, ${obstacle.z})`);
            });
            
            console.log(`🎉 ${mapObstacles.length} Fallback-Hindernisse erfolgreich erstellt. Szenen-Kinder:`, scene.children.length);
        }
    );
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
    // Cooldown für alle Waffen überprüfen
    const currentTime = Date.now();
    if (currentTime - lastShotTime < currentWeapon.cooldown) {
        return; // Cooldown noch aktiv
    }
    lastShotTime = currentTime;
    
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
            weaponType: currentWeapon === WEAPONS.RIFLE ? 'rifle' : currentWeapon === WEAPONS.SHOTGUN ? 'shotgun' : 'sniper'
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
    const recoilMultiplier = currentWeapon === WEAPONS.SHOTGUN ? 2 : currentWeapon === WEAPONS.SNIPER ? 1.5 : 1;
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
    const newY = camera.position.y + velocityY * deltaTime;
    
    // Erweiterte Boden-Kollision mit Blöcken
    const groundHeight = getGroundHeightAt(camera.position.x, camera.position.z, newY);
    
    // Einfache Boden-Kollision - nur landen wenn unter der Boden-Höhe
    if (newY <= groundHeight && velocityY <= 0) {
        // Normal auf Boden oder Block-Oberfläche landen (nur bei Abwärtsbewegung)
        camera.position.y = groundHeight;
        velocityY = 0;
        isGrounded = true;
    } else {
        // Frei fallen/springen
        camera.position.y = newY;
        isGrounded = false;
    }
    
    // Kollisionserkennung mit Wänden und Hindernissen
    const newX = camera.position.x + direction.x;
    const newZ = camera.position.z + direction.z;
    
    // Versuch beide Achsen gleichzeitig zu bewegen
    if (Math.abs(newX) < 49 && Math.abs(newZ) < 49 && 
        !checkHorizontalCollisionWithObstacles(newX, newZ)) {
        // Beide Richtungen frei - normale Bewegung
        camera.position.x = newX;
        camera.position.z = newZ;
    } else {
        // Kollision detected - versuche entlang Wänden zu gleiten
        
        // Nur X-Achse bewegen (Z bleibt gleich)
        if (Math.abs(newX) < 49 && !checkHorizontalCollisionWithObstacles(newX, camera.position.z)) {
            camera.position.x = newX;
        }
        
        // Nur Z-Achse bewegen (X bleibt gleich)
        if (Math.abs(newZ) < 49 && !checkHorizontalCollisionWithObstacles(camera.position.x, newZ)) {
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
        } else if (currentWeapon === WEAPONS.SNIPER) {
            weaponIcon.textContent = '🎯'; // Target/Sniper
        }
        weaponIcon.style.color = `#${currentWeapon.color.toString(16).padStart(6, '0')}`;
    }
    
    // Zoom-Status aktualisieren
    updateZoomUI();
}

function toggleZoom() {
    if (currentWeapon !== WEAPONS.SNIPER) return;
    
    isZoomed = !isZoomed;
    camera.fov = isZoomed ? zoomedFOV : normalFOV;
    camera.updateProjectionMatrix();
    updateZoomUI();
}

function startZoom() {
    if (currentWeapon !== WEAPONS.SNIPER || isZoomed) return;
    
    isZoomed = true;
    camera.fov = zoomedFOV;
    camera.updateProjectionMatrix();
    updateZoomUI();
}

function stopZoom() {
    if (!isZoomed) return;
    
    isZoomed = false;
    camera.fov = normalFOV;
    camera.updateProjectionMatrix();
    updateZoomUI();
}

function updateZoomUI() {
    const zoomStatus = document.getElementById('zoom-status');
    if (zoomStatus) {
        if (currentWeapon === WEAPONS.SNIPER && isZoomed) {
            zoomStatus.textContent = 'ZOOM AKTIV';
            zoomStatus.style.display = 'block';
        } else {
            zoomStatus.style.display = 'none';
        }
    }
}

function updateCooldownUI() {
    const cooldownBar = document.getElementById('cooldown-bar');
    const cooldownFill = document.getElementById('cooldown-fill');
    
    if (!cooldownBar || !cooldownFill) return;
    
    const currentTime = Date.now();
    const timeSinceLastShot = currentTime - lastShotTime;
    const cooldownTime = currentWeapon.cooldown;
    
    if (timeSinceLastShot < cooldownTime) {
        // Cooldown aktiv - Balken anzeigen
        const progress = Math.min(1, timeSinceLastShot / cooldownTime);
        cooldownBar.style.display = 'block';
        cooldownFill.style.width = (progress * 100) + '%';
        cooldownFill.style.backgroundColor = progress === 1 ? '#00ff00' : '#ff6600';
    } else {
        // Cooldown abgeschlossen - Balken ausblenden
        cooldownBar.style.display = 'none';
    }
}

function resetZoom() {
    if (isZoomed) {
        isZoomed = false;
        camera.fov = normalFOV;
        camera.updateProjectionMatrix();
        updateZoomUI();
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
    updateCooldownUI(); // Cooldown-Balken aktualisieren
    
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
            resetZoom(); // Zoom zurücksetzen wenn andere Waffe gewählt
            updateWeaponUI();
            break;
        case 'Digit2':
            currentWeapon = WEAPONS.SHOTGUN;
            resetZoom(); // Zoom zurücksetzen wenn andere Waffe gewählt
            updateWeaponUI();
            break;
        case 'Digit3':
            currentWeapon = WEAPONS.SNIPER;
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
    if (gameStarted && isPointerLocked) {
        if (event.button === 0) { // Linke Maustaste - Schießen
            shoot();
        }
    }
    
    if (!isPointerLocked && gameStarted) {
        document.body.requestPointerLock();
    }
}

function onMouseDown(event) {
    if (gameStarted && isPointerLocked) {
        if (event.button === 2) { // Rechte Maustaste - Zoom start
            event.preventDefault();
            startZoom();
        }
    }
}

function onMouseUp(event) {
    if (gameStarted && isPointerLocked) {
        if (event.button === 2) { // Rechte Maustaste - Zoom stop
            event.preventDefault();
            stopZoom();
        }
    }
}

function onPointerLockChange() {
    isPointerLocked = document.pointerLockElement === document.body;
}

function onMouseMove(event) {
    if (!isPointerLocked || !gameStarted) return;
    
    // Angepasste Maussensitivität für Zoom
    let sensitivity = MOUSE_SENSITIVITY;
    if (currentWeapon === WEAPONS.SNIPER && isZoomed) {
        sensitivity *= 0.3; // Reduzierte Sensitivität beim Zoomen
    }
    
    // Euler-Objekt für bessere Rotation verwenden
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(camera.quaternion);
    
    euler.y -= event.movementX * sensitivity;
    euler.x -= event.movementY * sensitivity;
    
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
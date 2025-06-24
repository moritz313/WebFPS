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
        damage: 15,
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

// Waffen-Modelle
let weaponModels = {};
let currentWeaponModel = null;
let weaponGroup = null; // Gruppe für Waffen-Positionierung

// Debug/Preview Variablen
let previewScene = null;
let previewCamera = null;
let previewRenderer = null;
let previewRifleModel = null;

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

// Zufällige Namen für Spieler
const RANDOM_NAMES = [
    'Larry', 'Bob', 'Harry', 'Jason', 'Timmy', 'Amogus',
    'xXNoobSlayerXx', 'SneakyBanana', 'CaptainChaos', 'NinjaToast',
    'PixelWarrior', 'FluffyDestroyer', 'RocketPanda', 'ShadowMuffin',
    'LazerKitten', 'ThunderPickle'
];

// Zufällige Farben für Spieler
const RANDOM_COLORS = [
    '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
    '#ff8000', '#8000ff', '#0080ff', '#ff0080', '#80ff00', '#ff4080',
    '#40ff80', '#8040ff', '#ff8040', '#4080ff'
];

// UI Elemente
const menu = document.getElementById('menu');
const startBtn = document.getElementById('startBtn');
const usernameInput = document.getElementById('usernameInput');
const colorPicker = document.getElementById('colorPicker');
const healthValue = document.getElementById('healthValue');
const healthBar = document.getElementById('health');
const deathScreen = document.getElementById('death-screen');
const respawnTimer = document.getElementById('respawn-timer');
const hitmarker = document.getElementById('hitmarker');
const hitmarkerImage = document.getElementById('hitmarker-image');
const scoreboard = document.getElementById('scoreboard');

// Scoreboard-Daten
let playerStats = {}; // { playerId: { kills: 0, deaths: 0, username: '', color: '' } }
let isScoreboardVisible = false;

// Zufälligen Namen und Farbe setzen
function setRandomPlayerData() {
    // Zufälliger Name
    const randomName = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    if (usernameInput) {
        usernameInput.value = randomName;
    }
    
    // Zufällige Farbe
    const randomColor = RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
    if (colorPicker) {
        colorPicker.value = randomColor;
    }
}

// Event Listeners
startBtn.addEventListener('click', startGame);
usernameInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        startGame();
    }
});

colorPicker.addEventListener('change', (event) => {
    // Farbe auch während des Spiels ändern
    if (gameStarted && socket) {
        socket.emit('setPlayerData', { 
            color: event.target.value 
        });
    }
});
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
        const player = serverPlayers[id];
        
        // Alle Spieler zum Scoreboard hinzufügen
        addPlayerToStats(id, player.username, player.color);
        
        if (id !== socket.id) {
            console.log('Füge anderen Spieler hinzu:', id, 'Daten:', player);
            // Nur hinzufügen wenn Spiel läuft UND Szene existiert
            if (gameStarted && scene) {
                addOtherPlayer(player);
            } else {
                // Speichern für später wenn Spiel startet
                window.pendingPlayers = window.pendingPlayers || {};
                window.pendingPlayers[id] = player;
                console.log('Spieler für später gespeichert (Spiel nicht gestartet)');
            }
        } else {
            console.log('Das bin ich selbst:', id, 'Daten:', player);
        }
    });
});

socket.on('newPlayer', (playerData) => {
    console.log('Neuer Spieler Event erhalten:', playerData);
    console.log('Username:', playerData.username, 'Farbe:', playerData.color);
    
    // Zum Scoreboard hinzufügen
    addPlayerToStats(playerData.id, playerData.username, playerData.color);
    
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

socket.on('playerDataChanged', (data) => {
    console.log('Spieler-Daten geändert:', data.playerId, data);
    if (players[data.playerId]) {
        const playerGroup = players[data.playerId];
        
        // Username aktualisieren wenn vorhanden
        if (data.username && playerGroup.userData && playerGroup.userData.nameTag) {
            const newNameTag = createNameTag(data.username);
            newNameTag.position.copy(playerGroup.userData.nameTag.position);
            
            // Altes NameTag entfernen
            playerGroup.remove(playerGroup.userData.nameTag);
            
            // Neues NameTag hinzufügen
            playerGroup.add(newNameTag);
            playerGroup.userData.nameTag = newNameTag;
        }
        
        // Farbe aktualisieren wenn vorhanden
        if (data.color) {
            const playerMesh = playerGroup.children.find(child => child.geometry && child.geometry.type === 'BoxGeometry');
            if (playerMesh && playerMesh.material) {
                playerMesh.material.color.setHex(new THREE.Color(data.color).getHex());
            }
        }
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
    
    // Aus Scoreboard entfernen
    removePlayerFromStats(playerId);
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
    
    // Death-Statistik aktualisieren (falls nicht über hitConfirmed erfasst)
    if (playerId === socket.id && playerStats[socket.id]) {
        playerStats[socket.id].deaths++;
        if (isScoreboardVisible) {
            updateScoreboard();
        }
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

socket.on('hitConfirmed', (data) => {
    console.log('Hit bestätigt:', data);
    showHitmarker(data.isKill, data.weaponType, data.isHeadshot);
    playHitSound(data.isKill, data.isHeadshot);
    
    // Kill-Statistik aktualisieren
    if (data.isKill) {
        console.log('🎯 KILL! Target:', data.targetId);
        // Eigene Kills erhöhen
        if (playerStats[socket.id]) {
            playerStats[socket.id].kills++;
        }
        // Target Deaths erhöhen
        if (playerStats[data.targetId]) {
            playerStats[data.targetId].deaths++;
        }
        // Scoreboard aktualisieren falls sichtbar
        if (isScoreboardVisible) {
            updateScoreboard();
        }
    }
    if (data.isHeadshot) {
        console.log('💥 HEADSHOT!');
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
    
    // Username validieren
    const username = usernameInput.value.trim();
    if (!username || username.length < 1) {
        alert('Bitte gib einen gültigen Benutzernamen ein!');
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
    updateCrosshair(); // Crosshair für Startwaffe setzen
    
    // Pointer Lock für FPS-Steuerung
    document.body.requestPointerLock();
    
    // Username und Farbe an Server senden
    const playerColor = colorPicker.value;
    socket.emit('setPlayerData', { 
        username: username,
        color: playerColor 
    });
    
    // Eigene Daten zum Scoreboard hinzufügen
    addPlayerToStats(socket.id, username, playerColor);
    
    // Audio initialisieren (nach User-Interaktion)
    console.log('🔊 Lade Audio-System...');
    initAudio().then(() => {
        console.log('🎵 Audio-System bereit!');
    }).catch(error => {
        console.log('⚠️ Audio-System Fallback aktiv');
    });
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
    
    // Waffen-Gruppe erstellen und an Kamera anhängen
    weaponGroup = new THREE.Group();
    camera.add(weaponGroup);
    
    // Waffen-Modelle laden
    loadWeaponModels();
}

// Waffen-Modelle laden (HARDCODED aus deinen Blockbench-Daten)
function loadWeaponModels() {
    console.log('🔫 Erstelle Waffen-Modelle aus Blockbench-Daten...');
    
    // SHOTGUN (hardcoded aus deiner shotgun.gltf)
    var shotgunGroup = new THREE.Group();
    shotgunGroup.name = "FPS_Shotgun";
    
    // Teil 1: Hauptlauf
    var barrel = new THREE.Mesh(
        new THREE.BoxGeometry(0.5625, 0.125, 0.125),
        new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    barrel.position.set(0.375, 0.25, 0);
    shotgunGroup.add(barrel);
    
    // Teil 2: Laufverlängerung
    var barrelExt = new THREE.Mesh(
        new THREE.BoxGeometry(0.5625, 0.125, 0.125),
        new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    barrelExt.position.set(0.375, 0.25, 0.0625);
    shotgunGroup.add(barrelExt);
    
    // Teil 3: Schaft mit Rotation
    var stock = new THREE.Mesh(
        new THREE.BoxGeometry(0.125, 0.275, 0.125),
        new THREE.MeshLambertMaterial({ color: 0x8B4513 })
    );
    stock.position.set(-0.125, 0.0625, 0);
    stock.rotation.z = -0.17364817766693033;
    shotgunGroup.add(stock);
    
    // Teil 4: Griff
    var grip = new THREE.Mesh(
        new THREE.BoxGeometry(0.375, 0.25, 0.125),
        new THREE.MeshLambertMaterial({ color: 0x654321 })
    );
    grip.position.set(0, 0.1875, 0);
    shotgunGroup.add(grip);
    
    // Teil 5: Obergriff mit Rotation
    var topGrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.125, 0.125, 0.125),
        new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    topGrip.position.set(0, 0.375, 0);
    topGrip.rotation.z = 0.1521233861899167;
    shotgunGroup.add(topGrip);
    
    // Shotgun für First-Person View anpassen
    shotgunGroup.scale.set(0.8, 0.8, 0.8); // Passende Größe
    shotgunGroup.position.set(0.4, -0.4, -0.6); // Rechts unten
    shotgunGroup.rotation.set(0.1, 0.2, 0); // Leichte Neigung
    
    // Schatten aktivieren
    shotgunGroup.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    // Alle Waffen bekommen die Shotgun (für jetzt)
    weaponModels['rifle'] = shotgunGroup.clone();
    weaponModels['shotgun'] = shotgunGroup.clone();
    weaponModels['sniper'] = shotgunGroup.clone();
    
    console.log('✅ Blockbench Shotgun für alle Waffen erstellt');
    
    // Shotgun als Standard-Waffe anzeigen
    showWeaponModel('rifle');
}

// Waffen-Modell anzeigen/wechseln
function showWeaponModel(weaponType) {
    if (!weaponGroup) return;
    
    // Aktuelles Modell entfernen
    if (currentWeaponModel) {
        weaponGroup.remove(currentWeaponModel);
        currentWeaponModel = null;
    }
    
    // Neues Modell anzeigen
    if (weaponModels[weaponType]) {
        currentWeaponModel = weaponModels[weaponType].clone();
        weaponGroup.add(currentWeaponModel);
        console.log(`🔫 Waffe gewechselt zu: ${weaponType}`);
    } else {
        console.log(`⚠️ Modell für ${weaponType} nicht geladen`);
    }
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

function createNameTag(username) {
    // Canvas für Text erstellen
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Canvas Größe setzen
    canvas.width = 256;
    canvas.height = 64;
    
    // Text Styling
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'white';
    context.font = 'bold 24px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Text zeichnen
    context.fillText(username, canvas.width / 2, canvas.height / 2);
    
    // Texture aus Canvas erstellen
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    
    // Material und Geometry für NameTag
    const nameTagMaterial = new THREE.MeshBasicMaterial({ 
        map: texture, 
        transparent: true,
        alphaTest: 0.1
    });
    const nameTagGeometry = new THREE.PlaneGeometry(2, 0.5);
    const nameTagMesh = new THREE.Mesh(nameTagGeometry, nameTagMaterial);
    
    return nameTagMesh;
}

function addOtherPlayer(playerData) {
    console.log('Neuer Spieler hinzugefügt:', playerData.id, 'Username:', playerData.username, 'Farbe:', playerData.color, 'Position:', playerData.x, playerData.y, playerData.z);
    
    // Prüfen ob Spieler bereits existiert
    if (players[playerData.id]) {
        console.log('Spieler existiert bereits, entferne alten...');
        scene.remove(players[playerData.id]);
        delete players[playerData.id];
    }
    
    // Einfacher Box-Körper (erst mal für Tests)
    const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
    const playerColor = playerData.color ? new THREE.Color(playerData.color) : new THREE.Color(0xff0000);
    const playerMaterial = new THREE.MeshLambertMaterial({ color: playerColor });
    const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
    
    // Kopf
    const headGeometry = new THREE.SphereGeometry(0.4, 8, 8);
    const headMaterial = new THREE.MeshLambertMaterial({ color: 0xffff00 });
    const headMesh = new THREE.Mesh(headGeometry, headMaterial);
    headMesh.position.set(0, 1.2, 0);
    
    // NameTag über dem Kopf
    const displayName = playerData.username || 'Spieler';
    const nameTag = createNameTag(displayName);
    nameTag.position.set(0, 2.5, 0);
    
    // Gruppe erstellen
    const playerGroup = new THREE.Group();
    playerGroup.add(playerMesh);
    playerGroup.add(headMesh);
    playerGroup.add(nameTag);
    
    // NameTag soll immer zur Kamera zeigen
    playerGroup.userData = { nameTag: nameTag };
    
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
        damage: bulletData.damage || 15
    };
    
    bullets.push(bulletMesh);
    scene.add(bulletMesh);
}

function shootInstant() {
    // Cooldown für alle Waffen überprüfen
    const currentTime = Date.now();
    if (currentTime - lastShotTime < currentWeapon.cooldown) {
        return; // Cooldown noch aktiv
    }
    lastShotTime = currentTime;
    
    // SOFORTIGE Erfassung der Kamerarichtung - keine zusätzlichen Berechnungen!
    const baseDirection = new THREE.Vector3(0, 0, -1);
    baseDirection.applyQuaternion(camera.quaternion);
    
    // SOFORTIGE Erfassung der Position
    const shootX = camera.position.x;
    const shootY = camera.position.y;
    const shootZ = camera.position.z;
    
    // Je nach Waffe verschiedene Anzahl Bullets erstellen
    for (let i = 0; i < currentWeapon.bulletsPerShot; i++) {
        // Kopie der Richtung für jede Kugel
        let dirX = baseDirection.x;
        let dirY = baseDirection.y;
        let dirZ = baseDirection.z;
        
        // Spread für Shotgun hinzufügen
        if (currentWeapon.spread > 0) {
            const spreadX = (Math.random() - 0.5) * currentWeapon.spread;
            const spreadY = (Math.random() - 0.5) * currentWeapon.spread;
            
            dirX += spreadX;
            dirY += spreadY;
            
            // Schnelle Normalisierung
            const length = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
            dirX /= length;
            dirY /= length;
            dirZ /= length;
        }
        
        const bulletData = {
            x: shootX,
            y: shootY,
            z: shootZ,
            directionX: dirX,
            directionY: dirY,
            directionZ: dirZ,
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
    
    // Waffenschuss-Sound abspielen
    const weaponType = currentWeapon === WEAPONS.RIFLE ? 'rifle' : currentWeapon === WEAPONS.SHOTGUN ? 'shotgun' : 'sniper';
    playWeaponSound(weaponType);
    
    // Rückstoß-Effekt - stärker bei Shotgun
    const recoilMultiplier = currentWeapon === WEAPONS.SHOTGUN ? 2 : currentWeapon === WEAPONS.SNIPER ? 1.5 : 1;
    camera.rotation.x += (Math.random() - 0.5) * 0.02 * recoilMultiplier;
    camera.rotation.y += (Math.random() - 0.5) * 0.02 * recoilMultiplier;
}

// Alte shoot-Funktion für Backward-Compatibility falls irgendwo noch verwendet
function shoot() {
    shootInstant();
}

// Scoreboard Funktionen
function showScoreboard() {
    if (!gameStarted) return;
    isScoreboardVisible = true;
    updateScoreboard();
    scoreboard.classList.remove('hidden');
}

function hideScoreboard() {
    if (!gameStarted) return;
    isScoreboardVisible = false;
    scoreboard.classList.add('hidden');
}

function updateScoreboard() {
    if (!scoreboard) return;
    
    const playersList = document.getElementById('players-list');
    if (!playersList) return;
    
    console.log('📊 Aktualisiere Scoreboard mit', Object.keys(playerStats).length, 'Spielern');
    console.log('📊 Player Stats:', playerStats);
    
    // Liste leeren
    playersList.innerHTML = '';
    
    // Spieler nach Kills sortieren (höchste zuerst)
    const sortedPlayers = Object.entries(playerStats).sort((a, b) => {
        return b[1].kills - a[1].kills;
    });
    
    console.log('📊 Sortierte Spieler:', sortedPlayers);
    
    // Spieler-Items erstellen
    sortedPlayers.forEach(([playerId, stats]) => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-score-item';
        
        // Eigenen Spieler hervorheben
        if (playerId === socket.id) {
            playerItem.classList.add('own-player');
        }
        
        // K/D Ratio berechnen
        const kd = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(1) : stats.kills.toFixed(1);
        
        playerItem.innerHTML = `
            <div class="player-info">
                <div class="player-color-dot" style="background-color: ${stats.color || '#ffffff'}"></div>
                <div class="player-name">${stats.username || 'Unknown'}</div>
            </div>
            <div class="player-stats">
                <div class="stat-item">
                    <div class="stat-label">K</div>
                    <div class="stat-value kills">${stats.kills}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">D</div>
                    <div class="stat-value deaths">${stats.deaths}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">K/D</div>
                    <div class="stat-value kd">${kd}</div>
                </div>
            </div>
        `;
        
        playersList.appendChild(playerItem);
    });
}

function addPlayerToStats(playerId, username, color) {
    console.log('📊 Füge Spieler zu Stats hinzu:', playerId, username, color);
    if (!playerStats[playerId]) {
        playerStats[playerId] = {
            kills: 0,
            deaths: 0,
            username: username || 'Unknown',
            color: color || '#ffffff'
        };
        console.log('📊 Neuer Spieler in Stats:', playerStats[playerId]);
    } else {
        // Update existing player data
        playerStats[playerId].username = username || playerStats[playerId].username;
        playerStats[playerId].color = color || playerStats[playerId].color;
        console.log('📊 Spieler-Stats aktualisiert:', playerStats[playerId]);
    }
    
    if (isScoreboardVisible) {
        updateScoreboard();
    }
}

function updatePlayerStats(playerId, kills, deaths) {
    if (playerStats[playerId]) {
        playerStats[playerId].kills = kills || 0;
        playerStats[playerId].deaths = deaths || 0;
        
        if (isScoreboardVisible) {
            updateScoreboard();
        }
    }
}

function removePlayerFromStats(playerId) {
    if (playerStats[playerId]) {
        delete playerStats[playerId];
        
        if (isScoreboardVisible) {
            updateScoreboard();
        }
    }
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
                        damage: bullet.userData.damage,
                        weaponType: currentWeapon === WEAPONS.RIFLE ? 'rifle' : currentWeapon === WEAPONS.SHOTGUN ? 'shotgun' : 'sniper'
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
    
    // Crosshair für aktuelle Waffe aktualisieren
    updateCrosshair();
    
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

function updateCrosshair() {
    const crosshair = document.getElementById('crosshair');
    if (!crosshair) return;
    
    // Entferne alle Waffen-Klassen
    crosshair.classList.remove('rifle', 'shotgun', 'sniper', 'zoomed');
    
    // Füge entsprechende Klasse basierend auf aktueller Waffe hinzu
    if (currentWeapon === WEAPONS.RIFLE) {
        crosshair.className = 'rifle';
        crosshair.textContent = '+';
    } else if (currentWeapon === WEAPONS.SHOTGUN) {
        crosshair.className = 'shotgun';
        crosshair.textContent = ''; // Leer, da CSS den Kreis zeichnet
    } else if (currentWeapon === WEAPONS.SNIPER) {
        crosshair.className = 'sniper';
        crosshair.textContent = ''; // Leer, da CSS die Linien zeichnet
        
        // Zoom-Status hinzufügen wenn gezoomt
        if (isZoomed) {
            crosshair.classList.add('zoomed');
        }
    }
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
    
    // Crosshair für Zoom-Status aktualisieren
    updateCrosshair();
}

function updateCooldownUI() {
    const cooldownBar = document.getElementById('cooldown-bar');
    const cooldownFill = document.getElementById('cooldown-fill');
    
    if (!cooldownBar || !cooldownFill) return;
    
    // Rifle zeigt keine Cooldown-Anzeige
    if (currentWeapon === WEAPONS.RIFLE) {
        cooldownBar.style.display = 'none';
        cooldownBar.classList.remove('complete');
        return;
    }
    
    const currentTime = Date.now();
    const timeSinceLastShot = currentTime - lastShotTime;
    const cooldownTime = currentWeapon.cooldown;
    
    if (timeSinceLastShot < cooldownTime) {
        // Cooldown aktiv - Balken anzeigen
        const progress = Math.min(1, timeSinceLastShot / cooldownTime);
        cooldownBar.style.display = 'block';
        cooldownFill.style.width = (progress * 100) + '%';
        
        // Complete-Klasse für grünen Effekt
        if (progress >= 1) {
            cooldownBar.classList.add('complete');
        } else {
            cooldownBar.classList.remove('complete');
        }
    } else {
        // Cooldown abgeschlossen - Balken mit kleiner Verzögerung ausblenden
        cooldownBar.classList.add('complete');
        setTimeout(() => {
            cooldownBar.style.display = 'none';
            cooldownBar.classList.remove('complete');
        }, 200);
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

function showHitmarker(isKill = false, weaponType = 'rifle', isHeadshot = false) {
    // Entferne vorherige Animation und Klassen
    hitmarker.classList.remove('hitmarker-show', 'hitmarker-kill', 'hitmarker-headshot', 'hitmarker-sniper');
    
    // Reset transform für saubere Animation
    hitmarker.style.transform = 'translate(-50%, -50%)';
    
    // Füge entsprechende Klassen hinzu
    if (isKill) {
        hitmarker.classList.add('hitmarker-kill');
    }
    if (isHeadshot) {
        hitmarker.classList.add('hitmarker-headshot');
    }
    if (weaponType === 'sniper') {
        hitmarker.classList.add('hitmarker-sniper');
    }
    
    // Zeige Hitmarker mit Animation
    hitmarker.classList.add('hitmarker-show');
    
    // Nach Animation wieder verstecken
    setTimeout(() => {
        hitmarker.classList.remove('hitmarker-show', 'hitmarker-kill', 'hitmarker-headshot', 'hitmarker-sniper');
        hitmarker.style.display = 'none';
    }, 400);
}

// Audio System für Custom Sounds
let audioContext = null;
const AUDIO_VOLUME = 0.4; // Master-Lautstärke (0.0 - 1.0)
const audioBuffers = {}; // Cache für geladene Audio-Dateien
let audioLoaded = false;

// Sound-Konfiguration
const SOUND_CONFIG = {
    // Hit-Sounds
    hit: {
        file: '/sounds/hit.mp3', // Ihr Hit-Sound
        fallback: '/sounds/hit.wav', // Fallback falls MP3 nicht funktioniert
        volume: 0.6
    },
    kill: {
        file: '/sounds/kill.mp3', // Ihr Kill-Sound  
        fallback: '/sounds/kill.wav',
        volume: 0.8
    },
    headshot: {
        file: '/sounds/headshot.mp3', // Ihr Headshot-Sound (optional)
        fallback: '/sounds/headshot.wav',
        volume: 1.0
    },
    
    // Waffen-Schuss-Sounds
    rifle: {
        file: '/sounds/rifle.mp3', // Gewehr-Schuss
        fallback: '/sounds/rifle.wav',
        volume: 0.7
    },
    shotgun: {
        file: '/sounds/shotgun.mp3', // Shotgun-Schuss
        fallback: '/sounds/shotgun.wav',
        volume: 0.9
    },
    sniper: {
        file: '/sounds/sniper.mp3', // Sniper-Schuss
        fallback: '/sounds/sniper.wav',
        volume: 1.0
    }
};

async function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('✅ Audio Context initialisiert');
        
        // Preload alle Sounds
        await preloadSounds();
        audioLoaded = true;
        console.log('✅ Alle Sounds geladen');
        
    } catch (error) {
        console.log('❌ Audio Context nicht verfügbar:', error);
        audioContext = null;
    }
}

async function preloadSounds() {
    const loadPromises = [];
    
    for (const [soundName, config] of Object.entries(SOUND_CONFIG)) {
        loadPromises.push(loadSound(soundName, config));
    }
    
    await Promise.allSettled(loadPromises);
}

async function loadSound(soundName, config) {
    try {
        // Versuche erst die Haupt-Datei zu laden
        let audioBuffer = await loadAudioFile(config.file);
        
        if (!audioBuffer && config.fallback) {
            // Falls Haupt-Datei fehlschlägt, versuche Fallback
            console.log(`⚠️ ${config.file} nicht gefunden, versuche Fallback: ${config.fallback}`);
            audioBuffer = await loadAudioFile(config.fallback);
        }
        
        if (audioBuffer) {
            audioBuffers[soundName] = {
                buffer: audioBuffer,
                volume: config.volume
            };
            console.log(`✅ Sound geladen: ${soundName}`);
        } else {
            console.log(`❌ Sound nicht gefunden: ${soundName}`);
            // Erstelle synthetischen Fallback
            createSyntheticFallback(soundName);
        }
        
    } catch (error) {
        console.log(`❌ Fehler beim Laden von ${soundName}:`, error);
        createSyntheticFallback(soundName);
    }
}

async function loadAudioFile(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return audioBuffer;
        
    } catch (error) {
        return null;
    }
}

function createSyntheticFallback(soundName) {
    // Erstelle synthetischen Sound als Fallback
    console.log(`🔧 Erstelle synthetischen Fallback für: ${soundName}`);
    
    audioBuffers[soundName] = {
        synthetic: true,
        volume: SOUND_CONFIG[soundName]?.volume || 0.6
    };
}

function playHitSound(isKill = false, isHeadshot = false) {
    if (!audioContext) return;
    
    // Bestimme welcher Sound abgespielt werden soll
    let soundName = 'hit';
    if (isHeadshot) {
        soundName = 'headshot';
    } else if (isKill) {
        soundName = 'kill';
    }
    
    // Spiele den Sound ab
    playSound(soundName);
}

function playWeaponSound(weaponType) {
    if (!audioContext) return;
    
    // Bestimme Waffen-Sound basierend auf aktueller Waffe
    let soundName = 'rifle'; // Standard
    
    switch (weaponType) {
        case 'rifle':
            soundName = 'rifle';
            break;
        case 'shotgun':
            soundName = 'shotgun';
            break;
        case 'sniper':
            soundName = 'sniper';
            break;
    }
    
    // Spiele Waffen-Sound ab
    playSound(soundName);
}

function playSound(soundName) {
    if (!audioContext) return;
    
    try {
        const soundData = audioBuffers[soundName];
        
        if (!soundData) {
            console.log(`❌ Sound nicht verfügbar: ${soundName}`);
            return;
        }
        
        if (soundData.synthetic) {
            // Spiele synthetischen Fallback-Sound ab
            playSyntheticSound(soundName);
        } else {
            // Spiele echten Audio-Buffer ab
            playAudioBuffer(soundData.buffer, soundData.volume);
        }
        
    } catch (error) {
        console.log('Fehler beim Abspielen des Sounds:', error);
    }
}

function playAudioBuffer(audioBuffer, volume = 1.0) {
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    
    source.buffer = audioBuffer;
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    gainNode.gain.setValueAtTime(volume * AUDIO_VOLUME, audioContext.currentTime);
    
    source.start(0);
}

function playSyntheticSound(soundName) {
    // Fallback zu synthetischen Sounds falls Custom-Sounds nicht laden
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Sound-Parameter je nach Typ
    switch (soundName) {
        case 'kill':
            oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.15);
            gainNode.gain.setValueAtTime(0.3 * AUDIO_VOLUME, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
            oscillator.type = 'triangle';
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.15);
            break;
            
        case 'headshot':
            oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.4 * AUDIO_VOLUME, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            oscillator.type = 'sine';
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
            break;
            
        case 'rifle':
            // Gewehr: Mittlere Frequenz, schnell
            oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(150, audioContext.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.4 * AUDIO_VOLUME, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            oscillator.type = 'sawtooth';
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
            break;
            
        case 'shotgun':
            // Shotgun: Tiefer, länger, rauh
            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(80, audioContext.currentTime + 0.4);
            gainNode.gain.setValueAtTime(0.5 * AUDIO_VOLUME, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
            oscillator.type = 'sawtooth';
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.4);
            break;
            
        case 'sniper':
            // Sniper: Sehr tief, lang, kraftvoll
            oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.6);
            gainNode.gain.setValueAtTime(0.6 * AUDIO_VOLUME, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
            oscillator.type = 'sawtooth';
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.6);
            break;
            
        default: // hit
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.08);
            gainNode.gain.setValueAtTime(0.2 * AUDIO_VOLUME, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
            oscillator.type = 'triangle';
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.08);
            break;
    }
}

// Fallback für Hitmarker-Bild
hitmarkerImage.addEventListener('error', () => {
    console.log('Hitmarker-Bild konnte nicht geladen werden, verwende Fallback');
    hitmarkerImage.style.display = 'none';
    
    // Erstelle Fallback-Hitmarker
    hitmarker.innerHTML = `
        <div class="fallback-hitmarker">
            <div class="hitmarker-line hitmarker-top-left"></div>
            <div class="hitmarker-line hitmarker-top-right"></div>
            <div class="hitmarker-line hitmarker-bottom-left"></div>
            <div class="hitmarker-line hitmarker-bottom-right"></div>
        </div>
    `;
});

hitmarkerImage.addEventListener('load', () => {
    console.log('✅ Hitmarker-Bild erfolgreich geladen');
});

// Debug-Funktion zum Testen der Sounds (nur in der Konsole verfügbar)
window.testSound = function(soundName) {
    if (!audioLoaded) {
        console.log('❌ Audio noch nicht geladen. Warte bis das Spiel gestartet ist.');
        return;
    }
    
    console.log(`🔊 Teste Sound: ${soundName}`);
    playSound(soundName);
};

// Debug-Info für verfügbare Sounds
window.listSounds = function() {
    console.log('🎵 Verfügbare Sounds:');
    Object.keys(SOUND_CONFIG).forEach(soundName => {
        const loaded = audioBuffers[soundName] ? '✅' : '❌';
        const type = audioBuffers[soundName]?.synthetic ? 'synthetisch' : 'custom';
        console.log(`${loaded} ${soundName} (${type})`);
    });
    console.log('\n💡 Verwendung: testSound("hit"), testSound("kill"), testSound("headshot")');
};

// Debug-Funktionen für Scoreboard
window.addTestKill = function() {
    if (playerStats[socket.id]) {
        playerStats[socket.id].kills++;
        console.log('🎯 Test-Kill hinzugefügt. Kills:', playerStats[socket.id].kills);
        if (isScoreboardVisible) {
            updateScoreboard();
        }
    }
};

window.addTestDeath = function() {
    if (playerStats[socket.id]) {
        playerStats[socket.id].deaths++;
        console.log('💀 Test-Death hinzugefügt. Deaths:', playerStats[socket.id].deaths);
        if (isScoreboardVisible) {
            updateScoreboard();
        }
    }
};

window.showStats = function() {
    console.log('📊 Aktuelle Player Stats:', playerStats);
    console.log('📊 Scoreboard sichtbar:', isScoreboardVisible);
};

function animate() {
    if (!gameStarted) return;
    
    requestAnimationFrame(animate);
    
    updatePlayer();
    updateBullets();
    updateCooldownUI(); // Cooldown-Balken aktualisieren
    
    // NameTags zur Kamera drehen
    Object.values(players).forEach(playerGroup => {
        if (playerGroup.userData && playerGroup.userData.nameTag) {
            playerGroup.userData.nameTag.lookAt(camera.position);
        }
    });
    
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
            showWeaponModel('rifle');
            updateWeaponUI();
            break;
        case 'Digit2':
            currentWeapon = WEAPONS.SHOTGUN;
            resetZoom(); // Zoom zurücksetzen wenn andere Waffe gewählt
            showWeaponModel('shotgun');
            updateWeaponUI();
            break;
        case 'Digit3':
            currentWeapon = WEAPONS.SNIPER;
            showWeaponModel('sniper');
            updateWeaponUI();
            break;
        case 'Tab':
            event.preventDefault(); // Verhindert Browser-Tab-Wechsel
            showScoreboard();
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
        case 'Tab':
            hideScoreboard();
            break;
    }
}

function onMouseClick(event) {
    // Audio Context aktivieren falls noch nicht geschehen (Browser-Schutz)
    if (!audioContext && gameStarted) {
        initAudio();
    }
    
    if (!isPointerLocked && gameStarted) {
        document.body.requestPointerLock();
    }
}

function onMouseDown(event) {
    if (gameStarted && isPointerLocked) {
        if (event.button === 0) { // Linke Maustaste - SOFORTIGES Schießen
            event.preventDefault();
            shootInstant();
        } else if (event.button === 2) { // Rechte Maustaste - Zoom start
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

// ===== TITLESCREEN SHOTGUN =====
// Erstelle eine große rotierende Shotgun für das Menu
let menuScene = null;
let menuCamera = null;
let menuRenderer = null;
let menuShotgun = null;

function createMenuShotgun() {
    console.log('🎯 Erstelle Titlescreen Shotgun...');
    
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('❌ Canvas nicht gefunden');
        return;
    }
    
    // Menu Scene Setup
    menuScene = new THREE.Scene();
    menuCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    menuRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
    
    menuRenderer.setSize(window.innerWidth, window.innerHeight);
    menuRenderer.setClearColor(0x000000, 0); // Transparenter Hintergrund
    
    // Licht für Menu
    const menuLight = new THREE.DirectionalLight(0xffffff, 2);
    menuLight.position.set(5, 5, 5);
    menuScene.add(menuLight);
    
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    menuScene.add(ambientLight);
    
    // Kamera Position
    menuCamera.position.set(0, 0, 3);
    
    // SHOTGUN für Menu erstellen (größer)
    var shotgunGroup = new THREE.Group();
    shotgunGroup.name = "Menu_Shotgun";
    
    // Teil 1: Hauptlauf
    var barrel = new THREE.Mesh(
        new THREE.BoxGeometry(0.5625, 0.125, 0.125),
        new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    barrel.position.set(0.375, 0.25, 0);
    barrel.castShadow = true;
    shotgunGroup.add(barrel);
    
    // Teil 2: Laufverlängerung
    var barrelExt = new THREE.Mesh(
        new THREE.BoxGeometry(0.5625, 0.125, 0.125),
        new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    barrelExt.position.set(0.375, 0.25, 0.0625);
    barrelExt.castShadow = true;
    shotgunGroup.add(barrelExt);
    
    // Teil 3: Schaft mit Rotation
    var stock = new THREE.Mesh(
        new THREE.BoxGeometry(0.125, 0.275, 0.125),
        new THREE.MeshLambertMaterial({ color: 0x8B4513 })
    );
    stock.position.set(-0.125, 0.0625, 0);
    stock.rotation.z = -0.17364817766693033;
    stock.castShadow = true;
    shotgunGroup.add(stock);
    
    // Teil 4: Griff
    var grip = new THREE.Mesh(
        new THREE.BoxGeometry(0.375, 0.25, 0.125),
        new THREE.MeshLambertMaterial({ color: 0x654321 })
    );
    grip.position.set(0, 0.1875, 0);
    grip.castShadow = true;
    shotgunGroup.add(grip);
    
    // Teil 5: Obergriff mit Rotation
    var topGrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.125, 0.125, 0.125),
        new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    topGrip.position.set(0, 0.375, 0);
    topGrip.rotation.z = 0.1521233861899167;
    topGrip.castShadow = true;
    shotgunGroup.add(topGrip);
    
    // Shotgun für Menu skalieren und positionieren
    shotgunGroup.scale.set(3, 3, 3); // Groß für Menu
    shotgunGroup.position.set(1.5, -0.5, 0); // Rechts im Menu
    
    menuShotgun = shotgunGroup;
    menuScene.add(menuShotgun);
    
    console.log('✅ Menu Shotgun erstellt');
    
    // Menu Render Loop starten
    function menuRender() {
        if (!gameStarted && menuShotgun) {
            requestAnimationFrame(menuRender);
            
            // Shotgun rotieren
            menuShotgun.rotation.y += 0.02;
            menuShotgun.rotation.x += 0.01;
            
            menuRenderer.render(menuScene, menuCamera);
        }
    }
    
    menuRender();
    console.log('🎬 Menu Shotgun Animation gestartet');
}

// Menu Shotgun beim Laden erstellen
setTimeout(createMenuShotgun, 1000);

// Zufällige Spielerdaten beim Laden setzen
setRandomPlayerData();

console.log('🎯 Hardcoded Shotgun bereit - Menu und Spiel Modelle werden geladen!'); 
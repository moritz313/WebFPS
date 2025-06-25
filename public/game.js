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
    shift: false,
    ctrl: false
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

// Präzise 3D-Kollisionserkennung: What you see is what you get!
function checkCollisionWithObstacles(newX, newY, newZ, playerRadius = 0.4) {
    const playerHeight = 1.8;
    const playerBottom = newY - playerHeight/2;
    const playerTop = newY + playerHeight/2;
    
    for (const obstacle of mapObstacles) {
        // Exakte AABB-Kollision - keine Ausnahmen, keine Tricks
        const obstacleLeft = obstacle.x - obstacle.width / 2;
        const obstacleRight = obstacle.x + obstacle.width / 2;
        const obstacleBack = obstacle.z - obstacle.depth / 2;
        const obstacleForward = obstacle.z + obstacle.depth / 2;
        const obstacleBottom = obstacle.y - obstacle.height / 2;
        const obstacleTop = obstacle.y + obstacle.height / 2;
        
        // Spieler-Bounding-Box mit Radius
        const playerLeft = newX - playerRadius;
        const playerRight = newX + playerRadius;
        const playerBack = newZ - playerRadius;
        const playerForward = newZ + playerRadius;
        
        // 3D AABB Überschneidungstest
        const xOverlap = playerRight > obstacleLeft && playerLeft < obstacleRight;
        const yOverlap = playerTop > obstacleBottom && playerBottom < obstacleTop;
        const zOverlap = playerForward > obstacleBack && playerBack < obstacleForward;
        
        if (xOverlap && yOverlap && zOverlap) {
            return obstacle; // Exakte Kollision gefunden
        }
    }
    return null; // Keine Kollision
}

// Präzise Boden-Erkennung: Exakt auf Objekt-Oberkanten
function getGroundHeightAt(x, z, currentY, playerRadius = 0.4) {
    let maxGroundHeight = GROUND_Y; // Standard-Bodenhöhe
    
    for (const obstacle of mapObstacles) {
        // Exakte horizontale Überschneidung prüfen
        const obstacleLeft = obstacle.x - obstacle.width / 2;
        const obstacleRight = obstacle.x + obstacle.width / 2;
        const obstacleBack = obstacle.z - obstacle.depth / 2;
        const obstacleForward = obstacle.z + obstacle.depth / 2;
        
        // Spieler-Fußprint mit Radius
        const playerLeft = x - playerRadius;
        const playerRight = x + playerRadius;
        const playerBack = z - playerRadius;
        const playerForward = z + playerRadius;
        
        // Horizontale Überschneidung prüfen
        const xOverlap = playerRight > obstacleLeft && playerLeft < obstacleRight;
        const zOverlap = playerForward > obstacleBack && playerBack < obstacleForward;
        
        if (xOverlap && zOverlap) {
            // Spieler steht auf dem Objekt - Oberkante als Boden verwenden
            const obstacleTop = obstacle.y + obstacle.height / 2;
            
            // Nur verwenden wenn es höher ist als aktueller Boden UND Spieler darüber ist
            if (obstacleTop > maxGroundHeight && currentY >= obstacleTop - 0.5) {
                maxGroundHeight = obstacleTop;
        }
    }
    }
    
    return maxGroundHeight;
}

// Alte Funktion entfernt - jetzt verwenden wir checkCollisionWithObstacles für alle 3D-Kollisionen

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
const headTexturePicker = document.getElementById('headTexturePicker');
const healthValue = document.getElementById('healthValue');
const healthBar = document.getElementById('health');
const deathScreen = document.getElementById('death-screen');
const respawnTimer = document.getElementById('respawn-timer');
const hitmarker = document.getElementById('hitmarker');
const hitmarkerImage = document.getElementById('hitmarker-image');
const killIcon = document.getElementById('kill-icon');
const killIconImage = document.getElementById('kill-icon-image');
const lowHpOverlay = document.getElementById('low-hp-overlay');
const scoreboard = document.getElementById('scoreboard');
const killfeed = document.getElementById('killfeed');

// Admin Cheat Menu Elemente
const adminMenu = document.getElementById('admin-menu');
const espToggle = document.getElementById('esp-toggle');
const flyToggle = document.getElementById('fly-toggle');
const rapidfireToggle = document.getElementById('rapidfire-toggle');
const noShotDelayToggle = document.getElementById('noshotdelay-toggle');

// Admin Cheat Variablen
let isAdminMenuVisible = false;
let espEnabled = false;
let flyEnabled = false;
let rapidfireEnabled = false;
let noShotDelayEnabled = false;
let currentPlayerUsername = null;

// Rapid Fire Variablen
let isMousePressed = false;
let rapidfireInterval = null;

// Scoreboard-Daten
let playerStats = {}; // { playerId: { kills: 0, deaths: 0, username: '', color: '' } }
let isScoreboardVisible = false;

// Killfeed-System
const KILLFEED_MAX_ENTRIES = 8;
const KILLFEED_ENTRY_LIFETIME = 7000; // 7 Sekunden

function addKillToFeed(killerData, victimData, weaponType, isHeadshot = false) {
    if (!killfeed) return;
    
    console.log('🎯 Füge Kill zum Feed hinzu:', killerData, victimData, weaponType);
    
    // Kill-Entry erstellen
    const killEntry = document.createElement('div');
    killEntry.className = 'kill-entry';
    
    // Spezielle Klassen für verschiedene Kill-Typen
    if (isHeadshot) {
        killEntry.classList.add('headshot');
    }
    
    // Waffen-Icons (PNG statt Emojis)
    const weaponIcons = {
        'rifle': '<img src="/textures/icons/rifle.png" alt="Rifle">',
        'shotgun': '<img src="/textures/icons/shotgun.png" alt="Shotgun">',
        'sniper': '<img src="/textures/icons/sniper.png" alt="Sniper">',
        'fall': '💀',
        'suicide': '☠️'
    };
    
    const weaponIcon = weaponIcons[weaponType] || weaponIcons['rifle'];
    
    // Kill-Entry Inhalt
    if (killerData.id === victimData.id) {
        // Selbstmord
        killEntry.classList.add('suicide');
        killEntry.innerHTML = `
            <span class="victim-name">${victimData.username}</span>
            <span class="weapon-icon">☠️</span>
            <span class="killer-name">Selbstmord</span>
        `;
    } else {
        // Normaler Kill
        killEntry.innerHTML = `
            <span class="killer-name">${killerData.username}</span>
            <span class="weapon-icon">${weaponIcon}</span>
            <span class="victim-name">${victimData.username}</span>
        `;
    }
    
    // Entry zum Killfeed hinzufügen (oben)
    killfeed.insertBefore(killEntry, killfeed.firstChild);
    
    // Alte Entries entfernen wenn zu viele
    while (killfeed.children.length > KILLFEED_MAX_ENTRIES) {
        const oldEntry = killfeed.lastChild;
        if (oldEntry) {
            killfeed.removeChild(oldEntry);
        }
    }
    
    // Entry nach bestimmter Zeit ausblenden
    setTimeout(() => {
        if (killEntry && killEntry.parentNode) {
            killEntry.classList.add('fade-out');
            setTimeout(() => {
                if (killEntry && killEntry.parentNode) {
                    killfeed.removeChild(killEntry);
                }
            }, 300); // Animation-Dauer
        }
    }, KILLFEED_ENTRY_LIFETIME);
}

function getPlayerDataById(playerId) {
    // Spielerdaten aus verschiedenen Quellen abrufen
    if (players[playerId] && players[playerId].userData) {
        return {
            id: playerId,
            username: players[playerId].userData.username || playerStats[playerId]?.username || 'Unbekannt',
            color: playerStats[playerId]?.color || '#ffffff'
        };
    }
    
    if (playerStats[playerId]) {
        return {
            id: playerId,
            username: playerStats[playerId].username || 'Unbekannt',
            color: playerStats[playerId].color || '#ffffff'
        };
    }
    
    // Fallback für unbekannte Spieler
    return {
        id: playerId,
        username: 'Unbekannt',
        color: '#ffffff'
    };
}

// Verfügbare Kopf-Texturen
let availableHeadTextures = [];
let selectedHeadTexture = 'head1.png'; // Standard

// Kopf-Texturen dynamisch laden
async function loadAvailableHeadTextures() {
    try {
        // Versuche die textures/heads/ API-Endpoint aufzurufen (falls Server das unterstützt)
        const response = await fetch('/api/head-textures');
        if (response.ok) {
            const textures = await response.json();
            availableHeadTextures = textures;
        } else {
            throw new Error('API nicht verfügbar');
        }
    } catch (error) {
        console.log('API nicht verfügbar, verwende Standard-Texturen:', error.message);
        // Fallback: Standard-Liste von bekannten Texturen
        availableHeadTextures = ['head1.png'];
        
        // Versuche weitere Standard-Texturen zu testen
        const possibleTextures = [
            'head1.png', 'head2.png', 'head3.png', 'head4.png', 'head5.png',
            'steve.png', 'alex.png', 'creeper.png', 'zombie.png', 'skeleton.png'
        ];
        
        for (const texture of possibleTextures) {
            try {
                const testResponse = await fetch(`/textures/heads/${texture}`, { method: 'HEAD' });
                if (testResponse.ok && !availableHeadTextures.includes(texture)) {
                    availableHeadTextures.push(texture);
                }
            } catch (e) {
                // Textur existiert nicht, ignorieren
            }
        }
    }
    
    console.log('Verfügbare Kopf-Texturen:', availableHeadTextures);
    populateHeadTextureDropdown();
}

// Dropdown mit verfügbaren Texturen füllen
function populateHeadTextureDropdown() {
    if (!headTexturePicker) return;
    
    // Dropdown leeren
    headTexturePicker.innerHTML = '';
    
    // Optionen hinzufügen
    availableHeadTextures.forEach(texture => {
        const option = document.createElement('option');
        option.value = texture;
        option.textContent = texture.replace('.png', '').replace(/([A-Z])/g, ' $1').trim();
        if (texture === selectedHeadTexture) {
            option.selected = true;
        }
        headTexturePicker.appendChild(option);
    });
    
    // Event Listener für Änderungen
    headTexturePicker.addEventListener('change', (event) => {
        selectedHeadTexture = event.target.value;
        console.log('Kopf-Textur geändert zu:', selectedHeadTexture);
        
        // Wenn im Spiel, sofort an Server senden
        if (gameStarted && socket) {
            socket.emit('setPlayerData', { 
                headTexture: selectedHeadTexture 
            });
        }
    });
}

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
    
    // Zufällige Kopf-Textur
    if (availableHeadTextures.length > 0) {
        const randomTexture = availableHeadTextures[Math.floor(Math.random() * availableHeadTextures.length)];
        selectedHeadTexture = randomTexture;
        if (headTexturePicker) {
            headTexturePicker.value = randomTexture;
        }
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
            const playerMesh = playerGroup.children.find(child => 
                child.geometry && child.geometry.type === 'BoxGeometry' && 
                child.position.y === 0 // Körper, nicht Kopf
            );
            if (playerMesh && playerMesh.material) {
                playerMesh.material.color.setHex(new THREE.Color(data.color).getHex());
            }
        }
        
        // Kopf-Textur aktualisieren wenn vorhanden
        if (data.headTexture) {
            const headMesh = playerGroup.children.find(child => 
                child.geometry && child.geometry.type === 'BoxGeometry' && 
                child.position.y === 1.2 // Kopf-Position
            );
            if (headMesh && headMesh.material && Array.isArray(headMesh.material)) {
                // Neue Textur laden
                const textureLoader = new THREE.TextureLoader();
                const newHeadTexture = textureLoader.load(`/textures/heads/${data.headTexture}`);
                newHeadTexture.magFilter = THREE.NearestFilter;
                newHeadTexture.minFilter = THREE.NearestFilter;
                
                // Nur das Vorderseiten-Material (Index 5) mit neuer Textur ersetzen
                if (headMesh.material[5]) {
                    headMesh.material[5].map = newHeadTexture;
                    headMesh.material[5].needsUpdate = true;
                }
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
        
        // 3D-Audio für Gegner-Schüsse abspielen (nicht eigene)
        if (bulletData.playerId !== socket.id) {
            playEnemyWeaponSound(bulletData);
        }
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

socket.on('playerKilled', (data) => {
    console.log('🔥 Globaler Kill:', data);
    
    // Kill zum Killfeed hinzufügen (für alle Spieler sichtbar)
    const killerData = {
        id: data.killerId,
        username: data.killerUsername || 'Unbekannt'
    };
    
    const victimData = {
        id: data.victimId,
        username: data.victimUsername || 'Unbekannt'
    };
    
    // Nur hinzufügen wenn es nicht der eigene Kill war (der wurde schon in hitConfirmed hinzugefügt)
    if (data.killerId !== socket.id) {
        addKillToFeed(killerData, victimData, data.weaponType, data.isHeadshot);
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
        
        // Kill zum Killfeed hinzufügen
        const killerData = getPlayerDataById(socket.id);
        const victimData = getPlayerDataById(data.targetId);
        addKillToFeed(killerData, victimData, data.weaponType, data.isHeadshot);
        
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

socket.on('mapData', (mapData) => {
    console.log('🗺️ Map-Daten erhalten:', mapData);
    
    // Extrahiere obstacles aus mapData
    const obstacles = mapData.obstacles || mapData;
    console.log('📊 Verarbeitete Hindernisse:', obstacles.length, 'Strukturen');
    console.log('🏘️ Map-Konfiguration:', mapData.config);
    console.log('📐 Map-Grenzen:', mapData.bounds);
    
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
    
    // Username, Farbe und Kopf-Textur an Server senden
    const playerColor = colorPicker.value;
    socket.emit('setPlayerData', { 
        username: username,
        color: playerColor,
        headTexture: selectedHeadTexture
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
    
    // Admin Menu initialisieren
    initAdminMenu();
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
    // Erweiterte Arena mit mehrschichtigem Boden
    console.log('🏗️ Erstelle erweiterte Arena mit professionellem Boden...');
    
    // 4x größere Low-Poly-Dorf Bodenplatte (160x120 statt 40x30)
    const floorGeometry = new THREE.PlaneGeometry(160, 120);
    
    // Texture Loader für verschiedene Boden-Texturen
    const textureLoader = new THREE.TextureLoader();
    
    textureLoader.load(
        'https://i.imgur.com/5dx4Y0V.png',
        function(texture) {
            console.log('✅ Hauptboden-Textur geladen');
            
            // Hauptboden-Einstellungen - 4x mehr Wiederholungen für größere Fläche
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(16, 12); // 4x mehr Textur-Wiederholung für 160x120 Bodenplatte
            
            const floorMaterial = new THREE.MeshLambertMaterial({ 
                map: texture
            });
            
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
            floor.name = 'main-arena-floor';
    scene.add(floor);
    
            // Zentrale Dorf-Markierung (größer für größere Arena)
            const centerGeometry = new THREE.RingGeometry(8, 12, 16); // 4x größer
            const centerMaterial = new THREE.MeshLambertMaterial({ 
                color: 0x444444,
                transparent: true,
                opacity: 0.7
            });
            const centerRing = new THREE.Mesh(centerGeometry, centerMaterial);
            centerRing.rotation.x = -Math.PI / 2;
            centerRing.position.y = 0.01; // Leicht über dem Hauptboden
            centerRing.name = 'center-arena-ring';
            scene.add(centerRing);
            
            // Richtungsmarkierungen für Dorf (4x größer)
            const markerGeometry = new THREE.PlaneGeometry(8, 4); // 4x größer
            const markerMaterial = new THREE.MeshLambertMaterial({ 
                color: 0x666666,
                transparent: true,
                opacity: 0.6
            });
            
            // Nord-Markierung (4x weiter entfernt)
            const northMarker = new THREE.Mesh(markerGeometry, markerMaterial);
            northMarker.rotation.x = -Math.PI / 2;
            northMarker.position.set(0, 0.02, -56); // 4x weiter: -14 * 4 = -56
            northMarker.name = 'north-marker';
            scene.add(northMarker);
            
            // Süd-Markierung (4x weiter entfernt)
            const southMarker = new THREE.Mesh(markerGeometry, markerMaterial);
            southMarker.rotation.x = -Math.PI / 2;
            southMarker.rotation.z = Math.PI;
            southMarker.position.set(0, 0.02, 56); // 4x weiter: 14 * 4 = 56
            southMarker.name = 'south-marker';
            scene.add(southMarker);
            
            // Ost-Markierung (4x weiter entfernt)
            const eastMarker = new THREE.Mesh(markerGeometry, markerMaterial);
            eastMarker.rotation.x = -Math.PI / 2;
            eastMarker.rotation.z = -Math.PI / 2;
            eastMarker.position.set(76, 0.02, 0); // 4x weiter: 19 * 4 = 76
            eastMarker.name = 'east-marker';
            scene.add(eastMarker);
            
            // West-Markierung (4x weiter entfernt)
            const westMarker = new THREE.Mesh(markerGeometry, markerMaterial);
            westMarker.rotation.x = -Math.PI / 2;
            westMarker.rotation.z = Math.PI / 2;
            westMarker.position.set(-76, 0.02, 0); // 4x weiter: -19 * 4 = -76
            westMarker.name = 'west-marker';
            scene.add(westMarker);
            
            console.log('🏗️ 4x größerer texturierter Boden zur Szene hinzugefügt');
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
            
            console.log('🏗️ 4x größerer Fallback-Boden zur Szene hinzugefügt');
        }
    );
    
        // Arena-Wände werden jetzt durch die Map-Boundaries erstellt
    console.log('🧱 Arena-Wände werden über Map-Boundaries generiert...');
    
    // Hindernisse werden jetzt server-seitig geladen
    // createObstacles() wird nach Erhalt der Map-Daten aufgerufen
}

function setupCamera() {
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Sichere Spawn-Position finden
    let spawnX = 0;
    let spawnZ = 0;
    let attempts = 0;
    
    // Versuche eine freie Position zu finden (4x größere Arena)
    while (checkCollisionWithObstacles(spawnX, PLAYER_HEIGHT, spawnZ) && attempts < 50) {
        spawnX = (Math.random() - 0.5) * 120; // Zentral in der größeren Arena spawnen (kleiner als 160x120 Bodenplatte)
        spawnZ = (Math.random() - 0.5) * 80;
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
    console.log('🏗️ Erstelle erweiterte Arena basierend auf Server-Daten...');
    console.log('Szene vorhanden:', !!scene);
    console.log('Map-Daten:', mapObstacles.length, 'Strukturen');
    
    if (!mapObstacles || mapObstacles.length === 0) {
        console.log('❌ Keine Map-Daten verfügbar');
        return;
    }
    
    if (!scene) {
        console.log('❌ Keine Szene verfügbar');
        return;
    }
    
    // Verschiedene Materialien für verschiedene Strukturtypen
    const materials = {
        stone: new THREE.MeshLambertMaterial({ color: 0x8B7355 }),        // Braun-grau für Hauptstrukturen
        metal: new THREE.MeshLambertMaterial({ color: 0x708090 }),        // Metallgrau für Brücken
        concrete: new THREE.MeshLambertMaterial({ color: 0xBDC3C7 }),     // Hellgrau für Mauern
        wood: new THREE.MeshLambertMaterial({ color: 0x8B4513 }),         // Braun für Rampen
        tower: new THREE.MeshLambertMaterial({ color: 0x4A4A4A }),        // Dunkelgrau für Türme
        cover: new THREE.MeshLambertMaterial({ color: 0x654321 }),        // Dunkelbraun für Deckungen
        platform: new THREE.MeshLambertMaterial({ color: 0x2F4F4F })     // Dunkelgrün für Plattformen
    };
    
    // Texturen laden für bessere Optik
    console.log('📦 Lade Arena-Texturen...');
    const textureLoader = new THREE.TextureLoader();
    
    // Funktion zur Bestimmung des Materials basierend auf Low-Poly-Dorf-Strukturen
    function getMaterialForObstacle(obstacle, index) {
        // Verwende die neue color-Property vom Server falls vorhanden
        if (obstacle.color !== undefined) {
            const material = new THREE.MeshLambertMaterial({ color: obstacle.color });
            return material;
        }
        
        // Fallback basierend auf type-Property vom Server
        if (obstacle.type) {
            switch (obstacle.type) {
                case 'house_body':
                case 'farmhouse':
                    return materials.wood;
                case 'house_roof':
                case 'temple_roof':
                case 'barn':
                    return new THREE.MeshLambertMaterial({ color: 0xB22222 }); // Rot
                case 'tower_body':
                case 'watchtower_body':
                case 'castle_tower':
                    return materials.stone;
                case 'tower_battlement':
                case 'watchtower_base':
                    return materials.metal;
                case 'tower_balcony':
                    return materials.concrete;
                case 'castle_main':
                    return new THREE.MeshLambertMaterial({ color: 0x778899 }); // Steinfarbe
                case 'temple_base':
                case 'temple_pillar':
                    return new THREE.MeshLambertMaterial({ color: 0xD3D3D3 }); // Hellgrau
                case 'barn_storage':
                    return materials.wood;
                case 'hill':
                    return new THREE.MeshLambertMaterial({ color: 0x228B22 }); // Grün
                case 'tree_trunk':
                    return materials.wood;
                case 'tree_crown':
                    return new THREE.MeshLambertMaterial({ color: 0x228B22 }); // Waldgrün
                case 'well':
                case 'fireplace':
                    return materials.stone;
                case 'boundary':
                    return materials.wood;
                default:
                    return materials.stone;
            }
        }
        
        // Standard Material für unbekannte Strukturen
        return materials.stone;
    }
    
    textureLoader.load(
        'https://i.imgur.com/DiMAnF6.png',
        function(baseTexture) {
            console.log('✅ Basis-Textur geladen, erstelle Arena...');
    
    mapObstacles.forEach((obstacle, index) => {
                // Material basierend auf Struktur-Typ wählen
                const material = getMaterialForObstacle(obstacle, index);
                
                // Spezielle Texturen für bestimmte Strukturen
                if (material === materials.metal || material === materials.concrete) {
                    // Klone die Basis-Textur für Metall/Beton
                    const clonedTexture = baseTexture.clone();
                    clonedTexture.wrapS = THREE.RepeatWrapping;
                    clonedTexture.wrapT = THREE.RepeatWrapping;
                    clonedTexture.repeat.set(obstacle.width / 2, obstacle.height / 2);
                    
                    material.map = clonedTexture;
                    material.needsUpdate = true;
                }
        
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(obstacle.width, obstacle.height, obstacle.depth),
                    material
        );
        
        box.position.set(obstacle.x, obstacle.y, obstacle.z);
        box.castShadow = true;
        box.receiveShadow = true;
        box.userData.isObstacle = true;
        box.userData.obstacleData = obstacle;
        
                // Namen für Low-Poly-Dorf-Strukturen
                const structureName = obstacle.type || 'structure';
                box.name = `${structureName}-${index + 1}`;
        scene.add(box);
                
                // Spezielle Effekte für Low-Poly-Dorf-Strukturen
                if (structureName === 'tower_body' || structureName === 'watchtower_body') {
                    // Leuchteffekt für Turm-Spitzen
                    const light = new THREE.PointLight(0xffffcc, 0.3, 12);
                    light.position.copy(box.position);
                    light.position.y += obstacle.height / 2 + 1;
                    scene.add(light);
                } else if (structureName === 'fireplace') {
                    // Warmes Feuer-Licht für Lagerfeuer
                    const fireLight = new THREE.PointLight(0xff6600, 0.4, 6);
                    fireLight.position.copy(box.position);
                    fireLight.position.y += obstacle.height + 0.5;
                    scene.add(fireLight);
                }
            });
    
            console.log(`🏘️ Low-Poly-Dorf mit ${mapObstacles.length} Strukturen erfolgreich erstellt!`);
            console.log('🏘️ Dorf-Strukturen:');
            console.log('  🏠 Einfaches Haus mit Dach (zentral)');
            console.log('  🏰 Turm mit Zinnen und Beleuchtung');
            console.log('  🏰 Kleine Burg mit vier Ecktürmen');
            console.log('  🚜 Bauernhütte mit Stall');
            console.log('  ⛩️ Tempel mit weißen Säulen');
            console.log('  🚪 Holzlager mit Scheune');
            console.log('  🗼 Wachturm auf grünem Hügel');
            console.log('  🌳 Waldstück mit 10 Bäumen');
            console.log('  💧 Brunnen und Lagerfeuer mit warmem Licht');
        },
        function(progress) {
            console.log('📥 Arena-Textur Loading Progress:', (progress.loaded / progress.total * 100).toFixed(1) + '%');
        },
        function(error) {
            console.error('❌ Fehler beim Laden der Arena-Textur:', error);
            console.log('🔄 Verwende Fallback-Materialien...');
            
            // Fallback: Verwende die vordefinierten Materialien ohne Texturen
            mapObstacles.forEach((obstacle, index) => {
                const material = getMaterialForObstacle(obstacle, index);
                
                const box = new THREE.Mesh(
                    new THREE.BoxGeometry(obstacle.width, obstacle.height, obstacle.depth),
                    material
                );
                
                box.position.set(obstacle.x, obstacle.y, obstacle.z);
                box.castShadow = true;
                box.receiveShadow = true;
                box.userData.isObstacle = true;
                box.userData.obstacleData = obstacle;
                box.name = `fallback-structure-${index + 1}`;
                
                scene.add(box);
    });
    
            console.log(`🎉 Low-Poly-Dorf mit ${mapObstacles.length} Fallback-Strukturen erstellt.`);
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
    
    // Kopf mit Textur auf der Vorderseite
    const headGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    
    // Textur für die Vorderseite laden
    const textureLoader = new THREE.TextureLoader();
    const texturePath = playerData.headTexture || selectedHeadTexture || 'head1.png';
    const headTexture = textureLoader.load(`/textures/heads/${texturePath}`);
    headTexture.magFilter = THREE.NearestFilter; // Pixeliges Aussehen beibehalten
    headTexture.minFilter = THREE.NearestFilter;
    
    // Array von Materialien für jede Seite des Würfels
    // Reihenfolge: rechts, links, oben, unten, hinten, vorne
    const headMaterials = [
        new THREE.MeshLambertMaterial({ color: 0xffff00 }), // rechts
        new THREE.MeshLambertMaterial({ color: 0xffff00 }), // links
        new THREE.MeshLambertMaterial({ color: 0xffff00 }), // oben
        new THREE.MeshLambertMaterial({ color: 0xffff00 }), // unten
        new THREE.MeshLambertMaterial({ color: 0xffff00 }), // hinten
        new THREE.MeshLambertMaterial({ map: headTexture })  // vorne (mit Textur)
    ];
    
    const headMesh = new THREE.Mesh(headGeometry, headMaterials);
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
    
    // NameTag soll immer zur Kamera zeigen und Username für Killfeed speichern
    playerGroup.userData = { 
        nameTag: nameTag,
        username: displayName
    };
    
    // Position setzen
    playerGroup.position.set(playerData.x, playerData.y - 1, playerData.z); // Y-1 da Player auf Boden steht
    playerGroup.rotation.y = playerData.rotationY || 0;
    
    // Schatten aktivieren
    playerMesh.castShadow = true;
    headMesh.castShadow = true;
    playerMesh.receiveShadow = true;
    
    players[playerData.id] = playerGroup;
    playerGroup.mesh = playerGroup; // Referenz für ESP
    playerGroup.nameTag = nameTag; // Referenz für ESP Name Tags
    scene.add(playerGroup);
    
    // ESP anwenden falls aktiv
    if (espEnabled) {
        applyESP();
    }
    
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
    // Cooldown für alle Waffen überprüfen (außer wenn No Shot Delay aktiv ist)
    const currentTime = Date.now();
    if (!(noShotDelayEnabled && isAdminUser()) && currentTime - lastShotTime < currentWeapon.cooldown) {
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

// ===== ADMIN CHEAT MENU FUNKTIONEN =====

function showAdminMenu() {
    if (!isAdminUser()) return;
    
    adminMenu.classList.remove('hidden');
    isAdminMenuVisible = true;
    
    // Pointer Lock temporär deaktivieren
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }
    
    console.log('🔒 Admin Cheat Menu geöffnet');
}

function hideAdminMenu() {
    adminMenu.classList.add('hidden');
    isAdminMenuVisible = false;
    
    // Pointer Lock wieder aktivieren wenn im Spiel
    if (gameStarted) {
        document.body.requestPointerLock();
    }
    
    console.log('🔒 Admin Cheat Menu geschlossen');
}

function toggleAdminMenu() {
    if (!isAdminUser()) {
        console.log('❌ Admin-Funktionen nur für Ares verfügbar');
        return;
    }
    
    if (isAdminMenuVisible) {
        hideAdminMenu();
    } else {
        showAdminMenu();
    }
}

function isAdminUser() {
    // Nur wenn der Username "Ares" ist
    const username = usernameInput.value.trim();
    return username === 'Ares';
}

function initAdminMenu() {
    if (!adminMenu || !espToggle || !flyToggle || !rapidfireToggle || !noShotDelayToggle) return;
    
    // ESP Toggle Event Listener
    espToggle.addEventListener('change', function() {
        espEnabled = this.checked;
        applyESP();
        console.log('👁️ ESP', espEnabled ? 'aktiviert' : 'deaktiviert');
    });
    
    // Fly Toggle Event Listener
    flyToggle.addEventListener('change', function() {
        flyEnabled = this.checked;
        console.log('✈️ Fly Mode', flyEnabled ? 'aktiviert' : 'deaktiviert');
    });
    
    // Rapid Fire Toggle Event Listener
    rapidfireToggle.addEventListener('change', function() {
        rapidfireEnabled = this.checked;
        if (!rapidfireEnabled && rapidfireInterval) {
            clearInterval(rapidfireInterval);
            rapidfireInterval = null;
        }
        console.log('🔥 Rapid Fire', rapidfireEnabled ? 'aktiviert' : 'deaktiviert');
    });
    
    // No Shot Delay Toggle Event Listener
    noShotDelayToggle.addEventListener('change', function() {
        noShotDelayEnabled = this.checked;
        console.log('⚡ Remove Shot Delay', noShotDelayEnabled ? 'aktiviert' : 'deaktiviert');
    });
    
    console.log('🔒 Admin Cheat Menu initialisiert');
}

function applyESP() {
    if (!gameStarted || !scene) return;
    
    // Alle anderen Spieler durchgehen
    Object.values(players).forEach(playerObj => {
        if (playerObj) {
            if (espEnabled) {
                // ESP-Box erstellen falls noch nicht vorhanden
                if (!playerObj.espBox) {
                    // Wireframe-Box erstellen die um den Spieler geht
                    const boxGeometry = new THREE.BoxGeometry(1.2, 2.5, 1.2);
                    const boxMaterial = new THREE.MeshBasicMaterial({
                        color: 0xff0000,
                        wireframe: true,
                        transparent: true,
                        opacity: 0.8,
                        depthTest: false, // Durch Wände sichtbar
                        depthWrite: false
                    });
                    
                    const espBox = new THREE.Mesh(boxGeometry, boxMaterial);
                    espBox.position.set(0, 0.75, 0); // Zentriert um den Spieler
                    espBox.renderOrder = 1000; // Immer im Vordergrund rendern
                    
                    playerObj.espBox = espBox;
                    playerObj.add(espBox);
                    
                    console.log('👁️ ESP-Box für Spieler erstellt');
                }
            } else {
                // ESP-Box entfernen
                if (playerObj.espBox) {
                    playerObj.remove(playerObj.espBox);
                    playerObj.espBox = null;
                    console.log('👁️ ESP-Box entfernt');
                }
            }
        }
    });
}

// ===== RAPID FIRE FUNKTIONEN =====

function startRapidFire() {
    if (rapidfireInterval) return; // Bereits aktiv
    
    // Rapid Fire alle 50ms (20 Schüsse pro Sekunde)
    rapidfireInterval = setInterval(() => {
        if (isMousePressed && rapidfireEnabled && isAdminUser() && gameStarted && isPointerLocked) {
            shootInstant();
        } else {
            stopRapidFire();
        }
    }, 50);
    
    console.log('🔥 Rapid Fire gestartet');
}

function stopRapidFire() {
    if (rapidfireInterval) {
        clearInterval(rapidfireInterval);
        rapidfireInterval = null;
        console.log('🔥 Rapid Fire gestoppt');
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
    
    // Geschwindigkeit bestimmen (Sprint oder normal, aber nicht im Fly Mode)
    let currentSpeed = PLAYER_SPEED;
    if (keys.shift && !(flyEnabled && isAdminUser())) {
        currentSpeed *= SPRINT_MULTIPLIER;
    }
    
    direction.multiplyScalar(currentSpeed * deltaTime);
    
    // Fly Mode oder normaler Sprung
    if (flyEnabled && isAdminUser()) {
        // Fly Mode aktiv - kontinuierliches Fliegen
        if (keys.space) {
            velocityY = PLAYER_SPEED * 1.5; // Fly-Geschwindigkeit nach oben
        } else if (keys.shift) {
            velocityY = -PLAYER_SPEED * 1.5; // Fly-Geschwindigkeit nach unten
        } else {
            velocityY = 0; // Keine vertikale Bewegung wenn keine Taste gedrückt
        }
    } else {
        // Normaler Sprung-Modus
        if (keys.space && isGrounded) {
            velocityY = JUMP_FORCE;
            isGrounded = false;
        }
        
        // Schwerkraft anwenden (nur wenn nicht im Fly Mode)
        velocityY += GRAVITY * deltaTime;
    }
    
    // Neue Position berechnen
    const newX = camera.position.x + direction.x;
    const newY = camera.position.y + velocityY * deltaTime;
    const newZ = camera.position.z + direction.z;
    
    // Arena-Grenzen prüfen (Begrenzungsmauern bei ±95)
    const clampedX = Math.max(-94, Math.min(94, newX));
    const clampedZ = Math.max(-94, Math.min(94, newZ));
    
    // 3D-Kollisionsprüfung für die neue Position
    const collision = checkCollisionWithObstacles(clampedX, newY, clampedZ);
    
    if (!collision) {
        // Keine Kollision - freie Bewegung
        camera.position.x = clampedX;
        camera.position.z = clampedZ;
        
        if (flyEnabled && isAdminUser()) {
            // Fly Mode - keine Boden-Kollision, freie Y-Bewegung
            camera.position.y = newY;
            isGrounded = false; // Im Fly Mode nie grounded
        } else {
            // Normale Y-Position mit Boden-Kollision
            const groundHeight = getGroundHeightAt(clampedX, clampedZ, newY);
            
            if (newY <= groundHeight && velocityY <= 0) {
                // Auf Boden oder Objekt landen
                camera.position.y = groundHeight;
                velocityY = 0;
                isGrounded = true;
            } else {
                // Freier Fall/Sprung
                camera.position.y = newY;
                isGrounded = false;
            }
        }
    } else {
        // Kollision erkannt - Gleiten an Wänden ermöglichen
        
        // Versuche nur X-Bewegung (Z bleibt)
        const collisionX = checkCollisionWithObstacles(clampedX, camera.position.y, camera.position.z);
        if (!collisionX) {
            camera.position.x = clampedX;
        }
        
        // Versuche nur Z-Bewegung (X bleibt)
        const collisionZ = checkCollisionWithObstacles(camera.position.x, camera.position.y, clampedZ);
        if (!collisionZ) {
            camera.position.z = clampedZ;
        }
        
        if (flyEnabled && isAdminUser()) {
            // Fly Mode - freie Y-Bewegung auch bei horizontalen Kollisionen
            camera.position.y = newY;
            isGrounded = false;
        } else {
            // Y-Position auch bei Kollision aktualisieren (für Sprung/Fall)
            const groundHeight = getGroundHeightAt(camera.position.x, camera.position.z, newY);
            
            if (newY <= groundHeight && velocityY <= 0) {
                camera.position.y = groundHeight;
                velocityY = 0;
                isGrounded = true;
            } else {
                // Prüfe ob Y-Bewegung zu Kollision führt
                const collisionY = checkCollisionWithObstacles(camera.position.x, newY, camera.position.z);
                if (!collisionY) {
                    camera.position.y = newY;
                    isGrounded = false;
                } else {
                    // Y-Kollision - stoppe vertikale Bewegung
                    velocityY = 0;
                    // Prüfe ob wir auf einem Objekt gelandet sind
                    const currentGroundHeight = getGroundHeightAt(camera.position.x, camera.position.z, camera.position.y);
                    if (Math.abs(camera.position.y - currentGroundHeight) < 0.1) {
                        isGrounded = true;
                    }
                }
            }
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
            if (otherPlayer && bullet.userData.playerId !== playerId) {
                
                // KORREKTE Hitbox-Erkennung basierend auf tatsächlicher Position
                // playerGroup.position ist bereits bei (playerData.y - 1) wegen Boden-Offset
                const playerCenter = otherPlayer.position.clone();
                // Körper-Zentrum ist bei playerGroup.position + 0 (Körper startet bei Group-Position)
                playerCenter.y += 0; // Körper-Zentrum
                
                // Kopf-Position: playerGroup.position + 1.2 (wie in addOtherPlayer definiert)
                const headCenter = otherPlayer.position.clone();
                headCenter.y += 1.2; // Kopf ist 1.2 Einheiten über playerGroup
                
                const distanceToPlayer = bullet.position.distanceTo(playerCenter);
                const distanceToHead = bullet.position.distanceTo(headCenter);
                
                // Hit-Radien
                const bodyHit = distanceToPlayer < 1.0;
                const headHit = distanceToHead < 0.5;
                
                // Debug-Logs nur bei Hits
                if (bodyHit || headHit) {
                    console.log('🎯 Hit erkannt!');
                    console.log('Bullet Position:', bullet.position.x.toFixed(2), bullet.position.y.toFixed(2), bullet.position.z.toFixed(2));
                    console.log('Player Group Pos:', otherPlayer.position.x.toFixed(2), otherPlayer.position.y.toFixed(2), otherPlayer.position.z.toFixed(2));
                    console.log('Calculated Body Center:', playerCenter.x.toFixed(2), playerCenter.y.toFixed(2), playerCenter.z.toFixed(2));
                    console.log('Calculated Head Center:', headCenter.x.toFixed(2), headCenter.y.toFixed(2), headCenter.z.toFixed(2));
                    console.log('Distance to Body:', distanceToPlayer.toFixed(2));
                    console.log('Distance to Head:', distanceToHead.toFixed(2));
                    console.log('Body Hit:', bodyHit, '| Head Hit:', headHit);
                }
                
                if (bodyHit || headHit) {
                    // Headshot hat Priorität vor Body-Hit
                    const isHeadshot = headHit;
                
                // Nur wenn es MEIN Bullet ist, Hit an Server senden
                if (bullet.userData.playerId === socket.id) {
                        console.log('📤 Sende Hit an Server:', { isHeadshot, targetId: playerId });
                    socket.emit('playerHit', {
                        targetId: playerId,
                            damage: bullet.userData.damage,
                            weaponType: currentWeapon === WEAPONS.RIFLE ? 'rifle' : currentWeapon === WEAPONS.SHOTGUN ? 'shotgun' : 'sniper',
                            isHeadshot: isHeadshot,
                            hitPosition: {
                                x: bullet.position.x,
                                y: bullet.position.y,
                                z: bullet.position.z
                            }
                    });
                }
                
                // Bullet entfernen
                scene.remove(bullet);
                bullets.splice(i, 1);
                hitDetected = true;
                }
            }
        });
        
        if (hitDetected) continue;
        
        // Präzise Bullet-Kollision mit Hindernissen (exakte Geometrie)
        for (const obstacle of mapObstacles) {
            const obstacleLeft = obstacle.x - obstacle.width / 2;
            const obstacleRight = obstacle.x + obstacle.width / 2;
            const obstacleBack = obstacle.z - obstacle.depth / 2;
            const obstacleForward = obstacle.z + obstacle.depth / 2;
            const obstacleBottom = obstacle.y - obstacle.height / 2;
            const obstacleTop = obstacle.y + obstacle.height / 2;
            
            // Bullet-Position prüfen
            if (bullet.position.x >= obstacleLeft && bullet.position.x <= obstacleRight &&
                bullet.position.y >= obstacleBottom && bullet.position.y <= obstacleTop &&
                bullet.position.z >= obstacleBack && bullet.position.z <= obstacleForward) {
                
                // Exakte Kollision - Bullet entfernen
                scene.remove(bullet);
                bullets.splice(i, 1);
                hitDetected = true;
                break; // Nur eine Kollision pro Bullet
            }
        }
        
        if (hitDetected) continue;
        
        // Bullet entfernen wenn außerhalb der urbanen Arena
        if (Math.abs(bullet.position.x) > 95 || Math.abs(bullet.position.z) > 95 || 
            bullet.position.y < 0 || bullet.position.y > 60) {
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
        // PNG-Icons für verschiedene Waffen verwenden
        if (currentWeapon === WEAPONS.RIFLE) {
            weaponIcon.innerHTML = '<img src="/textures/icons/rifle.png" alt="Rifle">';
        } else if (currentWeapon === WEAPONS.SHOTGUN) {
            weaponIcon.innerHTML = '<img src="/textures/icons/shotgun.png" alt="Shotgun">';
        } else if (currentWeapon === WEAPONS.SNIPER) {
            weaponIcon.innerHTML = '<img src="/textures/icons/sniper.png" alt="Sniper">';
        }
        // Farbe wird über CSS-Filter gesteuert (weiß)
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
        // Low-HP-Overlay aktivieren
        if (lowHpOverlay) {
            lowHpOverlay.style.display = 'block';
            lowHpOverlay.classList.add('low-hp-active');
        }
    } else {
        healthBar.classList.remove('low');
        // Low-HP-Overlay deaktivieren
        if (lowHpOverlay) {
            lowHpOverlay.style.display = 'none';
            lowHpOverlay.classList.remove('low-hp-active');
        }
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
        // Zeige Kill-Icon bei Kills
        showKillIcon();
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

function showKillIcon() {
    if (!killIcon) return;
    
    // Entferne vorherige Animation
    killIcon.classList.remove('kill-icon-show');
    
    // Zeige Kill-Icon mit Animation
    killIcon.classList.add('kill-icon-show');
    
    // Nach Animation wieder verstecken
    setTimeout(() => {
        killIcon.classList.remove('kill-icon-show');
        killIcon.style.display = 'none';
    }, 1200);
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
    
    // Bestimme welcher Sound abgespielt werden soll - bei Kills IMMER Kill-Sound, egal welche Waffe
    let soundName = 'hit';
    if (isKill) {
        soundName = 'kill';
        console.log('🎯 Spiele Kill-Sound ab bei Kill!');
    } else if (isHeadshot) {
        soundName = 'headshot';
        console.log('💥 Spiele Headshot-Sound ab bei Headshot!');
    } else {
        console.log('🎯 Spiele Hit-Sound ab bei normalen Hit!');
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
    
    // Spiele Waffen-Sound ab (eigene Waffe - volle Lautstärke)
    playSound(soundName);
}

// 3D-Audio für Gegner-Schüsse
function playEnemyWeaponSound(bulletData) {
    if (!audioContext || !camera) return;
    
    // Bestimme Waffen-Sound basierend auf Waffentyp
    let soundName = 'rifle'; // Standard
    
    switch (bulletData.weaponType) {
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
    
    // Berechne Entfernung zur Schussposition
    const shooterPosition = new THREE.Vector3(bulletData.x, bulletData.y, bulletData.z);
    const playerPosition = camera.position;
    const distance = playerPosition.distanceTo(shooterPosition);
    
    // 3D-Audio mit entfernungsbasierter Lautstärke
    play3DWeaponSound(soundName, shooterPosition, distance);
}

// 3D-Audio-Engine für entfernungsbasierte Waffen-Sounds
function play3DWeaponSound(soundName, sourcePosition, distance) {
    if (!audioContext) return;
    
    try {
        const soundData = audioBuffers[soundName];
        
        if (!soundData) {
            console.log(`❌ Sound nicht verfügbar: ${soundName}`);
            return;
        }
        
        // Entfernungsbasierte Lautstärke berechnen
        const maxDistance = 100; // Maximale Hörweite
        const minDistance = 5;   // Minimale Entfernung für volle Lautstärke
        
        let volumeMultiplier = 1.0;
        if (distance > minDistance) {
            // Lineare Abnahme der Lautstärke mit Entfernung
            volumeMultiplier = Math.max(0, 1 - (distance - minDistance) / (maxDistance - minDistance));
        }
        
        // Mindest-Lautstärke für nahegelegene Feinde
        volumeMultiplier = Math.max(0.1, volumeMultiplier);
        
        if (soundData.synthetic) {
            // Spiele synthetischen 3D-Sound ab
            play3DSyntheticSound(soundName, sourcePosition, volumeMultiplier);
        } else {
            // Spiele echten 3D-Audio-Buffer ab
            play3DAudioBuffer(soundData.buffer, sourcePosition, volumeMultiplier * soundData.volume);
        }
        
        // Debug-Log nur bei sehr nahen Schüssen
        if (distance < 20) {
            console.log(`🔊 3D-Sound: ${soundName} von ${distance.toFixed(1)}m (${(volumeMultiplier * 100).toFixed(0)}%)`);
        }
        
    } catch (error) {
        console.log('Fehler beim Abspielen des 3D-Sounds:', error);
    }
}

// 3D-Audio-Buffer mit räumlicher Positionierung
function play3DAudioBuffer(audioBuffer, sourcePosition, volume = 1.0) {
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    const pannerNode = audioContext.createPanner();
    
    // Audio-Graph: source -> panner -> gain -> destination
    source.buffer = audioBuffer;
    source.connect(pannerNode);
    pannerNode.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // 3D-Positionierung konfigurieren
    pannerNode.panningModel = 'HRTF';
    pannerNode.distanceModel = 'linear';
    pannerNode.refDistance = 1;
    pannerNode.maxDistance = 100;
    pannerNode.rolloffFactor = 1;
    
    // Position des Schützen setzen
    pannerNode.positionX.setValueAtTime(sourcePosition.x, audioContext.currentTime);
    pannerNode.positionY.setValueAtTime(sourcePosition.y, audioContext.currentTime);
    pannerNode.positionZ.setValueAtTime(sourcePosition.z, audioContext.currentTime);
    
    // Spieler-Position als Listener setzen
    audioContext.listener.positionX.setValueAtTime(camera.position.x, audioContext.currentTime);
    audioContext.listener.positionY.setValueAtTime(camera.position.y, audioContext.currentTime);
    audioContext.listener.positionZ.setValueAtTime(camera.position.z, audioContext.currentTime);
    
    // Spieler-Orientierung setzen (Blickrichtung)
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(camera.quaternion);
    audioContext.listener.forwardX.setValueAtTime(cameraDirection.x, audioContext.currentTime);
    audioContext.listener.forwardY.setValueAtTime(cameraDirection.y, audioContext.currentTime);
    audioContext.listener.forwardZ.setValueAtTime(cameraDirection.z, audioContext.currentTime);
    
    // Up-Vector setzen
    const upVector = new THREE.Vector3(0, 1, 0);
    upVector.applyQuaternion(camera.quaternion);
    audioContext.listener.upX.setValueAtTime(upVector.x, audioContext.currentTime);
    audioContext.listener.upY.setValueAtTime(upVector.y, audioContext.currentTime);
    audioContext.listener.upZ.setValueAtTime(upVector.z, audioContext.currentTime);
    
    // Lautstärke setzen
    gainNode.gain.setValueAtTime(volume * AUDIO_VOLUME, audioContext.currentTime);
    
    source.start(0);
}

// 3D-Synthetischer Sound für Fallback
function play3DSyntheticSound(soundName, sourcePosition, volumeMultiplier = 1.0) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const pannerNode = audioContext.createPanner();
    
    // Audio-Graph: oscillator -> panner -> gain -> destination
    oscillator.connect(pannerNode);
    pannerNode.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // 3D-Positionierung konfigurieren
    pannerNode.panningModel = 'HRTF';
    pannerNode.distanceModel = 'linear';
    pannerNode.refDistance = 1;
    pannerNode.maxDistance = 100;
    pannerNode.rolloffFactor = 1;
    
    // Position des Schützen setzen
    pannerNode.positionX.setValueAtTime(sourcePosition.x, audioContext.currentTime);
    pannerNode.positionY.setValueAtTime(sourcePosition.y, audioContext.currentTime);
    pannerNode.positionZ.setValueAtTime(sourcePosition.z, audioContext.currentTime);
    
    // Spieler-Position als Listener setzen
    audioContext.listener.positionX.setValueAtTime(camera.position.x, audioContext.currentTime);
    audioContext.listener.positionY.setValueAtTime(camera.position.y, audioContext.currentTime);
    audioContext.listener.positionZ.setValueAtTime(camera.position.z, audioContext.currentTime);
    
    // Sound-Parameter je nach Waffentyp (wie in playSyntheticSound)
    switch (soundName) {
        case 'rifle':
            // Gewehr: Mittlere Frequenz, schnell
            oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(150, audioContext.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.4 * AUDIO_VOLUME * volumeMultiplier, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            oscillator.type = 'sawtooth';
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
            break;
            
        case 'shotgun':
            // Shotgun: Tiefer, länger, rauh
            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(80, audioContext.currentTime + 0.4);
            gainNode.gain.setValueAtTime(0.5 * AUDIO_VOLUME * volumeMultiplier, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
            oscillator.type = 'sawtooth';
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.4);
            break;
            
        case 'sniper':
            // Sniper: Sehr tief, lang, kraftvoll
            oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.6);
            gainNode.gain.setValueAtTime(0.6 * AUDIO_VOLUME * volumeMultiplier, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
            oscillator.type = 'sawtooth';
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.6);
            break;
    }
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
            // Kill-Sound: Tieferer, längerer und dramatischerer Sound für alle Waffen-Kills
            oscillator.frequency.setValueAtTime(500, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(150, audioContext.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.4 * AUDIO_VOLUME, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.type = 'sawtooth';
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
            console.log('🔊 Synthetischer Kill-Sound abgespielt');
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

// Fallback für Kill-Icon
if (killIconImage) {
    killIconImage.addEventListener('error', () => {
        console.log('Kill-Icon konnte nicht geladen werden, verwende Fallback');
        killIconImage.style.display = 'none';
        
        // Erstelle Fallback-Kill-Icon
        killIcon.innerHTML = `
            <div class="fallback-kill-icon">💀</div>
        `;
    });
}

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
    console.log('💡 Kill-Test: testKillSound(), testAllHitSounds()');
};

// Debug-Funktion um Kill-Sound zu testen
window.testKillSound = function() {
    console.log('🎯 Teste Kill-Sound...');
    playHitSound(true, false); // isKill = true, isHeadshot = false
};

// Debug-Funktion um alle Hit-Typen zu testen
window.testAllHitSounds = function() {
    console.log('🎯 Teste alle Hit-Sounds...');
    
    setTimeout(() => {
        console.log('1. Normal Hit:');
        playHitSound(false, false);
    }, 0);
    
    setTimeout(() => {
        console.log('2. Kill Hit:');
        playHitSound(true, false);
    }, 1000);
    
    setTimeout(() => {
        console.log('3. Headshot Hit:');
        playHitSound(false, true);
    }, 2000);
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

window.testKillIcon = function() {
    console.log('💀 Teste Kill-Icon');
    showKillIcon();
};

window.testLowHP = function() {
    console.log('🩸 Teste Low-HP-Effekt');
    updateHealth(25);
};

window.testNormalHP = function() {
    console.log('💚 Teste Normal-HP');
    updateHealth(100);
};

function animate() {
    if (!gameStarted) return;
    
    requestAnimationFrame(animate);
    
    updatePlayer();
    updateBullets();
    updateCooldownUI(); // Cooldown-Balken aktualisieren
    update3DAudioListener(); // 3D-Audio-Position aktualisieren
    
    // NameTags zur Kamera drehen
    Object.values(players).forEach(playerGroup => {
        if (playerGroup.userData && playerGroup.userData.nameTag) {
            playerGroup.userData.nameTag.lookAt(camera.position);
        }
    });
    
    renderer.render(scene, camera);
}

// 3D-Audio-Listener kontinuierlich aktualisieren
function update3DAudioListener() {
    if (!audioContext || !camera) return;
    
    try {
        // Spieler-Position als Listener setzen
        audioContext.listener.positionX.setValueAtTime(camera.position.x, audioContext.currentTime);
        audioContext.listener.positionY.setValueAtTime(camera.position.y, audioContext.currentTime);
        audioContext.listener.positionZ.setValueAtTime(camera.position.z, audioContext.currentTime);
        
        // Spieler-Orientierung setzen (Blickrichtung)
        const cameraDirection = new THREE.Vector3(0, 0, -1);
        cameraDirection.applyQuaternion(camera.quaternion);
        audioContext.listener.forwardX.setValueAtTime(cameraDirection.x, audioContext.currentTime);
        audioContext.listener.forwardY.setValueAtTime(cameraDirection.y, audioContext.currentTime);
        audioContext.listener.forwardZ.setValueAtTime(cameraDirection.z, audioContext.currentTime);
        
        // Up-Vector setzen
        const upVector = new THREE.Vector3(0, 1, 0);
        upVector.applyQuaternion(camera.quaternion);
        audioContext.listener.upX.setValueAtTime(upVector.x, audioContext.currentTime);
        audioContext.listener.upY.setValueAtTime(upVector.y, audioContext.currentTime);
        audioContext.listener.upZ.setValueAtTime(upVector.z, audioContext.currentTime);
    } catch (error) {
        // Ignoriere Fehler bei Audio-Listener-Updates
    }
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
        case 'ControlLeft':
        case 'ControlRight':
            keys.ctrl = true;
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
        case 'KeyI':
            if (gameStarted) {
                toggleAdminMenu();
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
        case 'ControlLeft':
        case 'ControlRight':
            keys.ctrl = false;
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
        if (event.button === 0) { // Linke Maustaste - Schießen
            event.preventDefault();
            isMousePressed = true;
            
            // Sofortiger erster Schuss
            shootInstant();
            
            // Rapid Fire starten falls aktiviert
            if (rapidfireEnabled && isAdminUser()) {
                startRapidFire();
            }
        } else if (event.button === 2) { // Rechte Maustaste - Zoom start
            event.preventDefault();
            startZoom();
        }
    }
}

function onMouseUp(event) {
    if (gameStarted && isPointerLocked) {
        if (event.button === 0) { // Linke Maustaste - Schießen stop
            event.preventDefault();
            isMousePressed = false;
            stopRapidFire();
        } else if (event.button === 2) { // Rechte Maustaste - Zoom stop
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
loadAvailableHeadTextures();

console.log('🎯 Hardcoded Shotgun bereit - Menu und Spiel Modelle werden geladen!'); 
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Statische Dateien servieren
app.use(express.static(path.join(__dirname, 'public')));

// API-Endpoint für verfügbare Kopf-Texturen
app.get('/api/head-textures', (req, res) => {
    try {
        const headsDir = path.join(__dirname, 'public', 'textures', 'heads');
        
        // Überprüfen ob Verzeichnis existiert
        if (!fs.existsSync(headsDir)) {
            return res.json(['head1.png']); // Fallback
        }
        
        // Alle PNG-Dateien im heads Verzeichnis lesen
        const files = fs.readdirSync(headsDir);
        const pngFiles = files.filter(file => 
            file.toLowerCase().endsWith('.png') && 
            file !== '.' && 
            file !== '..'
        );
        
        // Mindestens head1.png zurückgeben
        const textures = pngFiles.length > 0 ? pngFiles : ['head1.png'];
        
        console.log('📸 Verfügbare Kopf-Texturen:', textures);
        res.json(textures);
    } catch (error) {
        console.error('❌ Fehler beim Laden der Kopf-Texturen:', error);
        res.json(['head1.png']); // Fallback
    }
});

// Spieler-Daten
const players = {};
const bullets = [];

// Dynamische Map-Konfiguration
let currentMapConfig = {
    name: 'urban_city',
    type: 'urban',
    size: 'large',
    difficulty: 'medium'
};

// Map-Hindernisse (server-seitig generiert, für alle gleich)
const mapObstacles = [];

// Low-Poly-Dorf Map Generator
const mapGenerators = {
    lowpoly_village: generateLowPolyVillageMap
};

// Low-Poly-Dorf Map Generierung
function generateMap(mapType = 'tower_arena') {
    console.log(`🗺️ Generiere Turm-Arena: ${mapType}`);
    
    // Map-Hindernisse zurücksetzen
    mapObstacles.length = 0;
    
    // Turm-Arena verwenden
    currentMapConfig.name = 'tower_arena';
    currentMapConfig.type = 'arena';
    currentMapConfig.size = 'medium';
    currentMapConfig.difficulty = 'medium';
    generateLowPolyVillageMap();
    
    console.log(`✅ Turm-Arena '${mapType}' mit ${mapObstacles.length} Strukturen generiert`);
    
    // Map-Konfiguration für Clients vorbereiten
    const mapData = {
        obstacles: mapObstacles,
        config: currentMapConfig,
        bounds: calculateMapBounds()
    };
    
    return mapData;
}

// Map-Grenzen automatisch berechnen
function calculateMapBounds() {
    if (mapObstacles.length === 0) {
        return { minX: -50, maxX: 50, minZ: -50, maxZ: 50, minY: 0, maxY: 50 };
    }
    
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (const obstacle of mapObstacles) {
        const left = obstacle.x - obstacle.width / 2;
        const right = obstacle.x + obstacle.width / 2;
        const back = obstacle.z - obstacle.depth / 2;
        const forward = obstacle.z + obstacle.depth / 2;
        const bottom = obstacle.y - obstacle.height / 2;
        const top = obstacle.y + obstacle.height / 2;
        
        minX = Math.min(minX, left);
        maxX = Math.max(maxX, right);
        minZ = Math.min(minZ, back);
        maxZ = Math.max(maxZ, forward);
        minY = Math.min(minY, bottom);
        maxY = Math.max(maxY, top);
    }
    
    // Kleine Pufferzone hinzufügen
    const buffer = 5;
    return {
        minX: minX - buffer, maxX: maxX + buffer,
        minZ: minZ - buffer, maxZ: maxZ + buffer,
        minY: Math.max(0, minY), maxY: maxY + buffer
    };
}

// Präzise 3D-Bullet-Kollision: What you see is what you get!
function checkBulletCollisionWithObstacles(bulletX, bulletY, bulletZ) {
    for (const obstacle of mapObstacles) {
        // Exakte AABB-Kollision - jedes Objekt stoppt Bullets an seiner exakten Geometrie
        const obstacleLeft = obstacle.x - obstacle.width / 2;
        const obstacleRight = obstacle.x + obstacle.width / 2;
        const obstacleBack = obstacle.z - obstacle.depth / 2;
        const obstacleForward = obstacle.z + obstacle.depth / 2;
        const obstacleBottom = obstacle.y - obstacle.height / 2;
        const obstacleTop = obstacle.y + obstacle.height / 2;
        
        // Bullet-Position gegen exakte Objektgrenzen prüfen
        if (bulletX >= obstacleLeft && bulletX <= obstacleRight &&
            bulletY >= obstacleBottom && bulletY <= obstacleTop &&
            bulletZ >= obstacleBack && bulletZ <= obstacleForward) {
            return obstacle; // Exakte Kollision gefunden
        }
    }
    return null; // Keine Kollision
}

// 🗺️ Simple Tower Arena Generator
function generateLowPolyVillageMap() {
    console.log('🏗️ Generiere 4x größere Turm-Arena mit 12 massiven Türmen und Mauer...');
    
    const obstacles = [];
    
    // ===== 12 MASSIVE TÜRME (4x größer) =====
    // Alle Positionen und Größen mit Faktor 4 multipliziert
    const towers = [
        // Zentral und nah am Spawn (4x größer und weiter entfernt)
        { x: 0, z: 32, width: 16, height: 24, depth: 16, color: 0x808080 },      // Nord vom Zentrum
        { x: 32, z: 0, width: 12, height: 20, depth: 12, color: 0x696969 },      // Ost vom Zentrum
        { x: 0, z: -32, width: 20, height: 28, depth: 16, color: 0x778899 },     // Süd vom Zentrum
        { x: -32, z: 0, width: 16, height: 16, depth: 16, color: 0x8B4513 },     // West vom Zentrum
        
        // Äußerer Ring (4x größer)
        { x: 48, z: 48, width: 12, height: 32, depth: 12, color: 0xD2B48C },    // Nord-Ost
        { x: -48, z: 48, width: 16, height: 20, depth: 16, color: 0xDAA520 },   // Nord-West
        { x: 48, z: -48, width: 20, height: 24, depth: 12, color: 0xDC143C },   // Süd-Ost
        { x: -48, z: -48, width: 12, height: 28, depth: 20, color: 0x228B22 },  // Süd-West
        
        // Randpositionen für weitere Deckung (4x größer)
        { x: 72, z: 20, width: 16, height: 16, depth: 16, color: 0xB22222 },     // Ost-Rand
        { x: -72, z: -20, width: 12, height: 24, depth: 12, color: 0xC0C0C0 },   // West-Rand
        { x: 20, z: 64, width: 16, height: 20, depth: 12, color: 0xFF0000 },     // Nord-Rand
        { x: -20, z: -64, width: 20, height: 32, depth: 16, color: 0xFFFFFF }    // Süd-Rand
    ];
    
    // Türme erstellen
    towers.forEach((tower, index) => {
        obstacles.push({
            x: tower.x, 
            y: tower.height / 2, // Mittig auf dem Boden positionieren
            z: tower.z,
            width: tower.width, 
            height: tower.height, 
            depth: tower.depth,
            type: `tower_${index + 1}`,
            color: tower.color
        });
    });
    
    // ===== ARENA-MAUER RUNDHERUM =====
    console.log('🧱 Füge Arena-Mauer hinzu...');
    
    const wallHeight = 12;
    const wallThickness = 4;
    const arenaWidth = 160;  // Passend zur 4x größeren Bodenplatte
    const arenaDepth = 120;
    
    // Nord-Mauer
    obstacles.push({
        x: 0,
        y: wallHeight / 2,
        z: arenaDepth / 2,
        width: arenaWidth,
        height: wallHeight,
        depth: wallThickness,
        type: 'wall_north',
        color: 0x555555
    });
    
    // Süd-Mauer
    obstacles.push({
        x: 0,
        y: wallHeight / 2,
        z: -arenaDepth / 2,
        width: arenaWidth,
        height: wallHeight,
        depth: wallThickness,
        type: 'wall_south',
        color: 0x555555
    });
    
    // Ost-Mauer
    obstacles.push({
        x: arenaWidth / 2,
        y: wallHeight / 2,
        z: 0,
        width: wallThickness,
        height: wallHeight,
        depth: arenaDepth,
        type: 'wall_east',
        color: 0x555555
    });
    
    // West-Mauer
    obstacles.push({
        x: -arenaWidth / 2,
        y: wallHeight / 2,
        z: 0,
        width: wallThickness,
        height: wallHeight,
        depth: arenaDepth,
        type: 'wall_west',
        color: 0x555555
    });
    
    mapObstacles.push(...obstacles);
    
    console.log('🏗️ 4x größere Turm-Arena Features:');
    console.log('  ✓ 12 massive Türme (4x größer) in verschiedenen Größen');
    console.log('  ✓ Strategisch über die 4x größere Map verteilt');
    console.log('  ✓ Höhere Türme für spektakuläre Deckung');
    console.log('  ✓ Bunte Türme für bessere Orientierung');
    console.log('  ✓ Komplette Arena-Mauer rundherum');
    console.log(`  ✓ ${mapObstacles.length} Strukturen total`);
}

// ALTE MAP-GENERATOREN (werden nicht mehr verwendet)
function generateUrbanCityMap() {
    console.log('Generiere urbane Stadt-Arena...');
    
    const obstacles = [];
    
    // ===== STRASSENNETZ (Basis-Layout) =====
    // Hauptstraße Ost-West (durch die Mitte)
    // Keine physischen Objekte - nur für Orientierung und Platzierung
    
    // Hauptstraße Nord-Süd (durch die Mitte) 
    // Kreuzung bei (0,0) - zentral
    
    // ===== WOLKENKRATZER-DISTRIKT (Zentrum) =====
    
    // Hauptwolkenkratzer - Zentral-Tower
    obstacles.push(
        { x: 0, y: 25, z: 0, width: 20, height: 50, depth: 20 }  // 50m hoher Wolkenkratzer
    );
    
    // Umgebende Hochhäuser (symmetrisch um Zentrum)
    obstacles.push(
        { x: 35, y: 20, z: 35, width: 15, height: 40, depth: 15 },   // Nord-Ost Hochhaus
        { x: -35, y: 20, z: 35, width: 15, height: 40, depth: 15 },  // Nord-West Hochhaus
        { x: 35, y: 20, z: -35, width: 15, height: 40, depth: 15 },  // Süd-Ost Hochhaus
        { x: -35, y: 20, z: -35, width: 15, height: 40, depth: 15 }, // Süd-West Hochhaus
        
        // Mittlere Bürogebäude
        { x: 50, y: 15, z: 0, width: 12, height: 30, depth: 18 },    // Ost
        { x: -50, y: 15, z: 0, width: 12, height: 30, depth: 18 },   // West
        { x: 0, y: 15, z: 50, width: 18, height: 30, depth: 12 },    // Nord
        { x: 0, y: 15, z: -50, width: 18, height: 30, depth: 12 }    // Süd
    );
    
    // ===== WOHNVIERTEL (Äußere Bereiche) =====
    
    // Nord-Ost Wohnblock
    obstacles.push(
        { x: 65, y: 4, z: 65, width: 8, height: 8, depth: 12 },      // Haus 1
        { x: 75, y: 4, z: 65, width: 8, height: 8, depth: 12 },      // Haus 2
        { x: 65, y: 4, z: 78, width: 8, height: 8, depth: 12 },      // Haus 3
        { x: 75, y: 4, z: 78, width: 8, height: 8, depth: 12 },      // Haus 4
        
        // Kleine Garagen/Schuppen
        { x: 60, y: 2, z: 60, width: 4, height: 4, depth: 6 },
        { x: 80, y: 2, z: 60, width: 4, height: 4, depth: 6 }
    );
    
    // Nord-West Wohnblock (spiegelverkehrt)
    obstacles.push(
        { x: -65, y: 4, z: 65, width: 8, height: 8, depth: 12 },
        { x: -75, y: 4, z: 65, width: 8, height: 8, depth: 12 },
        { x: -65, y: 4, z: 78, width: 8, height: 8, depth: 12 },
        { x: -75, y: 4, z: 78, width: 8, height: 8, depth: 12 },
        
        { x: -60, y: 2, z: 60, width: 4, height: 4, depth: 6 },
        { x: -80, y: 2, z: 60, width: 4, height: 4, depth: 6 }
    );
    
    // Süd-Ost Wohnblock
    obstacles.push(
        { x: 65, y: 4, z: -65, width: 8, height: 8, depth: 12 },
        { x: 75, y: 4, z: -65, width: 8, height: 8, depth: 12 },
        { x: 65, y: 4, z: -78, width: 8, height: 8, depth: 12 },
        { x: 75, y: 4, z: -78, width: 8, height: 8, depth: 12 },
        
        { x: 60, y: 2, z: -60, width: 4, height: 4, depth: 6 },
        { x: 80, y: 2, z: -60, width: 4, height: 4, depth: 6 }
    );
    
    // Süd-West Wohnblock
    obstacles.push(
        { x: -65, y: 4, z: -65, width: 8, height: 8, depth: 12 },
        { x: -75, y: 4, z: -65, width: 8, height: 8, depth: 12 },
        { x: -65, y: 4, z: -78, width: 8, height: 8, depth: 12 },
        { x: -75, y: 4, z: -78, width: 8, height: 8, depth: 12 },
        
        { x: -60, y: 2, z: -60, width: 4, height: 4, depth: 6 },
        { x: -80, y: 2, z: -60, width: 4, height: 4, depth: 6 }
    );
    
    // ===== INDUSTRIEGEBIET (Zwischen Wohn- und Geschäftsviertel) =====
    
    // Lagerhallen
    obstacles.push(
        { x: 25, y: 6, z: 70, width: 20, height: 12, depth: 15 },    // Nord Lagerhalle
        { x: -25, y: 6, z: 70, width: 20, height: 12, depth: 15 },   // Nord Lagerhalle 2
        { x: 25, y: 6, z: -70, width: 20, height: 12, depth: 15 },   // Süd Lagerhalle
        { x: -25, y: 6, z: -70, width: 20, height: 12, depth: 15 },  // Süd Lagerhalle 2
        
        { x: 70, y: 6, z: 25, width: 15, height: 12, depth: 20 },    // Ost Lagerhalle
        { x: 70, y: 6, z: -25, width: 15, height: 12, depth: 20 },   // Ost Lagerhalle 2
        { x: -70, y: 6, z: 25, width: 15, height: 12, depth: 20 },   // West Lagerhalle
        { x: -70, y: 6, z: -25, width: 15, height: 12, depth: 20 }   // West Lagerhalle 2
    );
    
    // ===== STADTMÖBLIERUNG =====
    
    // Straßenlaternen (entlang Hauptstraßen)
    obstacles.push(
        // Ost-West Straße Laternen
        { x: 15, y: 3, z: 5, width: 0.5, height: 6, depth: 0.5 },
        { x: 30, y: 3, z: 5, width: 0.5, height: 6, depth: 0.5 },
        { x: 45, y: 3, z: 5, width: 0.5, height: 6, depth: 0.5 },
        { x: -15, y: 3, z: 5, width: 0.5, height: 6, depth: 0.5 },
        { x: -30, y: 3, z: 5, width: 0.5, height: 6, depth: 0.5 },
        { x: -45, y: 3, z: 5, width: 0.5, height: 6, depth: 0.5 },
        
        { x: 15, y: 3, z: -5, width: 0.5, height: 6, depth: 0.5 },
        { x: 30, y: 3, z: -5, width: 0.5, height: 6, depth: 0.5 },
        { x: 45, y: 3, z: -5, width: 0.5, height: 6, depth: 0.5 },
        { x: -15, y: 3, z: -5, width: 0.5, height: 6, depth: 0.5 },
        { x: -30, y: 3, z: -5, width: 0.5, height: 6, depth: 0.5 },
        { x: -45, y: 3, z: -5, width: 0.5, height: 6, depth: 0.5 },
        
        // Nord-Süd Straße Laternen
        { x: 5, y: 3, z: 15, width: 0.5, height: 6, depth: 0.5 },
        { x: 5, y: 3, z: 30, width: 0.5, height: 6, depth: 0.5 },
        { x: 5, y: 3, z: 45, width: 0.5, height: 6, depth: 0.5 },
        { x: 5, y: 3, z: -15, width: 0.5, height: 6, depth: 0.5 },
        { x: 5, y: 3, z: -30, width: 0.5, height: 6, depth: 0.5 },
        { x: 5, y: 3, z: -45, width: 0.5, height: 6, depth: 0.5 },
        
        { x: -5, y: 3, z: 15, width: 0.5, height: 6, depth: 0.5 },
        { x: -5, y: 3, z: 30, width: 0.5, height: 6, depth: 0.5 },
        { x: -5, y: 3, z: 45, width: 0.5, height: 6, depth: 0.5 },
        { x: -5, y: 3, z: -15, width: 0.5, height: 6, depth: 0.5 },
        { x: -5, y: 3, z: -30, width: 0.5, height: 6, depth: 0.5 },
        { x: -5, y: 3, z: -45, width: 0.5, height: 6, depth: 0.5 }
    );
    
    // Zäune um Wohngebiete
    obstacles.push(
        // Nord-Ost Wohngebiet Zaun
        { x: 85, y: 1, z: 65, width: 1, height: 2, depth: 25 },      // Ost-Seite
        { x: 85, y: 1, z: 78, width: 1, height: 2, depth: 25 },      // Ost-Seite verlängert
        { x: 70, y: 1, z: 90, width: 30, height: 2, depth: 1 },      // Nord-Seite
        
        // Nord-West Wohngebiet Zaun  
        { x: -85, y: 1, z: 65, width: 1, height: 2, depth: 25 },
        { x: -85, y: 1, z: 78, width: 1, height: 2, depth: 25 },
        { x: -70, y: 1, z: 90, width: 30, height: 2, depth: 1 },
        
        // Süd-Ost Wohngebiet Zaun
        { x: 85, y: 1, z: -65, width: 1, height: 2, depth: 25 },
        { x: 85, y: 1, z: -78, width: 1, height: 2, depth: 25 },
        { x: 70, y: 1, z: -90, width: 30, height: 2, depth: 1 },
        
        // Süd-West Wohngebiet Zaun
        { x: -85, y: 1, z: -65, width: 1, height: 2, depth: 25 },
        { x: -85, y: 1, z: -78, width: 1, height: 2, depth: 25 },
        { x: -70, y: 1, z: -90, width: 30, height: 2, depth: 1 }
    );
    
    // ===== ARENA-BEGRENZUNG =====
    // Unsichtbare Mauern an den Rändern (weit außerhalb)
    obstacles.push(
        { x: 0, y: 5, z: 95, width: 200, height: 10, depth: 2 },      // Nord-Mauer
        { x: 0, y: 5, z: -95, width: 200, height: 10, depth: 2 },     // Süd-Mauer  
        { x: 95, y: 5, z: 0, width: 2, height: 10, depth: 200 },      // Ost-Mauer
        { x: -95, y: 5, z: 0, width: 2, height: 10, depth: 200 }      // West-Mauer
    );
    
    mapObstacles.push(...obstacles);
    console.log(`🏙️ Urbane Stadt-Arena mit ${mapObstacles.length} Strukturen generiert`);
    console.log('🏢 Arena Features:');
    console.log('  ✓ Zentraler Wolkenkratzer-Distrikt');
    console.log('  ✓ 4 Wohnviertel mit Häusern und Garagen');
    console.log('  ✓ Industriegebiet mit Lagerhallen');
    console.log('  ✓ Straßenbeleuchtung entlang Hauptstraßen');
    console.log('  ✓ Zäune um Wohngebiete');
    console.log('  ✓ Realistische Stadtstruktur ohne Clipping');
    console.log('  ✓ Verschiedene Kampfebenen: Straßen, Gebäude, Dächer');
}

// Zusätzliche Map-Generatoren
function generateSmallArenaMap() {
    console.log('Generiere kleine Arena...');
    currentMapConfig.type = 'arena';
    currentMapConfig.size = 'small';
    
    const obstacles = [];
    
    // Zentrale Plattform
    obstacles.push(
        { x: 0, y: 2, z: 0, width: 10, height: 4, depth: 10 }
    );
    
    // Vier Eckturme
    obstacles.push(
        { x: 20, y: 5, z: 20, width: 4, height: 10, depth: 4 },
        { x: -20, y: 5, z: 20, width: 4, height: 10, depth: 4 },
        { x: 20, y: 5, z: -20, width: 4, height: 10, depth: 4 },
        { x: -20, y: 5, z: -20, width: 4, height: 10, depth: 4 }
    );
    
    // Arena-Wände
    obstacles.push(
        { x: 0, y: 5, z: 30, width: 60, height: 10, depth: 2 },   // Nord
        { x: 0, y: 5, z: -30, width: 60, height: 10, depth: 2 },  // Süd
        { x: 30, y: 5, z: 0, width: 2, height: 10, depth: 60 },   // Ost
        { x: -30, y: 5, z: 0, width: 2, height: 10, depth: 60 }   // West
    );
    
    mapObstacles.push(...obstacles);
    console.log(`🏟️ Kleine Arena mit ${mapObstacles.length} Strukturen generiert`);
}

function generateForestValleyMap() {
    console.log('Generiere Waldtal...');
    currentMapConfig.type = 'nature';
    currentMapConfig.size = 'medium';
    
    const obstacles = [];
    
    // Große Bäume (Zylindrisch simuliert als Kästen)
    for (let i = 0; i < 15; i++) {
        const x = (Math.random() - 0.5) * 80;
        const z = (Math.random() - 0.5) * 80;
        const height = 12 + Math.random() * 8;
        
        obstacles.push({
            x: x, y: height/2, z: z,
            width: 2 + Math.random() * 2,
            height: height,
            depth: 2 + Math.random() * 2
        });
    }
    
    // Felsen
    for (let i = 0; i < 10; i++) {
        const x = (Math.random() - 0.5) * 60;
        const z = (Math.random() - 0.5) * 60;
        
        obstacles.push({
            x: x, y: 2, z: z,
            width: 3 + Math.random() * 4,
            height: 2 + Math.random() * 6,
            depth: 3 + Math.random() * 4
        });
    }
    
    // Hügel (als Rampen simuliert)
    obstacles.push(
        { x: 25, y: 3, z: 25, width: 15, height: 6, depth: 15 },
        { x: -25, y: 3, z: -25, width: 15, height: 6, depth: 15 }
    );
    
    mapObstacles.push(...obstacles);
    console.log(`🌲 Waldtal mit ${mapObstacles.length} Strukturen generiert`);
}

function generateIndustrialComplexMap() {
    console.log('Generiere Industriekomplex...');
    currentMapConfig.type = 'industrial';
    currentMapConfig.size = 'large';
    
    const obstacles = [];
    
    // Große Fabriken
    obstacles.push(
        { x: 0, y: 8, z: 0, width: 30, height: 16, depth: 20 },      // Hauptfabrik
        { x: 40, y: 6, z: 30, width: 20, height: 12, depth: 25 },    // Seitenfabrik 1
        { x: -40, y: 6, z: -30, width: 20, height: 12, depth: 25 }   // Seitenfabrik 2
    );
    
    // Schornsteine
    obstacles.push(
        { x: 15, y: 15, z: 10, width: 3, height: 30, depth: 3 },
        { x: -15, y: 15, z: -10, width: 3, height: 30, depth: 3 },
        { x: 45, y: 12, z: 25, width: 2, height: 24, depth: 2 }
    );
    
    // Lager und Container
    for (let i = 0; i < 12; i++) {
        const x = (Math.random() - 0.5) * 70 + (i % 4 - 2) * 20;
        const z = (Math.random() - 0.5) * 70 + Math.floor(i / 4) * 25;
        
        obstacles.push({
            x: x, y: 2, z: z,
            width: 4 + Math.random() * 3,
            height: 3 + Math.random() * 2,
            depth: 8 + Math.random() * 4
        });
    }
    
    mapObstacles.push(...obstacles);
    console.log(`🏭 Industriekomplex mit ${mapObstacles.length} Strukturen generiert`);
}

// Map bei Server-Start generieren - Low-Poly-Dorf
const selectedMap = process.env.MAP_TYPE || 'lowpoly_village'; // Umgebungsvariable oder Standard
generateMap(selectedMap);
console.log(`🎮 Server bereit mit Low-Poly-Dorf: ${selectedMap}`);

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
        x: Math.random() * 30 - 15, // Zufällige Position im Low-Poly-Dorf
        y: 1.8, // Augenhöhe
        z: Math.random() * 20 - 10,
        rotationY: 0,
        health: 100,
        alive: true,
        username: 'Spieler', // Standard-Username
        color: '#ff0000', // Standard-Farbe (rot)
        headTexture: 'head1.png' // Standard-Kopf-Textur
    };

    // Aktuellen Spielerstatus und Map an neuen Spieler senden
    socket.emit('currentPlayers', players);
    console.log('Sende Map-Daten an neuen Spieler:', socket.id, 'Anzahl Hindernisse:', mapObstacles.length);
    socket.emit('mapData', generateMap());
    
    // Neuen Spieler NICHT sofort senden - warten auf setPlayerData
    // Das newPlayer Event wird erst nach setPlayerData gesendet

    // Spieler-Daten setzen (Username und Farbe)
    let playerDataSent = false;
    socket.on('setPlayerData', (data) => {
        if (players[socket.id]) {
            let changes = {};
            
            // Username aktualisieren
            if (data.username && data.username.trim().length > 0) {
                const cleanUsername = data.username.trim().substring(0, 15); // Max 15 Zeichen
                players[socket.id].username = cleanUsername;
                changes.username = cleanUsername;
                console.log(`Spieler ${socket.id} hat Username gesetzt: ${cleanUsername}`);
            }
            
            // Farbe aktualisieren
            if (data.color && /^#[0-9A-F]{6}$/i.test(data.color)) {
                players[socket.id].color = data.color;
                changes.color = data.color;
                console.log(`Spieler ${socket.id} hat Farbe gesetzt: ${data.color}`);
            }
            
            // Kopf-Textur aktualisieren
            if (data.headTexture && typeof data.headTexture === 'string') {
                // Einfache Validierung: muss .png enden und keine gefährlichen Zeichen enthalten
                const cleanTexture = data.headTexture.replace(/[^a-zA-Z0-9._-]/g, '');
                if (cleanTexture.endsWith('.png') && cleanTexture.length > 4 && cleanTexture.length < 50) {
                    players[socket.id].headTexture = cleanTexture;
                    changes.headTexture = cleanTexture;
                    console.log(`Spieler ${socket.id} hat Kopf-Textur gesetzt: ${cleanTexture}`);
                }
            }
            
            // Alle Clients über Änderungen informieren
            if (Object.keys(changes).length > 0) {
                io.emit('playerDataChanged', {
                    playerId: socket.id,
                    ...changes
                });
            }
            
            // Beim ersten setPlayerData den Spieler an andere Clients senden
            if (!playerDataSent) {
                playerDataSent = true;
    socket.broadcast.emit('newPlayer', players[socket.id]);
                console.log('Neuer Spieler mit Daten gesendet:', players[socket.id]);
            }
        }
    });

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
            damage: bulletData.damage || 15,
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
            
            // Präzise Kollision mit allen Hindernissen prüfen
            const hitObstacle = checkBulletCollisionWithObstacles(currentBullet.x, currentBullet.y, currentBullet.z);
            if (hitObstacle) {
                // Bullet trifft Hindernis - entfernen
                    const index = bullets.findIndex(b => b.id === bullet.id);
                    if (index > -1) {
                        bullets.splice(index, 1);
                        io.emit('bulletDestroyed', bullet.id);
                        clearInterval(checkBulletCollision);
                    console.log(`Bullet trifft Hindernis: ${hitObstacle.width}x${hitObstacle.height}x${hitObstacle.depth} bei (${hitObstacle.x}, ${hitObstacle.y}, ${hitObstacle.z})`);
                        return;
                }
            }
            
            // Arena-Grenzen prüfen (Low-Poly-Dorf 40x30m, höchster Turm 11m)
            if (Math.abs(currentBullet.x) > 22 || Math.abs(currentBullet.z) > 20 || 
                currentBullet.y < 0 || currentBullet.y > 15) {
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
            // Server-seitige Headshot-Validierung mit exakten Hitbox-Dimensionen
            let isHeadshot = false;
            console.log('🔍 Server Hit-Daten:', {
                targetId: data.targetId,
                clientHeadshot: data.isHeadshot,
                hitPosition: data.hitPosition,
                targetPosition: { x: targetPlayer.x, y: targetPlayer.y, z: targetPlayer.z }
            });
            
            if (data.isHeadshot && data.hitPosition) {
                // Server speichert ursprüngliche playerData.y, Kopf ist +1.2 von playerGroup
                // playerGroup Position = playerData.y - 1, Kopf = playerGroup + 1.2
                // Also: Kopf Y = (playerData.y - 1) + 1.2 = playerData.y + 0.2
                const headCenterX = targetPlayer.x;
                const headCenterY = targetPlayer.y + 0.2; // playerData.y + 0.2 für korrekte Kopf-Position
                const headCenterZ = targetPlayer.z;
                
                const hitX = data.hitPosition.x;
                const hitY = data.hitPosition.y;
                const hitZ = data.hitPosition.z;
                
                console.log('🎯 Headshot-Validierung:', {
                    headCenter: { x: headCenterX, y: headCenterY, z: headCenterZ },
                    hitPosition: { x: hitX, y: hitY, z: hitZ }
                });
                
                // Vereinfachte Distance-basierte Validierung
                const headDistance = Math.sqrt(
                    (hitX - headCenterX) ** 2 +
                    (hitY - headCenterY) ** 2 +
                    (hitZ - headCenterZ) ** 2
                );
                
                console.log('📏 Head Distance:', headDistance.toFixed(2));
                
                const validHeadshot = headDistance <= 0.5;
                
                console.log('✅ Headshot Valid:', validHeadshot);
                
                if (validHeadshot) {
                    isHeadshot = true;
                }
            }
            
            // Schaden berechnen (1.5x für Headshots)
            let finalDamage = data.damage;
            if (isHeadshot) {
                finalDamage = Math.round(data.damage * 1.5);
            }
            
            console.log(`Spieler ${socket.id} trifft ${data.targetId} für ${finalDamage} Schaden${isHeadshot ? ' (HEADSHOT!)' : ''}`);
            
            targetPlayer.health -= finalDamage;
            
            let isKill = false;
            if (targetPlayer.health <= 0) {
                targetPlayer.alive = false;
                targetPlayer.health = 0;
                isKill = true;
                io.emit('playerDied', data.targetId);
                
                // Respawn nach 5 Sekunden
                setTimeout(() => {
                    if (players[data.targetId]) {
                        players[data.targetId].health = 100;
                        players[data.targetId].alive = true;
                        players[data.targetId].x = Math.random() * 30 - 15;
                        players[data.targetId].z = Math.random() * 20 - 10;
                        io.emit('playerRespawned', players[data.targetId]);
                    }
                }, 5000);
            }
            
            // Hitmarker an Schützen senden
            socket.emit('hitConfirmed', {
                isKill: isKill,
                damage: finalDamage,
                targetId: data.targetId,
                weaponType: data.weaponType || 'rifle',
                isHeadshot: isHeadshot
            });
            
            // Kill-Information an alle Clients senden (für globalen Killfeed)
            if (isKill) {
                io.emit('playerKilled', {
                    killerId: socket.id,
                    killerUsername: shooterPlayer.username,
                    victimId: data.targetId,
                    victimUsername: targetPlayer.username,
                    weaponType: data.weaponType || 'rifle',
                    isHeadshot: isHeadshot
                });
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
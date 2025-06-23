# WebFPS - Multiplayer Shooter

Ein simples FPS (First-Person Shooter) Multiplayer-Spiel mit Three.js, HTML, CSS und JavaScript.

## Features

- **3D Arena**: Einfache Arena mit Wänden und Hindernissen
- **First-Person Shooter**: FPS-Kamera mit Maussteuerung
- **Waffen-System**: Gewehr mit Schießmechanik
- **Multiplayer**: Echtzeit-Multiplayer über Socket.io
- **Gesundheitssystem**: Leben, Schaden und Respawn
- **Kollisionserkennung**: Treffer-Detection zwischen Spielern

## Installation

1. **Dependencies installieren:**
   ```bash
   npm install
   ```

2. **Server starten:**
   ```bash
   npm start
   ```

3. **Spiel öffnen:**
   - Öffne `http://localhost:3000` in zwei Browser-Fenstern
   - Klicke in beiden Fenstern auf "Spiel starten"
   - Teste das Multiplayer-Gameplay

## Steuerung

- **WASD** - Bewegung
- **Maus** - Umschauen
- **Linke Maustaste** - Schießen
- **ESC** - Pointer Lock verlassen

## Gameplay

- Spawne zufällig in der Arena
- Bewege dich und schieße auf andere Spieler
- Jeder Treffer verursacht 25 Schaden
- Bei 0 Leben stirbst du und respawnst nach 5 Sekunden
- Versuche zu überleben und andere Spieler zu eliminieren

## Technische Details

### Server (Node.js + Socket.io)
- Express.js für statische Dateien
- Socket.io für Echtzeit-Kommunikation
- Spieler-Management und Kollisionserkennung
- Bullet-Tracking und Hit-Detection

### Client (Three.js)
- 3D-Rendering mit Three.js
- First-Person Kamera mit Pointer Lock
- WASD-Bewegung mit Kollisionserkennung
- Multiplayer-Synchronisation
- UI mit Gesundheitsanzeige

### Arena
- 100x100 Einheiten große Arena
- 10 Einheiten hohe Wände
- Zufällige Hindernisse als Cover
- Schatten und Beleuchtung

## Entwicklung

Für Entwicklung mit Auto-Reload:
```bash
npm run dev
```

## Anpassungen

Du kannst folgende Parameter in `public/game.js` anpassen:
- `PLAYER_SPEED` - Bewegungsgeschwindigkeit
- `BULLET_DAMAGE` - Schaden pro Treffer
- `MOUSE_SENSITIVITY` - Mausempfindlichkeit
- Arena-Größe in `createArena()`

## Bekannte Limitationen

- Kein persistenter Spielerstand
- Einfache Kollisionserkennung
- Keine Waffen-Vielfalt
- Grundlegendes Anti-Cheat

## Erweiterungsideen

- Verschiedene Waffen
- Power-Ups
- Größere/komplexere Maps
- Teams und Modi
- Sounds und Partikeleffekte
- Scoreboard 
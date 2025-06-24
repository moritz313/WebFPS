# WebFPS - Multiplayer First Person Shooter

Ein einfaches aber unterhaltsames Multiplayer-FPS-Spiel, das mit Three.js, Node.js und Socket.io entwickelt wurde.

## 🎮 Features

- **3D-Arena**: Vollständig begehbare 3D-Umgebung mit Texturen
- **Waffensystem**: Gewehr, Schrotflinte und Scharfschützengewehr mit unterschiedlichen Eigenschaften
- **Echtzeit-Multiplayer**: Bis zu 32 Spieler gleichzeitig
- **Gesundheitssystem**: 100 HP mit automatischem Respawn
- **Kollisionserkennung**: Realistische Physik und Hindernisse
- **Zielsystem**: Fadenkreuz mit Zoom-Funktion für Scharfschützengewehr
- **Coole Effekte**: Skybox, Texturen und 3D-Modelle

## 🚀 Lokale Installation

```bash
# Repository klonen
git clone https://github.com/username/WebFPS.git
cd WebFPS

# Dependencies installieren
npm install

# Server starten
npm start
```

Das Spiel läuft dann auf `http://localhost:3000`

## 🌐 Online-Deployment mit Railway

### Schritt 1: Railway-Account erstellen
1. Gehe zu [railway.app](https://railway.app)
2. Registriere dich mit GitHub
3. Verbinde dein GitHub-Repository

### Schritt 2: Projekt deployen
1. Klicke auf "Deploy from GitHub repo"
2. Wähle dein WebFPS-Repository aus
3. Railway erkennt automatisch, dass es ein Node.js-Projekt ist
4. Das Deployment startet automatisch

### Schritt 3: Domain erhalten
- Nach dem Deployment erhältst du eine URL wie: `https://webfps-production.up.railway.app`
- Diese URL kannst du mit deinen Freunden teilen

### Schritt 4: Custom Domain (optional)
- Gehe zu Settings > Domains
- Füge eine eigene Domain hinzu oder nutze die Railway-Subdomain

## 🎯 Steuerung

- **WASD**: Bewegung
- **Maus**: Umschauen
- **Leertaste**: Springen
- **Linke Maustaste**: Schießen
- **Rechte Maustaste**: Zoom (nur Scharfschützengewehr)
- **1**: Gewehr
- **2**: Schrotflinte  
- **3**: Scharfschützengewehr

## 🛠 Technologie-Stack

- **Frontend**: Three.js, HTML5, CSS3, JavaScript
- **Backend**: Node.js, Express.js
- **Multiplayer**: Socket.io
- **Hosting**: Railway (Production), localhost (Development)

## 📝 Development

```bash
# Development-Modus mit Auto-Reload
npm run dev
```

## 🤝 Beitragen

1. Fork das Repository
2. Erstelle einen Feature-Branch
3. Committe deine Änderungen
4. Push zum Branch
5. Erstelle eine Pull Request

## 📄 Lizenz

MIT License - siehe [LICENSE](LICENSE) Datei für Details.

## 🎮 Viel Spaß beim Spielen!

Teile die Railway-URL mit deinen Freunden und startet epische Multiplayer-Kämpfe! 
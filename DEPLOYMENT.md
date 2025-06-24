# 🚀 WebFPS Railway-Deployment Anleitung

Diese Anleitung führt dich Schritt für Schritt durch das Deployment deines WebFPS-Spiels auf Railway.

## Vor dem Deployment

### 1. Repository auf GitHub pushen
```bash
# Falls noch nicht gemacht, initialisiere git
git init
git add .
git commit -m "Initial commit - WebFPS ready for Railway deployment"

# Repository zu GitHub pushen
git remote add origin https://github.com/DEIN-USERNAME/WebFPS.git
git branch -M main
git push -u origin main
```

### 2. Dateien überprüfen
Stelle sicher, dass diese Dateien in deinem Repository sind:
- ✅ `package.json` (mit engines-Spezifikation)
- ✅ `railway.json` (Railway-Konfiguration)
- ✅ `.gitignore` (Git-Ignorierung)
- ✅ `server.js` (mit PORT-Environment-Variable)

## Railway-Deployment

### Schritt 1: Railway-Account erstellen
1. Gehe zu [railway.app](https://railway.app)
2. Klicke auf "Login" → "Login with GitHub"
3. Autorisiere Railway für dein GitHub-Konto

### Schritt 2: Neues Projekt erstellen
1. Klicke auf "New Project"
2. Wähle "Deploy from GitHub repo"
3. Suche und wähle dein WebFPS-Repository
4. Klicke auf "Deploy Now"

### Schritt 3: Deployment überwachen
1. Railway erkennt automatisch Node.js
2. Das Build-Log zeigt den Fortschritt
3. Nach 2-3 Minuten ist dein Spiel online

### Schritt 4: Domain erhalten
1. Gehe zu deinem Projekt-Dashboard
2. Klicke auf "Settings" → "Domains"
3. Klicke auf "Generate Domain"
4. Du erhältst eine URL wie: `https://webfps-production-xxxx.up.railway.app`

## Nach dem Deployment

### 🎮 Spiel testen
1. Öffne die Railway-URL in deinem Browser
2. Teste alle Funktionen:
   - Bewegung (WASD)
   - Springen (Leertaste)
   - Waffen wechseln (1, 2, 3)
   - Schießen (Linke Maustaste)
   - Zoom (Rechte Maustaste)

### 👥 Mit Freunden spielen
1. Teile die Railway-URL mit deinen Freunden
2. Alle können gleichzeitig spielen
3. Keine Port-Weiterleitung nötig!

## Problembehebung

### Build-Fehler
```bash
# Falls Build fehlschlägt, überprüfe package.json
{
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

### Server startet nicht
- Überprüfe, ob `process.env.PORT` in server.js verwendet wird
- Stelle sicher, dass start-Script in package.json korrekt ist

### Verbindungsprobleme
- Railway verwendet HTTPS, stelle sicher dass Socket.io korrekt konfiguriert ist
- Überprüfe Browser-Konsole auf CORS-Fehler

## Kosten & Limits

### Railway Free Tier
- ✅ 500 Stunden pro Monat
- ✅ 1GB RAM
- ✅ 1GB Festplatte
- ✅ Ausreichend für kleinere Multiplayer-Sessions

### Pro Tier ($5/Monat)
- ✅ Unbegrenzte Stunden
- ✅ 8GB RAM
- ✅ 100GB Festplatte
- ✅ Custom Domains

## Automatische Updates

### GitHub-Integration
1. Jeder Push zu `main` löst automatisches Re-Deployment aus
2. Zero-Downtime-Deployments
3. Rollback möglich bei Problemen

## Custom Domain (optional)

### Eigene Domain hinzufügen
1. Gehe zu "Settings" → "Domains"
2. Klicke auf "Custom Domain"
3. Gib deine Domain ein (z.B. `myfps.com`)
4. Konfiguriere DNS bei deinem Domain-Provider:
   ```
   Type: CNAME
   Name: @ (oder www)
   Value: [Railway-provided-URL]
   ```

## Monitoring

### Logs anzeigen
1. Gehe zu "Deployments"
2. Klicke auf aktuelles Deployment
3. "View Logs" zeigt Server-Output

### Performance überwachen
- Railway zeigt CPU- und RAM-Nutzung
- Response-Zeiten werden getrackt
- Uptime-Monitoring inklusive

## Support

Bei Problemen:
1. 📖 [Railway-Dokumentation](https://docs.railway.app)
2. 💬 [Railway Discord](https://discord.gg/railway)
3. 📧 Railway Support-Team

---

🎉 **Herzlichen Glückwunsch!** Dein WebFPS läuft jetzt online und deine Freunde können von überall mitspielen! 
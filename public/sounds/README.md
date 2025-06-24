# WebFPS Sound-Dateien

## Benötigte Sound-Dateien

Legen Sie Ihre eigenen Sound-Dateien in diesem Ordner ab:

### 🎯 Hit Sounds
- `hit.mp3` oder `hit.wav` - Standard Treffer-Sound
- `kill.mp3` oder `kill.wav` - Kill-Bestätigungs-Sound  
- `headshot.mp3` oder `headshot.wav` - Headshot-Sound (optional)

### 🔫 Waffen-Schuss-Sounds
- `rifle.mp3` oder `rifle.wav` - Gewehr-Schuss-Sound
- `shotgun.mp3` oder `shotgun.wav` - Shotgun-Schuss-Sound
- `sniper.mp3` oder `sniper.wav` - Sniper-Schuss-Sound

### 📋 Dateiformate
- **MP3**: Bevorzugt (kleinere Dateigröße)
- **WAV**: Fallback (höhere Qualität)
- **Beide**: Das System versucht erst MP3, dann WAV

### 🔊 Empfohlene Eigenschaften

#### Hit-Sounds:
- **Dauer**: 0.1 - 0.3 Sekunden
- **Typ**: Kurze, knackige "Treffer"-Sounds

#### Waffen-Sounds:
- **Rifle**: 0.2 - 0.4 Sekunden, mittlere Frequenz
- **Shotgun**: 0.3 - 0.6 Sekunden, tiefer, kraftvoller
- **Sniper**: 0.4 - 0.8 Sekunden, sehr kraftvoll, nachhallend

#### Allgemein:
- **Format**: 44.1kHz, 16-bit
- **Lautstärke**: Normalisiert, nicht zu laut
- **Qualität**: Unkomprimiert bevorzugt

### 🚀 Automatisches Fallback
Falls Ihre Sound-Dateien nicht gefunden werden, verwendet das Spiel automatisch synthetische Backup-Sounds.

### 📝 Beispiel-Struktur
```
public/sounds/
├── hit.mp3
├── kill.mp3  
├── headshot.mp3
├── rifle.mp3
├── shotgun.mp3
├── sniper.mp3
└── README.md
```

Starten Sie das Spiel neu nach dem Hinzufügen neuer Sound-Dateien! 
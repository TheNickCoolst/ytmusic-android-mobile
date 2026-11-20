# 🎵 YouTube Music Mobile App (Android • 100% Werbefrei • Hintergrundwiedergabe)

Eine moderne, performante YouTube Music Mobile App speziell für **Android** mit **Hintergrundwiedergabe**, **Sperrbildschirm-Steuerung**, **Google/YouTube-Account-Synchronisation** und **100% werbefreiem Streaming**.

---

## ✨ Features im Überblick

- 🛡️ **100% Werbefrei:** Keine Audio- oder Videowerbung, keine Popups, keine Sponsorenunterbrechungen.
- 📱 **Hintergrundwiedergabe (Android & Mobile):** Musik läuft nahtlos weiter, wenn der Bildschirm gesperrt wird oder du zu einer anderen App wechselst.
- 🎛️ **Sperrbildschirm & Benachrichtigungs-Steuerung (Web Media Session API):**
  - Titel, Interpret, Albumcover in hoher Auflösung
  - Play, Pause, Vor, Zurück
  - Interaktive Fortschrittsleiste (Scrubbing / Spulen) direkt im Android-Sperrbildschirm
- 🔑 **Google / YouTube Account Login:**
  - Eigene YouTube Music Playlists synchronisieren
  - Eigene Lieblingslieder (Liked Songs)
  - Eigener Wiedergabeverlauf
  - Songs direkt auf YouTube mit "Gefällt mir" markieren
- 🔍 **YouTube Music Suche & Trends:**
  - Schnelle Suche nach Songs, Musikvideos, Alben und Künstlern
  - Top Hits & Charts (Deutschland / Global)
  - Stimmungen & Genres (Deutschrap, Gym/Workout, Chill, Deep Focus, Party, Rock, Schlaf)
- 📻 **Endlos-Radio (Up-Next Queue):** Automatische Fortsetzung mit passenden Songs, wenn die Wiedergabeliste endet.
- 📝 **Songtexte (Lyrics):** Synchronisierter bzw. scrollbarer Liedtext direkt im Player.
- 💾 **Offline-Modus & Speicherverwaltung:** Songs für Offline-Wiedergabe ohne Datenverbrauch herunterladen.
- ⏱️ **Schlaf-Timer:** Musik stoppt automatisch nach 15, 30, 45, 60 Minuten oder am Ende des Titels.

---

## 📲 Nutzung auf Android (2 Wege)

### Weg 1: Direkt als PWA / Web-App im Android-Browser (Empfohlen - schnell & einfach)
1. Stelle sicher, dass dein Android-Handy im selben WLAN wie dieser Rechner ist.
2. Öffne auf deinem Handy in **Chrome**, **Brave** oder **Samsung Internet**:
   ```
   http://192.168.178.183:8000
   ```
   *(Oder auf dem Computer: `http://localhost:8000`)*
3. Tippe im Browser oben rechts auf die **3 Punkte** (Menü).
4. Wähle **"App installieren"** oder **"Zum Startbildschirm hinzufügen"**.
5. Die App erscheint als eigenständige Vollbild-App auf deinem Android-Homescreen mit App-Icon und voller Hintergrundwiedergabe!

### Weg 2: Native Android APK installieren
Die fertig kompilierte native Android-App (APK) liegt direkt im Projekt:
- **Pfad:** `ytmusic-mobile.apk` (ca. 4.1 MB)
- **Direkt-Download im Browser:** `http://192.168.178.183:8000/api/download-apk` oder über den grünen **APK**-Button in der oberen Leiste der App.
- Einfach auf das Android-Handy übertragen, antippen und installieren.

---

## 🔑 Mit YouTube / Google Account anmelden

Um deine persönlichen Playlists und Lieblingslieder zu sehen:
1. Öffne die App und tippe oben rechts auf **"Anmelden"** (oder in der Mediathek auf die Anmeldekarte).
2. Öffne auf deinem PC oder Handy [music.youtube.com](https://music.youtube.com).
3. Öffne die Entwicklertools (<kbd>F12</kbd> im Browser) → Tab **Netzwerk**.
4. Kopiere unter *Request Headers* dein **Cookie** (oder die gesamten Header) und füge es in das Textfeld ein.
5. Tippe auf **"Mit Google-Konto verbinden"** – deine Playlists und Lieblingslieder erscheinen sofort in der Mediathek!

---

## 🛠️ Server starten / stoppen

- **Server starten:**
  ```bash
  ./start.sh
  ```
  oder manuell:
  ```bash
  python3 -m uvicorn backend.server:app --host 0.0.0.0 --port 8000
  ```
- **Android APK neu bauen:**
  ```bash
  cd frontend
  bun run build
  npx cap copy android
  export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  export ANDROID_HOME="/Users/nick/Library/Android/sdk"
  cd android && /opt/homebrew/bin/gradle assembleDebug --no-daemon
  ```

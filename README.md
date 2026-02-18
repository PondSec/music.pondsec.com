# music.pondsec.com

Artist-Website für **404 A.M.** mit automatischem Spotify-Sync (Releases, Cover, Tracks) – **ohne Spotify Client ID/Secret**.

## Features

- Hero + About Bereich für die Artist-Branding-Story
- Automatisches Laden von Spotify-Daten direkt aus den öffentlichen Spotify-Seiten
- Anzeige von:
  - Tracks (automatisch aus Releases)
  - Allen Albums & Singles inkl. Cover
  - Follower / Release-Anzahl
- Externe Links zu Spotify, Apple Music und Instagram

## Setup

1. Abhängigkeiten installieren:

```bash
npm install
```

2. Optional Umgebungsvariablen setzen:

```bash
# optional (Standard: 3H2WBHpu4zsSaAXdIo4gqo)
export SPOTIFY_ARTIST_ID="3H2WBHpu4zsSaAXdIo4gqo"
# optional (Standard: intl-de)
export SPOTIFY_LOCALE="intl-de"
```

3. Starten:

```bash
npm start
```

Website läuft dann auf `http://localhost:3000`.

## Hinweis zur Datenquelle

Die Seite nutzt öffentliche Spotify-Webseiten als Quelle (kein API-Client-Credentials-Flow nötig). Dadurch brauchst du keine Spotify App-Credentials, und neue Releases erscheinen weiterhin automatisch.

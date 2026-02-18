# music.pondsec.com

Artist-Website für **404 A.M.** mit automatischem Spotify-Sync (Releases, Cover, Top-Tracks).

## Features

- Hero + About Bereich für die Artist-Branding-Story
- Automatisches Laden von Spotify Artist-Daten über die Spotify Web API
- Anzeige von:
  - Top Tracks
  - Allen Albums & Singles inkl. Cover
  - Follower / Genres / Release-Anzahl
- Externe Links zu Spotify, Apple Music und Instagram

## Setup

1. Abhängigkeiten installieren:

```bash
npm install
```

2. Umgebungsvariablen setzen:

```bash
export SPOTIFY_CLIENT_ID="dein_client_id"
export SPOTIFY_CLIENT_SECRET="dein_client_secret"
# optional
export SPOTIFY_ARTIST_ID="3H2WBHpu4zsSaAXdIo4gqo"
export SPOTIFY_MARKET="DE"
```

3. Starten:

```bash
npm start
```

Website läuft dann auf `http://localhost:3000`.

## Spotify API Hinweis

Für den automatischen Sync wird der **Client Credentials Flow** genutzt. Dadurch bleiben neue Releases automatisch aktuell, ohne manuelle Pflege.

# music.pondsec.com

Moderne Artist-Website für **404 A.M.** mit Spotify-Auto-Sync, Accounts und Admin-Studio.

## Neu im Design

- Layout jetzt deutlich näher an einer echten Artist-Page (großer Hero, dunkler Editorial-Look, klare Discography-Sections)
- Hero verwendet ein echtes Foto als Haupt-Background
- kompaktere, hochwertigere Content-Cards statt überladener Grid-Optik

## Features

- Spotify Sync ohne Client-ID/Secret (öffentliche Spotify-Seiten)
- Register / Login / Logout
- Admin-Panel für manuelle Releases, Events, Announcements
- Zusammenführung von Spotify-Releases + manuell gepflegtem Content

## Setup

```bash
npm install
npm start
```

Optional:

```bash
export SPOTIFY_ARTIST_ID="3H2WBHpu4zsSaAXdIo4gqo"
export SPOTIFY_LOCALE="intl-de"
```

## Dein eigenes Hintergrundbild

Damit dein eigenes Bild im Hero genutzt wird:

1. Datei als `public/artist-background.jpg` ablegen.
2. Seite neu laden.

Wenn die Datei fehlt, wird automatisch das Spotify-Artist-Bild als Hero-Hintergrund verwendet.

## Admin Zugang (beim ersten Start)

Beim ersten Start wird `data/store.json` erstellt.

- Username: `admin`
- Passwort: `change-me-404am`

> Bitte Passwort direkt ändern, bevor du öffentlich live gehst.

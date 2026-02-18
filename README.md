# music.pondsec.com

Mehrseitige, helle und moderne Artist-Website für **404 A.M.** mit Spotify-Auto-Sync, Accounts und Admin-Studio.

## Neue Struktur (kein One-Pager mehr)

Top-Navigation führt jetzt auf **eigene Seiten**:

- `/` Home
- `/biography`
- `/discography`
- `/events`
- `/news`
- `/community` (Login/Register)
- `/admin` (Admin Studio)

## Design-Richtung

- helles, offenes, modernes UI mit klaren Kontrasten
- künstlerische Editorial-Hero-Optik
- Komponenten-Stil inspiriert von modernen UI-Pattern (u. a. ähnlich zu ReactBits-Landing/Card-Ansätzen)

## Features

- Spotify Sync ohne Client-ID/Secret (über öffentliche Spotify-Seiten)
- Register / Login / Logout
- Admin-Panel für manuelle Releases, Events, Announcements
- Mischung aus Spotify-Releases + manuell gepflegtem Content

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

## Eigenes Hero-Bild

Lege dein Bild als `public/artist-background.jpg` ab.

Wenn die Datei nicht vorhanden ist, wird automatisch das Spotify-Artist-Bild als Fallback genutzt.

## Admin Zugang (beim ersten Start)

Beim ersten Start wird `data/store.json` erstellt.

- Username: `admin`
- Passwort: `change-me-404am`

> Passwort bitte direkt ändern, bevor die Seite öffentlich live geht.

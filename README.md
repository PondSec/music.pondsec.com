# music.pondsec.com

Moderne Artist-Website für **404 A.M.** mit automatischem Spotify-Sync, Community-Accounts und Admin-Studio.

## Was jetzt drin ist

- **echtes Artist-Look & Feel** (hero, glassmorphism, große Visuals, klare Sektionen)
- **automatischer Spotify-Sync ohne Client-ID/Secret** (aus öffentlichen Spotify-Seiten)
- **User-Accounts**: Registrierung + Login
- **Admin-Bereich** zum manuellen Ergänzen von:
  - Releases
  - Events
  - Announcements
- Mix aus **Spotify-Releases + manuell gepflegtem Content**

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

## Admin Zugang (beim ersten Start)

Beim ersten Start wird automatisch eine lokale Datenbank-Datei unter `data/store.json` erstellt.

Default-Admin:

- Username: `admin`
- Passwort: `change-me-404am`

> Wichtig: Bitte direkt einloggen und Passwort in der Datei `data/store.json` ändern (oder neuen Admin-User anlegen), bevor du live gehst.

## API Endpoints

- `GET /api/public-data` – Artistdaten, Releases, Tracks, Events, Announcements
- `GET /api/me` – Session/User Status
- `POST /api/register` – Account erstellen
- `POST /api/login` – Login
- `POST /api/logout` – Logout
- `POST /api/admin/releases` – manueller Release (Admin)
- `POST /api/admin/events` – Event anlegen (Admin)
- `POST /api/admin/announcements` – Announcement posten (Admin)

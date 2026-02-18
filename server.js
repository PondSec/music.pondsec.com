const express = require('express');
const path = require('path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const app = express();
const PORT = process.env.PORT || 3000;
const ARTIST_ID = process.env.SPOTIFY_ARTIST_ID || '3H2WBHpu4zsSaAXdIo4gqo';
const LOCALE = process.env.SPOTIFY_LOCALE || 'intl-de';
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const SESSION_TTL = 1000 * 60 * 60 * 24 * 7;

const sessions = new Map();
let spotifyCache = null;
let spotifyCacheExpiresAt = 0;

app.use(express.json());

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(STORE_PATH)) {
    const defaultStore = {
      users: [
        {
          id: crypto.randomUUID(),
          username: 'admin',
          email: 'admin@404am.local',
          role: 'admin',
          password: hashPassword('change-me-404am')
        }
      ],
      customReleases: [],
      events: [],
      announcements: [
        {
          id: crypto.randomUUID(),
          title: 'Willkommen bei 404 A.M.',
          content: 'Neue Releases werden automatisch von Spotify geladen. Plus: exklusive News direkt hier.',
          createdAt: new Date().toISOString(),
          pinned: true
        }
      ]
    };

    fs.writeFileSync(STORE_PATH, JSON.stringify(defaultStore, null, 2));
  }
}

async function readStore() {
  ensureDataStore();
  const raw = await fsp.readFile(STORE_PATH, 'utf8');
  return JSON.parse(raw);
}

async function writeStore(store) {
  await fsp.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, encoded) {
  const [salt, oldHash] = String(encoded || '').split(':');
  if (!salt || !oldHash) return false;
  const currentHash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(oldHash, 'hex'), Buffer.from(currentHash, 'hex'));
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

function getSessionUser(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.session;
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  return session.user;
}

function requireAuth(req, res, next) {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Bitte einloggen.' });
  req.user = user;
  return next();
}

function requireAdmin(req, res, next) {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Bitte einloggen.' });
  if (user.role !== 'admin') return res.status(403).json({ error: 'Nur Admin hat Zugriff.' });
  req.user = user;
  return next();
}

function spotifyUriToId(uri) {
  if (!uri) return null;
  const parts = String(uri).split(':');
  return parts[parts.length - 1] || null;
}

function formatReleaseDate(date = {}) {
  if (date.year && date.month && date.day) return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
  if (date.year && date.month) return `${date.year}-${String(date.month).padStart(2, '0')}`;
  if (date.year) return String(date.year);
  return null;
}

async function fetchSpotifyInitialState(relativePath) {
  const url = `https://open.spotify.com/${LOCALE}${relativePath}`;
  const { stdout: html } = await execFileAsync('curl', ['-sL', url], { maxBuffer: 25 * 1024 * 1024 });
  if (!html || !html.trim()) throw new Error(`Spotify page returned empty response for ${relativePath}`);

  const match = html.match(/<script id="initialState" type="text\/plain">([^<]+)<\/script>/);
  if (!match?.[1]) throw new Error(`Spotify initial state not found for ${relativePath}`);

  return JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
}

function extractArtistEntity(state) {
  return state?.entities?.items?.[`spotify:artist:${ARTIST_ID}`] || null;
}

function extractReleases(artistEntity) {
  const sections = ['albums', 'singles', 'compilations'];
  const byId = new Map();

  sections.forEach((section) => {
    const groups = artistEntity?.discography?.[section]?.items || [];
    groups.forEach((group) => {
      (group?.releases?.items || []).forEach((release) => {
        const releaseId = spotifyUriToId(release.uri);
        if (!releaseId || byId.has(releaseId)) return;

        byId.set(releaseId, {
          id: releaseId,
          source: 'spotify',
          name: release.name,
          type: release.type?.toLowerCase() || section.slice(0, -1),
          releaseDate: formatReleaseDate(release.date),
          totalTracks: null,
          spotifyUrl: `https://open.spotify.com/album/${releaseId}`,
          image: release.coverArt?.sources?.[0]?.url || null
        });
      });
    });
  });

  return [...byId.values()].sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0));
}

function normalizeTrack(track, album) {
  const trackId = track?.id || spotifyUriToId(track?.uri);
  if (!trackId) return null;

  return {
    id: trackId,
    name: track.name,
    durationMs: track.duration?.totalMilliseconds || null,
    explicit: track.contentRating?.label === 'EXPLICIT',
    spotifyUrl: `https://open.spotify.com/track/${trackId}`,
    previewUrl: track.previews?.audioPreviews?.items?.[0]?.url || null,
    albumName: album.name
  };
}

async function fetchAlbumTracks(album) {
  const state = await fetchSpotifyInitialState(`/album/${album.id}`);
  const albumEntity = state?.entities?.items?.[`spotify:album:${album.id}`];
  const trackItems = albumEntity?.tracksV2?.items || [];

  const tracks = trackItems.map((item) => normalizeTrack(item?.track, album)).filter(Boolean);

  return {
    totalTracks: albumEntity?.tracksV2?.totalCount || tracks.length || 0,
    tracks
  };
}

async function fetchSpotifyData() {
  if (spotifyCache && Date.now() < spotifyCacheExpiresAt) return spotifyCache;

  const artistState = await fetchSpotifyInitialState(`/artist/${ARTIST_ID}`);
  const artistEntity = extractArtistEntity(artistState);
  if (!artistEntity) throw new Error('Artist data could not be extracted from Spotify page.');

  const albums = extractReleases(artistEntity);
  const albumDetails = await Promise.all(albums.map((album) => fetchAlbumTracks(album)));

  const allTracks = albumDetails
    .flatMap((detail) => detail.tracks)
    .filter((track, index, arr) => arr.findIndex((entry) => entry.id === track.id) === index)
    .slice(0, 12);

  const albumsWithCounts = albums.map((album, index) => ({
    ...album,
    totalTracks: albumDetails[index]?.totalTracks || 0
  }));

  spotifyCache = {
    artist: {
      id: ARTIST_ID,
      name: artistEntity?.profile?.name || '404 A.M.',
      followers: artistEntity?.stats?.followers || 0,
      image: artistEntity?.visuals?.avatarImage?.sources?.[2]?.url || artistEntity?.visuals?.avatarImage?.sources?.[0]?.url || null,
      spotifyUrl: `https://open.spotify.com/artist/${ARTIST_ID}`,
      bio: artistEntity?.profile?.biography?.text || 'LoFi Producer aus der Nacht.'
    },
    topTracks: allTracks,
    albums: albumsWithCounts,
    fetchedAt: new Date().toISOString()
  };

  spotifyCacheExpiresAt = Date.now() + 10 * 60 * 1000;
  return spotifyCache;
}

app.get('/api/public-data', async (req, res) => {
  try {
    const [spotifyData, store] = await Promise.all([fetchSpotifyData(), readStore()]);
    const manualReleases = [...store.customReleases].sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0));
    const events = [...store.events].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    const announcements = [...store.announcements].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    res.json({
      ...spotifyData,
      releases: [...manualReleases, ...spotifyData.albums],
      events,
      announcements
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Daten konnten nicht geladen werden.', details: error.message });
  }
});

app.get('/api/me', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.json({ authenticated: false });
  return res.json({ authenticated: true, user });
});

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Bitte username, email und Passwort (mind. 8 Zeichen) angeben.' });
  }

  const store = await readStore();
  const exists = store.users.some((user) => user.username.toLowerCase() === String(username).toLowerCase() || user.email.toLowerCase() === String(email).toLowerCase());
  if (exists) return res.status(409).json({ error: 'Nutzername oder E-Mail existiert bereits.' });

  const newUser = {
    id: crypto.randomUUID(),
    username: String(username).trim(),
    email: String(email).trim().toLowerCase(),
    role: 'fan',
    password: hashPassword(password)
  };

  store.users.push(newUser);
  await writeStore(store);

  return res.status(201).json({ ok: true });
});

app.post('/api/login', async (req, res) => {
  const { login, password } = req.body || {};
  if (!login || !password) return res.status(400).json({ error: 'Login und Passwort fehlen.' });

  const store = await readStore();
  const user = store.users.find(
    (entry) => entry.username.toLowerCase() === String(login).toLowerCase() || entry.email.toLowerCase() === String(login).toLowerCase()
  );

  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Ungültige Zugangsdaten.' });
  }

  const safeUser = { id: user.id, username: user.username, email: user.email, role: user.role };
  const token = crypto.randomUUID();
  sessions.set(token, { user: safeUser, expiresAt: Date.now() + SESSION_TTL });
  setSessionCookie(res, token);

  return res.json({ ok: true, user: safeUser });
});

app.post('/api/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  if (cookies.session) sessions.delete(cookies.session);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.post('/api/admin/releases', requireAdmin, async (req, res) => {
  const { name, releaseDate, type, spotifyUrl, image, totalTracks } = req.body || {};
  if (!name || !releaseDate) return res.status(400).json({ error: 'name und releaseDate sind Pflicht.' });

  const store = await readStore();
  store.customReleases.push({
    id: crypto.randomUUID(),
    source: 'manual',
    name,
    releaseDate,
    type: type || 'single',
    spotifyUrl: spotifyUrl || null,
    image: image || null,
    totalTracks: Number(totalTracks) || 0
  });
  await writeStore(store);

  res.status(201).json({ ok: true });
});

app.post('/api/admin/events', requireAdmin, async (req, res) => {
  const { title, date, location, description, ticketUrl } = req.body || {};
  if (!title || !date) return res.status(400).json({ error: 'title und date sind Pflicht.' });

  const store = await readStore();
  store.events.push({ id: crypto.randomUUID(), title, date, location: location || '', description: description || '', ticketUrl: ticketUrl || '' });
  await writeStore(store);

  res.status(201).json({ ok: true });
});

app.post('/api/admin/announcements', requireAdmin, async (req, res) => {
  const { title, content, pinned } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'title und content sind Pflicht.' });

  const store = await readStore();
  store.announcements.push({
    id: crypto.randomUUID(),
    title,
    content,
    pinned: Boolean(pinned),
    createdAt: new Date().toISOString()
  });
  await writeStore(store);

  res.status(201).json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
  ensureDataStore();
  console.log(`404 A.M. website listening on http://localhost:${PORT}`);
});

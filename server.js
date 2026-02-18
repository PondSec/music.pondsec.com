const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ARTIST_ID = process.env.SPOTIFY_ARTIST_ID || '3H2WBHpu4zsSaAXdIo4gqo';
const MARKET = process.env.SPOTIFY_MARKET || 'DE';

let spotifyToken = null;
let spotifyTokenExpiresAt = 0;

let artistCache = null;
let artistCacheExpiresAt = 0;

async function getSpotifyToken() {
  if (spotifyToken && Date.now() < spotifyTokenExpiresAt) return spotifyToken;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials are missing. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Could not authenticate with Spotify (${response.status}): ${body}`);
  }

  const data = await response.json();
  spotifyToken = data.access_token;
  spotifyTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

  return spotifyToken;
}

async function spotifyRequest(endpoint) {
  const token = await getSpotifyToken();

  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Spotify API error (${response.status}) for ${endpoint}: ${body}`);
  }

  return response.json();
}

async function fetchAllAlbums() {
  const albums = [];
  let next = `/artists/${ARTIST_ID}/albums?include_groups=album,single&market=${MARKET}&limit=50`;

  while (next) {
    const page = await spotifyRequest(next.replace('https://api.spotify.com/v1', ''));
    albums.push(...page.items);
    next = page.next;
  }

  const uniqueById = new Map();
  albums.forEach((album) => {
    if (!uniqueById.has(album.id)) uniqueById.set(album.id, album);
  });

  return [...uniqueById.values()].sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
}

function normalizeAlbum(album) {
  return {
    id: album.id,
    name: album.name,
    type: album.album_type,
    releaseDate: album.release_date,
    totalTracks: album.total_tracks,
    spotifyUrl: album.external_urls?.spotify,
    image: album.images?.[0]?.url || null
  };
}

function normalizeTrack(track) {
  return {
    id: track.id,
    name: track.name,
    durationMs: track.duration_ms,
    explicit: track.explicit,
    spotifyUrl: track.external_urls?.spotify,
    previewUrl: track.preview_url,
    albumName: track.album?.name || null
  };
}

app.get('/api/artist-data', async (req, res) => {
  try {
    if (artistCache && Date.now() < artistCacheExpiresAt) {
      return res.json(artistCache);
    }

    const [artist, topTracks, albums] = await Promise.all([
      spotifyRequest(`/artists/${ARTIST_ID}`),
      spotifyRequest(`/artists/${ARTIST_ID}/top-tracks?market=${MARKET}`),
      fetchAllAlbums()
    ]);

    const payload = {
      artist: {
        id: artist.id,
        name: artist.name,
        followers: artist.followers?.total || 0,
        monthlyListenersNote: 'Spotify API does not provide monthly listeners directly.',
        genres: artist.genres || [],
        image: artist.images?.[0]?.url || null,
        spotifyUrl: artist.external_urls?.spotify
      },
      topTracks: (topTracks.tracks || []).map(normalizeTrack),
      albums: albums.map(normalizeAlbum),
      fetchedAt: new Date().toISOString()
    };

    artistCache = payload;
    artistCacheExpiresAt = Date.now() + 10 * 60 * 1000;

    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Spotify data could not be loaded.',
      details: error.message
    });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
  console.log(`404 A.M. website listening on http://localhost:${PORT}`);
});

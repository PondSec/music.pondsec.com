const express = require('express');
const path = require('path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const app = express();
const PORT = process.env.PORT || 3000;
const ARTIST_ID = process.env.SPOTIFY_ARTIST_ID || '3H2WBHpu4zsSaAXdIo4gqo';
const LOCALE = process.env.SPOTIFY_LOCALE || 'intl-de';

let artistCache = null;
let artistCacheExpiresAt = 0;

function spotifyUriToId(uri) {
  if (!uri) return null;
  const parts = String(uri).split(':');
  return parts[parts.length - 1] || null;
}

function formatReleaseDate(date = {}) {
  if (date.year && date.month && date.day) {
    return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
  }
  if (date.year && date.month) {
    return `${date.year}-${String(date.month).padStart(2, '0')}`;
  }
  if (date.year) return String(date.year);
  return null;
}

async function fetchSpotifyInitialState(relativePath) {
  const url = `https://open.spotify.com/${LOCALE}${relativePath}`;
  const { stdout: html } = await execFileAsync('curl', ['-sL', url], {
    maxBuffer: 20 * 1024 * 1024
  });

  if (!html || !html.trim()) {
    throw new Error(`Spotify page returned an empty response for ${relativePath}`);
  }
  const match = html.match(/<script id="initialState" type="text\/plain">([^<]+)<\/script>/);

  if (!match?.[1]) {
    throw new Error(`Spotify initial state not found for ${relativePath}`);
  }

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
      const releases = group?.releases?.items || [];
      releases.forEach((release) => {
        const releaseId = spotifyUriToId(release?.uri);
        if (!releaseId || byId.has(releaseId)) return;

        byId.set(releaseId, {
          id: releaseId,
          uri: release.uri,
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

  const tracks = trackItems
    .map((item) => normalizeTrack(item?.track, album))
    .filter(Boolean);

  return {
    totalTracks: albumEntity?.tracksV2?.totalCount || tracks.length || album.totalTracks || 0,
    tracks
  };
}

app.get('/api/artist-data', async (req, res) => {
  try {
    if (artistCache && Date.now() < artistCacheExpiresAt) {
      return res.json(artistCache);
    }

    const artistState = await fetchSpotifyInitialState(`/artist/${ARTIST_ID}`);
    const artistEntity = extractArtistEntity(artistState);

    if (!artistEntity) {
      throw new Error('Artist data could not be extracted from Spotify page.');
    }

    const albums = extractReleases(artistEntity);
    const albumDetails = await Promise.all(albums.map((album) => fetchAlbumTracks(album)));

    const allTracks = albumDetails
      .flatMap((detail) => detail.tracks)
      .filter((track, index, arr) => arr.findIndex((entry) => entry.id === track.id) === index);

    const albumsWithCounts = albums.map((album, index) => ({
      ...album,
      totalTracks: albumDetails[index]?.totalTracks || album.totalTracks || 0
    }));

    const payload = {
      artist: {
        id: ARTIST_ID,
        name: artistEntity?.profile?.name || '404 A.M.',
        followers: artistEntity?.stats?.followers || 0,
        monthlyListenersNote: 'Public Spotify pages do not reliably expose monthly listeners.',
        genres: [],
        image: artistEntity?.visuals?.avatarImage?.sources?.[0]?.url || null,
        spotifyUrl: `https://open.spotify.com/artist/${ARTIST_ID}`
      },
      topTracks: allTracks.slice(0, 10),
      albums: albumsWithCounts,
      fetchedAt: new Date().toISOString(),
      source: 'spotify-public-page'
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

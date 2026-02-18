const tracksList = document.getElementById('tracks');
const albumsGrid = document.getElementById('albums');
const followersEl = document.getElementById('followers');
const genresEl = document.getElementById('genres');
const releaseCountEl = document.getElementById('releaseCount');
const spotifyProfileLink = document.getElementById('spotifyProfileLink');
const albumTemplate = document.getElementById('albumTemplate');

document.getElementById('year').textContent = String(new Date().getFullYear());

function formatFollowers(value) {
  return new Intl.NumberFormat('de-DE').format(value);
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unbekanntes Datum';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('de-DE', { year: 'numeric', month: 'short' });
}

async function loadArtistData() {
  const response = await fetch('/api/artist-data');
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.details || 'Daten konnten nicht geladen werden.');
  }
  return response.json();
}

function renderTracks(tracks) {
  tracksList.innerHTML = '';
  tracks.forEach((track) => {
    const li = document.createElement('li');
    const anchor = document.createElement('a');
    anchor.href = track.spotifyUrl;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    anchor.textContent = `${track.name}${track.albumName ? ` — ${track.albumName}` : ''}`;
    li.appendChild(anchor);
    tracksList.appendChild(li);
  });
}

function renderAlbums(albums) {
  albumsGrid.innerHTML = '';

  albums.forEach((album) => {
    const fragment = albumTemplate.content.cloneNode(true);
    const img = fragment.querySelector('img');
    const title = fragment.querySelector('h3');
    const meta = fragment.querySelector('.meta');
    const link = fragment.querySelector('.listen-link');

    img.src = album.image || '';
    img.alt = `${album.name} Cover`;
    title.textContent = album.name;
    meta.textContent = `${album.type.toUpperCase()} · ${formatDate(album.releaseDate)} · ${album.totalTracks} Tracks`;
    link.href = album.spotifyUrl;

    albumsGrid.appendChild(fragment);
  });
}

function renderError(message) {
  tracksList.innerHTML = `<li class="error">${message}</li>`;
  albumsGrid.innerHTML = `<p class="error">${message}</p>`;
}

(async function init() {
  try {
    const data = await loadArtistData();

    followersEl.textContent = formatFollowers(data.artist.followers);
    genresEl.textContent = data.artist.genres.length ? data.artist.genres.join(', ') : 'LoFi / Chill';
    releaseCountEl.textContent = String(data.albums.length);

    spotifyProfileLink.href = data.artist.spotifyUrl;
    spotifyProfileLink.textContent = 'Zum Spotify Profil';

    renderTracks(data.topTracks);
    renderAlbums(data.albums);
  } catch (error) {
    console.error(error);
    renderError(error.message);
  }
})();

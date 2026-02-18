const $ = (id) => document.getElementById(id);

const releasesGrid = $('releasesGrid');
const tracksList = $('tracks');
const eventsList = $('eventsList');
const announcementsEl = $('announcements');
const heroEl = document.querySelector('.hero');

const followersEl = $('followers');
const releaseCountEl = $('releaseCount');
const trackCountEl = $('trackCount');
const artistNameEl = $('artistName');
const artistBioEl = $('artistBio');
const bioFollowersEl = $('bioFollowers');
const bioReleasesEl = $('bioReleases');
const bioTracksEl = $('bioTracks');
const bioTimelineEl = $('bioTimeline');

const loginForm = $('loginForm');
const registerForm = $('registerForm');
const releaseForm = $('releaseForm');
const eventForm = $('eventForm');
const announcementForm = $('announcementForm');
const logoutBtn = $('logoutBtn');
const adminHint = $('adminHint');

const toast = $('toast');
let currentUser = null;

function toastMessage(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2400);
}

function formatFollowers(value) {
  return new Intl.NumberFormat('de-DE').format(value || 0);
}

function normalizeDate(dateStr) {
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr || '—' : d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderReleases(releases, limit = null) {
  if (!releasesGrid) return;
  releasesGrid.innerHTML = '';
  const list = limit ? releases.slice(0, limit) : releases;
  list.forEach((release) => {
    const card = document.createElement('article');
    card.className = 'release-card';
    card.innerHTML = `
      <img src="${release.image || ''}" alt="${release.name} Cover" loading="lazy" />
      <div class="release-copy">
        <h3>${release.name}</h3>
        <p class="meta">${(release.type || 'single').toUpperCase()} · ${normalizeDate(release.releaseDate)} · ${release.totalTracks || 0} Tracks</p>
        ${release.spotifyUrl ? `<a class="btn soft" target="_blank" rel="noreferrer" href="${release.spotifyUrl}">Open</a>` : ''}
      </div>
    `;
    releasesGrid.appendChild(card);
  });
}

function renderTracks(tracks) {
  if (!tracksList) return;
  tracksList.innerHTML = '';
  tracks.forEach((track) => {
    const li = document.createElement('li');
    li.innerHTML = `<a href="${track.spotifyUrl}" target="_blank" rel="noreferrer">${track.name} — ${track.albumName || 'Release'}</a> <span class="meta">${normalizeDate(track.albumReleaseDate)}</span>`;
    tracksList.appendChild(li);
  });
}

function renderEvents(events) {
  if (!eventsList) return;
  eventsList.innerHTML = '';
  if (!events.length) {
    eventsList.innerHTML = '<article class="feed-item"><p>Noch keine Events angekündigt.</p></article>';
    return;
  }
  events.forEach((event) => {
    const article = document.createElement('article');
    article.className = 'feed-item';
    article.innerHTML = `
      <h3>${event.title}</h3>
      <p>${normalizeDate(event.date)} · ${event.location || 'Location folgt'}</p>
      ${event.source === 'spotify' ? '<span class="badge">Spotify Event</span>' : ''}
      ${event.description ? `<p>${event.description}</p>` : ''}
      ${event.ticketUrl ? `<p><a class="btn soft" href="${event.ticketUrl}" target="_blank" rel="noreferrer">Tickets</a></p>` : ''}
    `;
    eventsList.appendChild(article);
  });
}

function renderAnnouncements(items) {
  if (!announcementsEl) return;
  announcementsEl.innerHTML = '';
  if (!items.length) {
    announcementsEl.innerHTML = '<article class="feed-item"><p>Noch keine Ankündigungen.</p></article>';
    return;
  }
  items.forEach((item) => {
    const article = document.createElement('article');
    article.className = 'feed-item';
    article.innerHTML = `
      ${item.pinned ? '<span class="badge">Pinned</span>' : ''}
      ${item.source ? `<span class="badge">${item.source.replace('auto-', '').toUpperCase()}</span>` : ''}
      <h3>${item.title}</h3>
      <p>${item.content}</p>
      ${item.link ? `<p><a class=\"btn soft\" href=\"${item.link}\" target=\"_blank\" rel=\"noreferrer\">Öffnen</a></p>` : ''}
      <p class="meta">${normalizeDate(item.createdAt)}</p>
    `;
    announcementsEl.appendChild(article);
  });
}


function renderBioTimeline(data) {
  if (!bioTimelineEl) return;
  const timeline = [];

  const newestRelease = (data.releases || [])[0];
  if (newestRelease) {
    timeline.push({
      title: `Neuester Release: ${newestRelease.name}`,
      content: `${(newestRelease.type || 'release').toUpperCase()} · ${newestRelease.totalTracks || 0} Tracks`,
      date: newestRelease.releaseDate
    });
  }

  const nextEvent = (data.events || []).find((event) => new Date(event.date || 0).getTime() >= Date.now());
  if (nextEvent) {
    timeline.push({
      title: `Nächster Auftritt: ${nextEvent.title}`,
      content: `${nextEvent.location || 'Location folgt'}`,
      date: nextEvent.date
    });
  }

  const firstTrack = (data.topTracks || [])[0];
  if (firstTrack) {
    timeline.push({
      title: `Track im Fokus: ${firstTrack.name}`,
      content: `${firstTrack.albumName || 'Release'} · ${normalizeDate(firstTrack.albumReleaseDate)}`,
      date: firstTrack.albumReleaseDate
    });
  }

  bioTimelineEl.innerHTML = timeline.map((item) => `
    <article class="feed-item">
      <h3>${item.title}</h3>
      <p>${item.content}</p>
      <p class="meta">${normalizeDate(item.date)}</p>
    </article>
  `).join('') || '<article class="feed-item"><p>Mehr Story-Elemente folgen bald.</p></article>';
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function loadMe() {
  const data = await fetchJSON('/api/me');
  currentUser = data.authenticated ? data.user : null;
  if (logoutBtn) logoutBtn.classList.toggle('hidden', !currentUser);
  if (adminHint) {
    adminHint.textContent = currentUser?.role === 'admin'
      ? `Eingeloggt als ${currentUser.username} (Admin)`
      : 'Admin-Zugang erforderlich.';
  }
}

async function loadPublicData() {
  const data = await fetchJSON('/api/public-data');

  if (followersEl) followersEl.textContent = formatFollowers(data.artist.followers);
  if (releaseCountEl) releaseCountEl.textContent = String(data.releases.length);
  if (trackCountEl) trackCountEl.textContent = String(data.topTracks.length);
  if (artistNameEl) artistNameEl.textContent = data.artist.name;
  if (artistBioEl) artistBioEl.textContent = data.artist.bio || 'LoFi Producer zwischen Nostalgie und Nacht-Vibes.';
  if (bioFollowersEl) bioFollowersEl.textContent = formatFollowers(data.artist.followers);
  if (bioReleasesEl) bioReleasesEl.textContent = String((data.releases || []).length);
  if (bioTracksEl) bioTracksEl.textContent = String((data.topTracks || []).length);

  if (heroEl && data.artist.image) {
    heroEl.style.backgroundImage = `linear-gradient(110deg, rgba(5,10,20,.86), rgba(5,10,20,.58)), url('${data.artist.image}')`;
  }

  renderReleases(data.releases || [], location.pathname === '/' ? 4 : null);
  renderTracks(data.topTracks || []);
  renderEvents(data.events || []);
  renderAnnouncements((data.automaticNews && data.automaticNews.length ? data.automaticNews : data.announcements) || []);
  renderBioTimeline(data);
}

async function handleLogin(event) {
  event.preventDefault();
  const form = new FormData(loginForm);
  try {
    const payload = { login: form.get('login'), password: form.get('password') };
    const data = await fetchJSON('/api/login', { method: 'POST', body: JSON.stringify(payload) });
    currentUser = data.user;
    toastMessage(`Willkommen ${currentUser.username}!`);
    await loadMe();
  } catch (error) {
    toastMessage(error.message);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const form = new FormData(registerForm);
  try {
    await fetchJSON('/api/register', {
      method: 'POST',
      body: JSON.stringify({ username: form.get('username'), email: form.get('email'), password: form.get('password') })
    });
    toastMessage('Account erstellt. Jetzt einloggen.');
    registerForm.reset();
  } catch (error) {
    toastMessage(error.message);
  }
}

async function handleAdminSubmit(formEl, endpoint, successMessage, mutate) {
  const form = new FormData(formEl);
  const payload = Object.fromEntries(form.entries());
  if (mutate) mutate(form, payload);

  try {
    await fetchJSON(endpoint, { method: 'POST', body: JSON.stringify(payload) });
    toastMessage(successMessage);
    formEl.reset();
    await loadPublicData();
  } catch (error) {
    toastMessage(error.message);
  }
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await fetchJSON('/api/logout', { method: 'POST' });
    currentUser = null;
    toastMessage('Logout erfolgreich.');
    await loadMe();
  });
}
if (loginForm) loginForm.addEventListener('submit', handleLogin);
if (registerForm) registerForm.addEventListener('submit', handleRegister);
if (releaseForm) releaseForm.addEventListener('submit', (e) => { e.preventDefault(); handleAdminSubmit(releaseForm, '/api/admin/releases', 'Release gespeichert.'); });
if (eventForm) eventForm.addEventListener('submit', (e) => { e.preventDefault(); handleAdminSubmit(eventForm, '/api/admin/events', 'Event gespeichert.'); });
if (announcementForm) {
  announcementForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleAdminSubmit(announcementForm, '/api/admin/announcements', 'Announcement veröffentlicht.', (form, payload) => {
      payload.pinned = form.get('pinned') === 'on';
    });
  });
}

(async function init() {
  try {
    await Promise.all([loadMe(), loadPublicData()]);
  } catch (error) {
    toastMessage(`Fehler: ${error.message}`);
  }
})();

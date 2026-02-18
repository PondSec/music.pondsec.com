const releasesGrid = document.getElementById('releasesGrid');
const tracksList = document.getElementById('tracks');
const eventsList = document.getElementById('eventsList');
const announcementsEl = document.getElementById('announcements');

const followersEl = document.getElementById('followers');
const releaseCountEl = document.getElementById('releaseCount');
const trackCountEl = document.getElementById('trackCount');
const artistImage = document.getElementById('artistImage');

const adminPanel = document.getElementById('adminPanel');
const openAuth = document.getElementById('openAuth');
const closeAuth = document.getElementById('closeAuth');
const authModal = document.getElementById('authModal');
const logoutBtn = document.getElementById('logoutBtn');
const showLogin = document.getElementById('showLogin');
const showRegister = document.getElementById('showRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const toast = document.getElementById('toast');

const releaseForm = document.getElementById('releaseForm');
const eventForm = document.getElementById('eventForm');
const announcementForm = document.getElementById('announcementForm');

let currentUser = null;

function formatFollowers(value) {
  return new Intl.NumberFormat('de-DE').format(value || 0);
}

function toastMessage(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2600);
}

function normalizeDate(dateStr) {
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderAnnouncements(items) {
  announcementsEl.innerHTML = '';
  if (!items.length) {
    announcementsEl.innerHTML = '<article class="glass news-item"><p>Noch keine Ankündigungen.</p></article>';
    return;
  }

  items.forEach((item) => {
    const article = document.createElement('article');
    article.className = 'glass news-item';
    article.innerHTML = `
      ${item.pinned ? '<span class="pinned">Pinned</span>' : ''}
      <h3>${item.title}</h3>
      <p>${item.content}</p>
      <p class="release-meta">${normalizeDate(item.createdAt)}</p>
    `;
    announcementsEl.appendChild(article);
  });
}

function renderReleases(releases) {
  releasesGrid.innerHTML = '';
  releases.forEach((release) => {
    const card = document.createElement('article');
    card.className = 'glass release-card';
    card.innerHTML = `
      <img class="release-cover" src="${release.image || ''}" alt="${release.name} Cover" loading="lazy" />
      <div class="release-body">
        <h3>${release.name}</h3>
        <p class="release-meta">${(release.type || 'single').toUpperCase()} · ${normalizeDate(release.releaseDate)} · ${release.totalTracks || 0} Tracks</p>
        ${release.spotifyUrl ? `<a class="btn ghost" target="_blank" rel="noreferrer" href="${release.spotifyUrl}">Anhören</a>` : ''}
      </div>
    `;
    releasesGrid.appendChild(card);
  });
}

function renderTracks(tracks) {
  tracksList.innerHTML = '';
  tracks.forEach((track) => {
    const li = document.createElement('li');
    li.innerHTML = `<a href="${track.spotifyUrl}" target="_blank" rel="noreferrer">${track.name} — ${track.albumName || 'Release'}</a>`;
    tracksList.appendChild(li);
  });
}

function renderEvents(events) {
  eventsList.innerHTML = '';
  if (!events.length) {
    eventsList.innerHTML = '<article class="glass event-item"><p>Noch keine Events angekündigt.</p></article>';
    return;
  }

  events.forEach((event) => {
    const article = document.createElement('article');
    article.className = 'glass event-item';
    article.innerHTML = `
      <h3>${event.title}</h3>
      <p>${normalizeDate(event.date)} · ${event.location || 'Location folgt'}</p>
      ${event.description ? `<p>${event.description}</p>` : ''}
      ${event.ticketUrl ? `<p><a class="btn ghost" href="${event.ticketUrl}" target="_blank" rel="noreferrer">Tickets</a></p>` : ''}
    `;
    eventsList.appendChild(article);
  });
}

function updateAuthUI() {
  const isLoggedIn = Boolean(currentUser);
  openAuth.classList.toggle('hidden', isLoggedIn);
  logoutBtn.classList.toggle('hidden', !isLoggedIn);
  adminPanel.classList.toggle('hidden', !(isLoggedIn && currentUser.role === 'admin'));
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

async function loadPublicData() {
  const data = await fetchJSON('/api/public-data');
  followersEl.textContent = formatFollowers(data.artist.followers);
  releaseCountEl.textContent = String(data.releases.length);
  trackCountEl.textContent = String(data.topTracks.length);
  artistImage.src = data.artist.image || '';

  renderAnnouncements(data.announcements || []);
  renderReleases(data.releases || []);
  renderTracks(data.topTracks || []);
  renderEvents(data.events || []);
}

async function loadMe() {
  const data = await fetchJSON('/api/me');
  currentUser = data.authenticated ? data.user : null;
  updateAuthUI();
}

function switchAuthTab(mode) {
  const loginMode = mode === 'login';
  loginForm.classList.toggle('hidden', !loginMode);
  registerForm.classList.toggle('hidden', loginMode);
  showLogin.classList.toggle('active', loginMode);
  showRegister.classList.toggle('active', !loginMode);
}

openAuth.addEventListener('click', () => authModal.classList.remove('hidden'));
closeAuth.addEventListener('click', () => authModal.classList.add('hidden'));
showLogin.addEventListener('click', () => switchAuthTab('login'));
showRegister.addEventListener('click', () => switchAuthTab('register'));

logoutBtn.addEventListener('click', async () => {
  await fetchJSON('/api/logout', { method: 'POST' });
  currentUser = null;
  updateAuthUI();
  toastMessage('Du bist ausgeloggt.');
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(loginForm);
  try {
    const payload = { login: form.get('login'), password: form.get('password') };
    const data = await fetchJSON('/api/login', { method: 'POST', body: JSON.stringify(payload) });
    currentUser = data.user;
    updateAuthUI();
    authModal.classList.add('hidden');
    toastMessage(`Willkommen ${currentUser.username}!`);
  } catch (error) {
    toastMessage(error.message);
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(registerForm);

  try {
    const payload = {
      username: form.get('username'),
      email: form.get('email'),
      password: form.get('password')
    };
    await fetchJSON('/api/register', { method: 'POST', body: JSON.stringify(payload) });
    toastMessage('Account erstellt. Bitte einloggen.');
    switchAuthTab('login');
  } catch (error) {
    toastMessage(error.message);
  }
});

releaseForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(releaseForm);
  try {
    await fetchJSON('/api/admin/releases', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    toastMessage('Release gespeichert.');
    releaseForm.reset();
    await loadPublicData();
  } catch (error) {
    toastMessage(error.message);
  }
});

eventForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(eventForm);
  try {
    await fetchJSON('/api/admin/events', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    toastMessage('Event gespeichert.');
    eventForm.reset();
    await loadPublicData();
  } catch (error) {
    toastMessage(error.message);
  }
});

announcementForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(announcementForm);
  const payload = Object.fromEntries(form.entries());
  payload.pinned = form.get('pinned') === 'on';

  try {
    await fetchJSON('/api/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    toastMessage('Announcement veröffentlicht.');
    announcementForm.reset();
    await loadPublicData();
  } catch (error) {
    toastMessage(error.message);
  }
});

(async function init() {
  try {
    await Promise.all([loadPublicData(), loadMe()]);
  } catch (error) {
    toastMessage(`Fehler: ${error.message}`);
  }
})();

const $ = (id) => document.getElementById(id);
let pendingDeleteId = null;
let pendingRenameId = null;
let canRenameLinks = false;
let allLinks = [];
let linkLimit = 20;
let subscription = 'free';
let searchQuery = '';
let sortMode = 'created-desc';

async function api(path, options = {}) {
  const res = await fetch(path, options);
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
  return data;
}

function iconReady() {
  return new Promise((resolve) => {
    if (window.lucide?.createIcons) return resolve();
    const timer = setInterval(() => {
      if (window.lucide?.createIcons) {
        clearInterval(timer);
        resolve();
      }
    }, 30);
  });
}

async function init() {
  await iconReady();
  lucide.createIcons();

  const username = $('username')?.textContent.trim();
  if (username) {
    const avatar = `https://avatars.rotur.dev/${encodeURIComponent(username)}`;
    $('avatar').src = avatar;
    $('profile-avatar-img').src = avatar;
    $('profile-username').textContent = username;
  }

  bindEvents();
  await loadLinks();
}

function bindEvents() {
  $('search-links').addEventListener('input', (e) => { searchQuery = e.target.value.trim().toLowerCase(); renderLinks(); });
  $('sort-links').addEventListener('change', (e) => { sortMode = e.target.value; renderLinks(); });

  $('add-btn').addEventListener('click', openCreateModal);
  $('close-create-modal').addEventListener('click', closeCreateModal);
  $('modal-create').addEventListener('click', createFromModal);
  $('modal-new-to').addEventListener('keydown', (e) => { if (e.key === 'Enter') createFromModal(); });

  $('profile-btn').addEventListener('click', openProfileModal);
  $('close-profile-modal').addEventListener('click', closeProfileModal);
  $('profile-logout-btn').addEventListener('click', logout);

  $('user-menu-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('user-dropdown').classList.toggle('active');
  });
  document.addEventListener('click', () => $('user-dropdown').classList.remove('active'));
  $('logout-btn').addEventListener('click', logout);

  $('cancel-delete').addEventListener('click', closeDeleteModal);
  $('confirm-delete').addEventListener('click', confirmDelete);

  $('close-rename-modal').addEventListener('click', closeRenameModal);
  $('cancel-rename').addEventListener('click', closeRenameModal);
  $('confirm-rename').addEventListener('click', confirmRename);
  $('rename-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmRename(); });
  $('rename-input').addEventListener('input', (e) => $('rename-new').textContent = e.target.value.trim() || '—');

  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });
}

async function loadLinks() {
  try {
    const [me, links] = await Promise.all([api('/api/me'), api('/api/links')]);
    canRenameLinks = !!me.canRename;
    subscription = String(me.subscription || $('subscription')?.textContent || 'free');
    linkLimit = Number(me.linkLimit || 20);
    allLinks = Array.isArray(links) ? links : [];
    renderLinks();
    updateStats(allLinks);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderLinks() {
  const list = $('links-list');
  const empty = $('empty-state');
  const links = filteredAndSortedLinks();
  list.innerHTML = '';

  if (!links.length) {
    list.style.display = 'none';
    empty.style.display = 'block';
    empty.querySelector('h3').textContent = allLinks.length ? 'No matching links' : 'No links yet';
    empty.querySelector('p').textContent = allLinks.length ? 'Try a different search.' : 'Create your first short link above.';
    lucide.createIcons();
    return;
  }

  empty.style.display = 'none';
  list.style.display = 'grid';
  for (const link of links) list.appendChild(linkCard(link));
  lucide.createIcons();
}

function filteredAndSortedLinks() {
  const q = searchQuery;
  const links = allLinks.filter((link) => {
    if (!q) return true;
    return String(link.id || '').toLowerCase().includes(q) || String(link.to || '').toLowerCase().includes(q);
  });

  const value = (link) => {
    if (sortMode.startsWith('views')) return Number(link.views || 0);
    if (sortMode.startsWith('created')) return Number(link.created_at || 0);
    return String(link.id || '').toLowerCase();
  };

  return links.sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (av < bv) return sortMode.endsWith('asc') ? -1 : 1;
    if (av > bv) return sortMode.endsWith('asc') ? 1 : -1;
    return 0;
  });
}

function linkCard(link) {
  const card = document.createElement('article');
  card.className = 'link-card';
  card.dataset.id = link.id;

  const shortUrl = `${window.location.origin}/${link.id}`;
  const destination = readableUrl(link.to || '');

  card.innerHTML = `
    <div class="link-top">
      <div class="link-main">
        <a class="link-id" href="/${escapeHtml(link.id)}" target="_blank" rel="noreferrer">/${escapeHtml(link.id)}</a>
        <span class="link-destination">${escapeHtml(destination)}</span>
      </div>
      <div class="link-actions">
        <button class="icon-btn copy-btn" type="button" title="Copy short link"><i data-lucide="copy"></i></button>
        <button class="icon-btn open-btn" type="button" title="Open destination"><i data-lucide="external-link"></i></button>
        <button class="icon-btn rename-btn ${canRenameLinks ? '' : 'locked'}" type="button" title="${canRenameLinks ? 'Rename' : 'Rename requires Plus or Pro'}" aria-disabled="${canRenameLinks ? 'false' : 'true'}"><i data-lucide="${canRenameLinks ? 'pencil' : 'lock'}"></i></button>
        <button class="icon-btn danger delete-btn" type="button" title="Delete"><i data-lucide="trash-2"></i></button>
      </div>
    </div>
    <div class="link-bottom">
      <span class="link-stat"><i data-lucide="mouse-pointer-click"></i>${link.views || 0} ${(link.views || 0) === 1 ? 'click' : 'clicks'}</span>
      <span>${escapeHtml(shortUrl.replace(/^https?:\/\//, ''))}</span>
    </div>
  `;

  card.querySelector('.copy-btn').addEventListener('click', () => copyText(shortUrl));
  card.querySelector('.open-btn').addEventListener('click', () => window.open(link.to, '_blank', 'noreferrer'));
  card.querySelector('.delete-btn').addEventListener('click', () => openDeleteModal(link.id));
  card.querySelector('.rename-btn')?.addEventListener('click', () => {
    if (!canRenameLinks) return showToast('Rename requires Plus or Pro', 'error');
    openRenameModal(link.id);
  });
  return card;
}

function updateStats(links) {
  const totalClicks = links.reduce((sum, link) => sum + (link.views || 0), 0);
  const atLimit = links.length >= linkLimit;
  $('link-count').textContent = `${links.length}/${linkLimit} links`;
  $('link-limit').textContent = `${links.length} / ${linkLimit} links`;
  $('total-links').textContent = `${links.length} / ${linkLimit}`;
  $('modal-create').disabled = atLimit;
  $('add-btn').disabled = atLimit;
  if (atLimit) $('link-limit').classList.add('at-limit'); else $('link-limit').classList.remove('at-limit');
  $('total-clicks').textContent = totalClicks.toLocaleString();
  updatePlanNotice(links.length);
}

function updatePlanNotice(count) {
  const notice = $('plan-notice');
  const isFreeTier = !canRenameLinks;
  const nearLimit = isFreeTier && count >= Math.floor(linkLimit * 0.8);

  if (!isFreeTier && !nearLimit) {
    notice.style.display = 'none';
    notice.innerHTML = '';
    return;
  }

  const messages = [];
  if (isFreeTier) messages.push('Renaming links requires Plus or Pro. Locked buttons show which actions need an upgrade.');
  if (nearLimit) messages.push(`Want more links? You are using ${count} of ${linkLimit}.`);

  notice.innerHTML = `${messages.join(' ')} <a href="https://ko-fi.com/mistium" target="_blank" rel="noreferrer">Upgrade on Ko-fi</a>`;
  notice.style.display = 'block';
}

async function createFromModal() {
  const input = $('modal-new-to');
  const ok = await createLink(input.value.trim());
  if (ok) closeCreateModal();
}

async function createLink(to) {
  if (allLinks.length >= linkLimit) return showToast(`Link limit reached (${linkLimit})`, 'error'), false;
  if (!to) return showToast('Enter a destination URL', 'error'), false;
  try {
    await api(`/api/link?to=${encodeURIComponent(to)}`, { method: 'POST' });
    await loadLinks();
    showToast('Link created', 'success');
    return true;
  } catch (err) {
    showToast(err.message, 'error');
    return false;
  }
}

function openDeleteModal(id) {
  pendingDeleteId = id;
  $('delete-link-id').textContent = `/${id}`;
  $('delete-modal').classList.add('active');
}
function closeDeleteModal() { pendingDeleteId = null; $('delete-modal').classList.remove('active'); }
async function confirmDelete() {
  if (!pendingDeleteId) return;
  try {
    await api(`/api/link?id=${encodeURIComponent(pendingDeleteId)}`, { method: 'DELETE' });
    closeDeleteModal();
    await loadLinks();
    showToast('Link deleted', 'success');
  } catch (err) { showToast(err.message, 'error'); }
}

function openRenameModal(id) {
  pendingRenameId = id;
  $('rename-old').textContent = id;
  $('rename-input').value = id;
  $('rename-new').textContent = id;
  $('rename-modal').classList.add('active');
  setTimeout(() => { $('rename-input').focus(); $('rename-input').select(); }, 80);
}
function closeRenameModal() { pendingRenameId = null; $('rename-modal').classList.remove('active'); }
async function confirmRename() {
  const newName = $('rename-input').value.trim();
  if (!pendingRenameId || !newName) return showToast('Enter a new slug', 'error');
  try {
    await api(`/api/link/rename?id=${encodeURIComponent(pendingRenameId)}&newName=${encodeURIComponent(newName)}`, { method: 'POST' });
    closeRenameModal();
    await loadLinks();
    showToast('Link renamed', 'success');
  } catch (err) { showToast(err.message, 'error'); }
}

function openCreateModal() { $('create-modal').classList.add('active'); setTimeout(() => $('modal-new-to').focus(), 80); }
function closeCreateModal() { $('create-modal').classList.remove('active'); $('modal-new-to').value = ''; }
function openProfileModal() { $('profile-modal').classList.add('active'); }
function closeProfileModal() { $('profile-modal').classList.remove('active'); }

async function logout() {
  try { await api('/api/logout', { method: 'POST' }); } catch (_) {}
  window.location.href = '/auth';
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'success');
  } catch (_) {
    showToast('Copy failed', 'error');
  }
}

function readableUrl(value) {
  try {
    const url = new URL(value);
    return url.host + url.pathname + url.search;
  } catch (_) { return value; }
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}"></i><span>${escapeHtml(message)}</span>`;
  document.body.appendChild(toast);
  lucide.createIcons();
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 220);
  }, 2400);
}

document.addEventListener('DOMContentLoaded', init);

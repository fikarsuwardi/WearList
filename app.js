/* ===========================
   WEARLIST — app.js (Supabase)
   =========================== */

// ── Supabase client ────────────────────────────
const SUPABASE_URL = 'https://wjznikklegrqborjogtb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indqem5pa2tsZWdycWJvcmpvZ3RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MjM2NTYsImV4cCI6MjA5MjA5OTY1Nn0.39gZapVZpsqY6RlSaDJUA8a7XCn9VfNAydOSFkL8QQg';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── State ──────────────────────────────────────
let currentUser = null;
let items       = [];
let profile     = {};
let categories  = [];
let arsipCats   = [];

let editingId  = null;
let detailId   = null;
let arsipkanId = null;
let photoData  = null;

const DEFAULT_CATS       = ['Atasan', 'Bawahan', 'Outer', 'Dress', 'Aksesoris'];
const DEFAULT_ARSIP_CATS = ['Donasi', 'Kasih Adik', 'Buang'];

const CAT_EMOJI = {
  'Atasan': '👕', 'Bawahan': '👖', 'Outer': '🧥',
  'Dress': '👗', 'Aksesoris': '👜',
};
function catEmoji(k) { return CAT_EMOJI[k] || '🧺'; }

// ── Auth ───────────────────────────────────────
async function loginWithGoogle() {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href },
  });
  if (error) showToast('Login gagal: ' + error.message);
}

async function logout() {
  await db.auth.signOut();
}

function showLoginScreen() {
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('screenLogin').classList.remove('hidden');
  document.getElementById('loadingOverlay').classList.add('hidden');
}

function showMainApp() {
  document.getElementById('screenLogin').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
}

// ── User info UI ────────────────────────────────
function updateUserInfo(user) {
  if (!user) return;
  const meta = user.user_metadata || {};
  document.getElementById('userName').textContent  = meta.full_name || meta.name || 'Pengguna';
  document.getElementById('userEmail').textContent = user.email || '';
  const avatarEl = document.getElementById('userAvatar');
  if (meta.avatar_url || meta.picture) {
    avatarEl.innerHTML = `<img src="${meta.avatar_url || meta.picture}" alt=""/>`;
  }
}

// ── Load all data ──────────────────────────────
const TIMEOUT_MS = 8000;
function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
    ),
  ]);
}

async function loadAllData() {
  showLoading(true);
  try {
    await withTimeout(Promise.all([
      loadItems(),
      loadCategories(),
      loadArsipCategories(),
      loadProfile(),
    ]));
    renderHome();
    loadProfileUI();
  } catch (err) {
    if (err.message === 'timeout') {
      showToast('Koneksi lambat, coba refresh');
    } else {
      showToast('Gagal memuat data');
    }
  } finally {
    showLoading(false);
  }
}

async function loadItems() {
  const { data, error } = await db
    .from('items')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });
  if (!error) items = data || [];
}

async function loadCategories() {
  const { data, error } = await db
    .from('categories')
    .select('name')
    .eq('user_id', currentUser.id)
    .order('created_at');

  if (error) return;
  if (data && data.length > 0) {
    categories = [...new Set(data.map(r => r.name))];
  } else {
    categories = [...DEFAULT_CATS];
    await db.from('categories').insert(
      DEFAULT_CATS.map(name => ({ user_id: currentUser.id, name }))
    );
  }
}

async function loadArsipCategories() {
  const { data, error } = await db
    .from('arsip_categories')
    .select('name')
    .eq('user_id', currentUser.id)
    .order('created_at');

  if (error) return;
  if (data && data.length > 0) {
    arsipCats = [...new Set(data.map(r => r.name))];
  } else {
    arsipCats = [...DEFAULT_ARSIP_CATS];
    await db.from('arsip_categories').insert(
      DEFAULT_ARSIP_CATS.map(name => ({ user_id: currentUser.id, name }))
    );
  }
}

async function loadProfile() {
  const { data } = await db
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();
  if (data) profile = data;
}

// ── Render: Koleksi ────────────────────────────
function renderHome() {
  const scroll      = document.getElementById('homeScroll');
  const arsipCount  = items.filter(i => i.arsip).length;
  const totalCount  = items.length;

  document.getElementById('itemCount').textContent =
    arsipCount > 0
      ? `${totalCount} pakaian (${arsipCount} diarsip)`
      : `${totalCount} pakaian`;
  scroll.innerHTML = '';

  if (totalCount === 0) {
    scroll.innerHTML = `
      <div class="empty">
        <div class="empty-icon">👗</div>
        <div class="empty-text">Belum ada pakaian</div>
        <div class="empty-sub">Tap + untuk mulai menambahkan</div>
      </div>`;
    return;
  }

  const usedCats = [...new Set(items.map(i => i.kategori))];
  const ordered  = [
    ...categories.filter(c => usedCats.includes(c)),
    ...usedCats.filter(c => !categories.includes(c)),
  ];
  ordered.forEach(cat => {
    const group = items.filter(i => i.kategori === cat);
    if (group.length) scroll.appendChild(makeCatSection(cat, group));
  });
}

// ── Render: Arsip ──────────────────────────────
function renderArsip() {
  const scroll   = document.getElementById('arsipScroll');
  const archived = items.filter(i => i.arsip);

  scroll.innerHTML = '';

  if (archived.length === 0) {
    scroll.innerHTML = `
      <div class="empty">
        <div class="empty-icon">🗂️</div>
        <div class="empty-text">Arsip kosong</div>
        <div class="empty-sub">Pakaian yang diarsipkan akan muncul di sini</div>
      </div>`;
    return;
  }

  const usedAcats = [...new Set(archived.map(i => i.arsip_kategori))];
  const ordered   = [
    ...arsipCats.filter(c => usedAcats.includes(c)),
    ...usedAcats.filter(c => !arsipCats.includes(c)),
  ];
  ordered.forEach(cat => {
    const group = archived.filter(i => i.arsip_kategori === cat);
    if (group.length) scroll.appendChild(makeCatSection(cat, group, true));
  });
}

// ── Build section DOM ──────────────────────────
function makeCatSection(cat, group, isArsip = false) {
  const section = document.createElement('div');
  section.className = 'cat-section';
  section.innerHTML = `
    <div class="cat-header">
      <span class="cat-title">${escHtml(cat)}</span>
      <span class="cat-count">${group.length}</span>
    </div>
    <div class="cat-divider"></div>
    <div class="clothes-grid"></div>
  `;
  const grid = section.querySelector('.clothes-grid');
  group.forEach(item => grid.appendChild(makeCard(item, isArsip)));
  return section;
}

// ── Build card DOM ─────────────────────────────
function makeCard(item, isArsip = false) {
  const card = document.createElement('div');
  card.className = 'card' + (isArsip ? ' arsip-item' : '');

  const photoHTML = item.foto_url
    ? `<img class="card-photo" src="${item.foto_url}" alt=""/>`
    : `<div class="card-placeholder">${catEmoji(item.kategori)}</div>`;

  card.innerHTML = `
    ${item.arsip ? `<span class="card-arsip-badge">🗂️ Arsip</span>` : ''}
    ${photoHTML}
    <div class="card-footer">
      ${item.catatan ? `<span class="card-note">${escHtml(item.catatan)}</span>` : ''}
    </div>
  `;
  card.addEventListener('click', () => openDetail(item.id));
  return card;
}

// ── Detail ─────────────────────────────────────
function openDetail(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  detailId = id;

  document.getElementById('detailTitle').textContent = item.kategori;

  const photoHTML = item.foto_url
    ? `<img class="detail-photo" src="${item.foto_url}" alt=""/>`
    : `<div class="detail-placeholder">${catEmoji(item.kategori)}</div>`;

  const rows = [
    { label: 'Kategori', value: item.kategori },
    item.arsip ? { label: 'Arsip', value: item.arsip_kategori } : null,
    { label: 'Ditambah', value: formatDate(item.created_at) },
  ].filter(Boolean);

  let html = photoHTML;
  html += rows.map(r => `
    <div class="detail-row">
      <span class="detail-label">${r.label}</span>
      <span class="detail-value">${escHtml(r.value)}</span>
    </div>
  `).join('');
  if (item.catatan) {
    html += `<div class="detail-catatan">📝 ${escHtml(item.catatan)}</div>`;
  }

  document.getElementById('detailBody').innerHTML = html;

  const actions = document.getElementById('detailActions');
  if (item.arsip) {
    actions.className = 'detail-actions three';
    actions.innerHTML = `
      <button class="btn-action btn-edit" id="detailEdit">Edit</button>
      <button class="btn-action btn-restore" id="detailRestore">Kembalikan</button>
      <button class="btn-action btn-delete" id="detailDelete">Hapus</button>
    `;
    document.getElementById('detailRestore').onclick = () => restoreItem(id);
  } else {
    actions.className = 'detail-actions three';
    actions.innerHTML = `
      <button class="btn-action btn-edit" id="detailEdit">Edit</button>
      <button class="btn-action btn-arsip" id="detailArsip">Arsipkan</button>
      <button class="btn-action btn-delete" id="detailDelete">Hapus</button>
    `;
    document.getElementById('detailArsip').onclick = () => {
      closeDetail();
      openArsipkan(id);
    };
  }
  document.getElementById('detailEdit').onclick   = () => { closeDetail(); openForm(id); };
  document.getElementById('detailDelete').onclick = () => {
    if (confirm('Hapus pakaian ini?')) deleteItem(id);
  };

  document.getElementById('modalDetail').classList.remove('hidden');
}

function closeDetail() {
  document.getElementById('modalDetail').classList.add('hidden');
  detailId = null;
}

// ── Arsipkan ───────────────────────────────────
function openArsipkan(id) {
  arsipkanId = id;
  renderArsipCatList();
  document.getElementById('newArsipCatRow').classList.add('hidden');
  document.getElementById('fNewArsipCat').value = '';
  document.getElementById('modalArsipkan').classList.remove('hidden');
}

function renderArsipCatList() {
  const list  = document.getElementById('arsipCatList');
  const icons = { 'Donasi': '💝', 'Kasih Adik': '🤝', 'Buang': '🗑️' };
  list.innerHTML = arsipCats.map(cat => `
    <button type="button" class="arsip-cat-btn" data-cat="${escHtml(cat)}">
      <span class="arsip-cat-icon">${icons[cat] || '📁'}</span>
      ${escHtml(cat)}
    </button>
  `).join('');
  list.querySelectorAll('.arsip-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => doArsipkan(btn.dataset.cat));
  });
}

async function doArsipkan(kategoriArsip) {
  const item = items.find(i => i.id === arsipkanId);
  if (!item) return;

  showLoading(true);
  const now = new Date().toISOString();
  const { error } = await db
    .from('items')
    .update({ arsip: true, arsip_kategori: kategoriArsip, arsip_tanggal: now })
    .eq('id', arsipkanId)
    .eq('user_id', currentUser.id);

  showLoading(false);
  if (error) { showToast('Gagal mengarsipkan'); return; }

  const idx = items.findIndex(i => i.id === arsipkanId);
  if (idx !== -1) items[idx] = { ...items[idx], arsip: true, arsip_kategori: kategoriArsip, arsip_tanggal: now };

  renderHome();
  renderArsip();
  closeArsipkan();
  showToast(`Dipindah ke "${kategoriArsip}"`);
}

function closeArsipkan() {
  document.getElementById('modalArsipkan').classList.add('hidden');
  arsipkanId = null;
}

async function restoreItem(id) {
  showLoading(true);
  const { error } = await db
    .from('items')
    .update({ arsip: false, arsip_kategori: null, arsip_tanggal: null })
    .eq('id', id)
    .eq('user_id', currentUser.id);

  showLoading(false);
  if (error) { showToast('Gagal mengembalikan'); return; }

  const idx = items.findIndex(i => i.id === id);
  if (idx !== -1) items[idx] = { ...items[idx], arsip: false, arsip_kategori: null, arsip_tanggal: null };

  renderHome();
  renderArsip();
  closeDetail();
  showToast('Dikembalikan ke Koleksi');
}

// ── Form tambah/edit ────────────────────────────
function openForm(id = null) {
  editingId = id;
  photoData = null;

  document.getElementById('clothesForm').reset();
  resetPhotoUI();
  buildCategoryOptions();
  document.getElementById('newKatRow').classList.add('hidden');
  document.getElementById('photoHint').classList.remove('show');

  if (id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    document.getElementById('modalTitle').textContent = 'Edit Pakaian';
    document.getElementById('fKategori').value = item.kategori;
    document.getElementById('fCatatan').value  = item.catatan || '';
    if (item.foto_url) {
      photoData = item.foto_url;
      showPhotoPreview(item.foto_url);
    }
  } else {
    document.getElementById('modalTitle').textContent = 'Tambah Pakaian';
  }

  document.getElementById('modalForm').classList.remove('hidden');
}

function closeForm() {
  document.getElementById('modalForm').classList.add('hidden');
  editingId = null;
  photoData = null;
}

function buildCategoryOptions() {
  const sel = document.getElementById('fKategori');
  const cur = sel.value;
  while (sel.options.length > 1) sel.remove(1);
  categories.forEach(cat => {
    const opt = new Option(cat, cat);
    sel.insertBefore(opt, sel.lastElementChild);
  });
  if (categories.includes(cur)) sel.value = cur;
}

// ── Photo ──────────────────────────────────────
function resetPhotoUI() {
  const preview = document.getElementById('photoPreview');
  preview.style.display = 'none';
  preview.src = '';
  document.getElementById('photoPlaceholder').style.display = 'flex';
  document.getElementById('photoRemove').classList.remove('visible');
  document.getElementById('photoPicker').classList.remove('has-photo');
  document.getElementById('fFoto').value = '';
}

function showPhotoPreview(src) {
  document.getElementById('photoPreview').src = src;
  document.getElementById('photoPreview').style.display = 'block';
  document.getElementById('photoPlaceholder').style.display = 'none';
  document.getElementById('photoRemove').classList.add('visible');
  document.getElementById('photoPicker').classList.add('has-photo');
}

function handlePhotoChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => openCropModal(ev.target.result);
  reader.readAsDataURL(file);
}

// ── Crop modal ─────────────────────────────────
let cropImg      = null;
let cropDisplayW = 0, cropDisplayH = 0;
let cropOffX     = 0, cropOffY     = 0;
let cropDragX    = 0, cropDragY    = 0;
let cropStartOX  = 0, cropStartOY  = 0;
let cropDragging = false;

function openCropModal(src) {
  const img = new Image();
  img.onload = () => {
    cropImg = img;
    document.getElementById('modalCrop').classList.remove('hidden');
    requestAnimationFrame(() => {
      const vp  = document.getElementById('cropViewport');
      const vpW = vp.offsetWidth;
      const vpH = vp.offsetHeight;
      const scale  = Math.max(vpW / img.width, vpH / img.height);
      cropDisplayW = img.width  * scale;
      cropDisplayH = img.height * scale;
      cropOffX = (vpW - cropDisplayW) / 2;
      cropOffY = (vpH - cropDisplayH) / 2;
      const el = document.getElementById('cropImgEl');
      el.src = src;
      el.style.width  = cropDisplayW + 'px';
      el.style.height = cropDisplayH + 'px';
      applyCropOffset();
    });
  };
  img.src = src;
}

function applyCropOffset() {
  const vp  = document.getElementById('cropViewport');
  const vpW = vp.offsetWidth;
  const vpH = vp.offsetHeight;
  cropOffX = Math.min(0, Math.max(vpW - cropDisplayW, cropOffX));
  cropOffY = Math.min(0, Math.max(vpH - cropDisplayH, cropOffY));
  const el = document.getElementById('cropImgEl');
  el.style.left = cropOffX + 'px';
  el.style.top  = cropOffY + 'px';
}

function cropPointerDown(e) {
  cropDragging = true;
  const pt = e.touches ? e.touches[0] : e;
  cropDragX   = pt.clientX;
  cropDragY   = pt.clientY;
  cropStartOX = cropOffX;
  cropStartOY = cropOffY;
  e.preventDefault();
}

function cropPointerMove(e) {
  if (!cropDragging) return;
  const pt = e.touches ? e.touches[0] : e;
  cropOffX = cropStartOX + (pt.clientX - cropDragX);
  cropOffY = cropStartOY + (pt.clientY - cropDragY);
  applyCropOffset();
  e.preventDefault();
}

function cropPointerUp() { cropDragging = false; }

function confirmCrop() {
  const vp    = document.getElementById('cropViewport');
  const vpW   = vp.offsetWidth;
  const vpH   = vp.offsetHeight;
  const scale = Math.max(vpW / cropImg.width, vpH / cropImg.height);
  const srcX  = -cropOffX / scale;
  const srcY  = -cropOffY / scale;
  const srcW  = vpW / scale;
  const srcH  = vpH / scale;

  const OUT    = 600;
  const canvas = document.createElement('canvas');
  canvas.width = OUT; canvas.height = OUT;
  canvas.getContext('2d').drawImage(cropImg, srcX, srcY, srcW, srcH, 0, 0, OUT, OUT);

  photoData = canvas.toDataURL('image/jpeg', 0.82);
  showPhotoPreview(photoData);
  document.getElementById('photoHint').classList.remove('show');
  document.getElementById('modalCrop').classList.add('hidden');
  document.getElementById('fFoto').value = '';
}

function closeCropModal() {
  document.getElementById('modalCrop').classList.add('hidden');
  document.getElementById('fFoto').value = '';
  cropImg = null;
}

// ── Upload foto ke Supabase Storage ────────────
async function uploadPhoto(base64Data) {
  try {
    const res  = await fetch(base64Data);
    const blob = await res.blob();
    const path = `${currentUser.id}/${Date.now()}.jpg`;

    const { error } = await db.storage
      .from('photos')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

    if (error) { showToast('Gagal upload foto'); return null; }

    const { data } = db.storage.from('photos').getPublicUrl(path);
    return data.publicUrl;
  } catch {
    showToast('Gagal memproses foto');
    return null;
  }
}

// ── Save item ──────────────────────────────────
let isSaving = false;
async function saveItem(e) {
  e.preventDefault();
  if (isSaving) return;

  if (!photoData) {
    document.getElementById('photoHint').classList.add('show');
    return;
  }

  const kategori = document.getElementById('fKategori').value;
  const catatan  = document.getElementById('fCatatan').value.trim();
  if (!kategori || kategori === '__new__') return;

  isSaving = true;
  showLoading(true);

  // Upload foto baru jika base64; jika URL berarti tidak berubah
  let foto_url = photoData;
  try {
    if (photoData.startsWith('data:')) {
      foto_url = await uploadPhoto(photoData);
      if (!foto_url) { showLoading(false); isSaving = false; return; }
    }

    if (editingId) {
      const { error } = await db
        .from('items')
        .update({ foto_url, kategori, catatan })
        .eq('id', editingId)
        .eq('user_id', currentUser.id);

      if (error) { showToast('Gagal menyimpan'); return; }
      const idx = items.findIndex(i => i.id === editingId);
      if (idx !== -1) items[idx] = { ...items[idx], foto_url, kategori, catatan };
    } else {
      const { error } = await db
        .from('items')
        .insert({ user_id: currentUser.id, foto_url, kategori, catatan, arsip: false });

      if (error) { showToast('Gagal menyimpan'); return; }
      await loadItems();
    }

    renderHome();
    renderArsip();
    closeForm();
    showToast('Tersimpan!');
  } finally {
    showLoading(false);
    isSaving = false;
  }
}

// ── Delete item ────────────────────────────────
async function deleteItem(id) {
  showLoading(true);
  const { error } = await db
    .from('items')
    .delete()
    .eq('id', id)
    .eq('user_id', currentUser.id);

  showLoading(false);
  if (error) { showToast('Gagal menghapus'); return; }

  items = items.filter(i => i.id !== id);
  renderHome();
  renderArsip();
  closeDetail();
  showToast('Pakaian dihapus');
}

// ── Category management ────────────────────────
async function addCategory(name) {
  name = name.trim();
  if (!name) return false;
  if (categories.includes(name)) { showToast('Kategori sudah ada'); return false; }
  const { error } = await db
    .from('categories')
    .insert({ user_id: currentUser.id, name });
  if (error) { showToast('Gagal menambah kategori'); return false; }
  categories.push(name);
  return true;
}

async function addArsipCategory(name) {
  name = name.trim();
  if (!name) return false;
  if (arsipCats.includes(name)) { showToast('Kategori sudah ada'); return false; }
  const { error } = await db
    .from('arsip_categories')
    .insert({ user_id: currentUser.id, name });
  if (error) { showToast('Gagal menambah kategori'); return false; }
  arsipCats.push(name);
  return true;
}

// ── Navigation ─────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelector(`[data-screen="${id}"]`).classList.add('active');
  document.getElementById('fabBtn').style.display = id === 'screenHome' ? 'flex' : 'none';
  if (id === 'screenArsip') renderArsip();
}

// ── Profile ────────────────────────────────────
function loadProfileUI() {
  ['Tinggi','Berat','Dada','Pinggang','Pinggul','Lengan'].forEach(k => {
    const el  = document.getElementById('p' + k);
    const val = profile[k.toLowerCase()];
    if (el && val) el.value = val;
  });
  updateDiagram();
}

function updateDiagram() {
  const set = (id, val, unit) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = val ? `${val} <span>${unit}</span>` : `— <span>${unit}</span>`;
  };
  set('diagDada',     profile.dada,     'cm');
  set('diagPinggang', profile.pinggang, 'cm');
  set('diagPinggul',  profile.pinggul,  'cm');
}

async function saveProfileForm(e) {
  e.preventDefault();
  const newProfile = {
    tinggi:   parseFloat(document.getElementById('pTinggi').value)   || null,
    berat:    parseFloat(document.getElementById('pBerat').value)    || null,
    dada:     parseFloat(document.getElementById('pDada').value)     || null,
    pinggang: parseFloat(document.getElementById('pPinggang').value) || null,
    pinggul:  parseFloat(document.getElementById('pPinggul').value)  || null,
    lengan:   parseFloat(document.getElementById('pLengan').value)   || null,
  };

  showLoading(true);
  const { error } = await db
    .from('profiles')
    .upsert({ id: currentUser.id, ...newProfile, updated_at: new Date().toISOString() });
  showLoading(false);

  if (error) { showToast('Gagal menyimpan'); return; }
  profile = newProfile;
  updateDiagram();
  showToast('Ukuran tersimpan!');
}

// ── Loading indicator ──────────────────────────
function showLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('hidden', !show);
}

// ── Splash ─────────────────────────────────────
function initSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  setTimeout(() => {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 500);
  }, 1600);
}

// ── Toast ──────────────────────────────────────
function showToast(msg) {
  const old = document.getElementById('toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.id = 'toast'; t.textContent = msg; t.style.opacity = '0';
  document.getElementById('mainApp').appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; });
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2000);
}

// ── Helpers ────────────────────────────────────
function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
}

// ── Init events ────────────────────────────────
function initEvents() {
  document.getElementById('btnLoginGoogle').addEventListener('click', loginWithGoogle);
  document.getElementById('btnLogout').addEventListener('click', logout);

  document.querySelectorAll('.nav-btn').forEach(b =>
    b.addEventListener('click', () => showScreen(b.dataset.screen)));

  document.getElementById('fabBtn').addEventListener('click', () => openForm());

  document.getElementById('clothesForm').addEventListener('submit', saveItem);
  document.getElementById('formClose').addEventListener('click', closeForm);
  document.getElementById('modalForm').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeForm();
  });

  document.getElementById('fFoto').addEventListener('change', handlePhotoChange);
  document.getElementById('photoRemove').addEventListener('click', e => {
    e.stopPropagation();
    photoData = null;
    resetPhotoUI();
  });

  const vp = document.getElementById('cropViewport');
  vp.addEventListener('mousedown',  cropPointerDown);
  vp.addEventListener('mousemove',  cropPointerMove);
  vp.addEventListener('mouseup',    cropPointerUp);
  vp.addEventListener('mouseleave', cropPointerUp);
  vp.addEventListener('touchstart', cropPointerDown, { passive: false });
  vp.addEventListener('touchmove',  cropPointerMove, { passive: false });
  vp.addEventListener('touchend',   cropPointerUp);
  document.getElementById('cropConfirmBtn').addEventListener('click', confirmCrop);
  document.getElementById('cropCancelBtn').addEventListener('click', closeCropModal);
  document.getElementById('cropCancel').addEventListener('click', closeCropModal);

  document.getElementById('fKategori').addEventListener('change', e => {
    if (e.target.value === '__new__') {
      e.target.value = '';
      document.getElementById('newKatRow').classList.remove('hidden');
      document.getElementById('fNewKat').focus();
    } else {
      document.getElementById('newKatRow').classList.add('hidden');
    }
  });

  document.getElementById('saveNewKat').addEventListener('click', async () => {
    const name = document.getElementById('fNewKat').value;
    if (await addCategory(name)) {
      buildCategoryOptions();
      document.getElementById('fKategori').value = name;
      document.getElementById('newKatRow').classList.add('hidden');
      document.getElementById('fNewKat').value = '';
    }
  });

  document.getElementById('detailClose').addEventListener('click', closeDetail);
  document.getElementById('modalDetail').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDetail();
  });

  document.getElementById('arsipkanClose').addEventListener('click', closeArsipkan);
  document.getElementById('modalArsipkan').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeArsipkan();
  });
  document.getElementById('addArsipCatInline').addEventListener('click', () => {
    document.getElementById('newArsipCatRow').classList.remove('hidden');
    document.getElementById('fNewArsipCat').focus();
  });
  document.getElementById('saveNewArsipCat').addEventListener('click', async () => {
    const name = document.getElementById('fNewArsipCat').value;
    if (await addArsipCategory(name)) {
      document.getElementById('fNewArsipCat').value = '';
      document.getElementById('newArsipCatRow').classList.add('hidden');
      renderArsipCatList();
    }
  });

  document.getElementById('addArsipCatBtn').addEventListener('click', () => {
    document.getElementById('fAddArsipCat').value = '';
    document.getElementById('modalAddArsipCat').classList.remove('hidden');
  });
  document.getElementById('addArsipCatClose').addEventListener('click', () => {
    document.getElementById('modalAddArsipCat').classList.add('hidden');
  });
  document.getElementById('modalAddArsipCat').addEventListener('click', e => {
    if (e.target === e.currentTarget)
      document.getElementById('modalAddArsipCat').classList.add('hidden');
  });
  document.getElementById('confirmAddArsipCat').addEventListener('click', async () => {
    const name = document.getElementById('fAddArsipCat').value;
    if (await addArsipCategory(name)) {
      document.getElementById('modalAddArsipCat').classList.add('hidden');
      showToast(`Kategori "${name}" ditambahkan`);
      renderArsip();
    }
  });

  document.getElementById('profileForm').addEventListener('submit', saveProfileForm);

  ['pDada','pPinggang','pPinggul'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      profile.dada     = document.getElementById('pDada').value;
      profile.pinggang = document.getElementById('pPinggang').value;
      profile.pinggul  = document.getElementById('pPinggul').value;
      updateDiagram();
    });
  });
}

// ── Auth state handler ─────────────────────────
let sessionHandled = false;

async function handleSession(session) {
  if (session?.user) {
    currentUser = session.user;
    updateUserInfo(currentUser);
    showMainApp();
    if (!sessionHandled) initSplash();
    sessionHandled = true;
    await loadAllData();
  } else {
    currentUser = null;
    sessionHandled = false;
    items = []; categories = []; arsipCats = []; profile = {};
    showLoginScreen();
  }
}

// ── Init ───────────────────────────────────────
async function init() {
  initEvents();
  showLoading(true);

  // Dengarkan perubahan auth — SEBELUM getSession agar tidak ada event yang terlewat
  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && !sessionHandled) await handleSession(session);
    if (event === 'SIGNED_OUT') await handleSession(null);
    if (event === 'TOKEN_REFRESHED') {
      currentUser = session?.user || null;
      if (currentUser) updateUserInfo(currentUser);
    }
  });

  // Cek sesi dengan timeout 5 detik — jika token refresh hanging, paksa login
  const sessionResult = await Promise.race([
    db.auth.getSession(),
    new Promise(resolve => setTimeout(() => resolve({ data: { session: null }, timedOut: true }), 5000)),
  ]);

  if (sessionResult.timedOut) {
    await db.auth.signOut();
    showLoginScreen();
  } else if (!sessionHandled) {
    await handleSession(sessionResult.data.session);
  }
}

init();

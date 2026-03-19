// B_MAK — Dual Mode App (Telegram Mini App + Web)
const API_BASE = '';

let state = {
  user: null,
  mode: 'unknown', // 'telegram' | 'web'
  webUid: null,
  config: null,
  refData: null,
  currentTab: 'home',
};

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);

async function init() {
  // Detect mode: only trust Telegram if there's a real user object with an ID
  const tg = window.Telegram?.WebApp;
  const tgUserId = tg?.initDataUnsafe?.user?.id;
  const hasTelegramData = !!(tg && tgUserId);

  if (hasTelegramData) {
    state.mode = 'telegram';
    tg.ready();
    tg.expand();
    await initTelegram(tg);
  } else {
    state.mode = 'web';
    if (tg) { try { tg.ready(); } catch(e) {} }
    await initWeb();
  }
}

// ─── Telegram Init ─────────────────────────────────────────────────────────────
async function initTelegram(tg) {
  const refCode = new URLSearchParams(window.location.search).get('ref') || '';

  try {
    const cfg = await apiFetch('/api/config');
    state.config = cfg;
  } catch (e) {}

  try {
    const data = await apiFetch('/api/users/auth', 'POST', {
      initData: tg.initData || '',
      referralCode: refCode,
      user: tg.initDataUnsafe?.user || null,
    });
    if (data.user) {
      state.user = data.user;
      finishInit();
    }
  } catch (e) {
    console.error('[TG Auth]', e);
    showSplashError('Connection error. Please try again.');
  }
}

// ─── Web Init ─────────────────────────────────────────────────────────────────
async function initWeb() {
  try {
    const cfg = await apiFetch('/api/config');
    state.config = cfg;
  } catch (e) {}

  // Check for existing session in localStorage
  const savedWebUid = localStorage.getItem('bmak_web_uid');

  if (savedWebUid) {
    try {
      const data = await apiFetch('/api/users/web-session', 'POST', { webUid: savedWebUid });
      if (data.user) {
        state.user = data.user;
        state.webUid = savedWebUid;
        finishInit();
        return;
      }
    } catch (e) {
      // Session expired or invalid — clear it
      localStorage.removeItem('bmak_web_uid');
    }
  }

  // No valid session — show web login after splash delay
  showWebLogin();
}

function showWebLogin() {
  const splash = document.getElementById('splash');
  const overlay = document.getElementById('web-login-overlay');
  const delay = splash && !splash.classList.contains('hidden') ? 1400 : 0;

  setTimeout(() => {
    if (splash) splash.classList.add('hidden');
    if (overlay) overlay.classList.remove('hidden');
    const refCode = new URLSearchParams(window.location.search).get('ref') || '';
    const inp = document.getElementById('wl-name-input');
    if (inp) {
      if (refCode) inp.dataset.ref = refCode;
      inp.focus();
    }
  }, delay);
}

// ─── Web Login Submit ─────────────────────────────────────────────────────────
async function submitWebLogin() {
  const input = document.getElementById('wl-name-input');
  const btn = document.getElementById('wl-submit-btn');
  const errEl = document.getElementById('wl-error');
  const name = input.value.trim();

  errEl.classList.add('hidden');
  if (name.length < 2) {
    errEl.textContent = 'Please enter at least 2 characters';
    errEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Creating account...';

  const refCode = input.dataset.ref || new URLSearchParams(window.location.search).get('ref') || '';

  try {
    const data = await apiFetch('/api/users/web-register', 'POST', {
      displayName: name,
      referralCode: refCode,
    });
    if (data.user && data.webUid) {
      localStorage.setItem('bmak_web_uid', data.webUid);
      state.user = data.user;
      state.webUid = data.webUid;
      document.getElementById('web-login-overlay').classList.add('hidden');
      finishInit(true);
    }
  } catch (e) {
    errEl.textContent = 'Registration failed. Please try again.';
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = '🚀 Get Started';
  }
}

// Allow Enter key in web login
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('wl-name-input');
  if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitWebLogin(); });
});

// ─── Finish Init (show main app) ──────────────────────────────────────────────
async function finishInit(skipSplash = false) {
  if (!skipSplash) {
    // Wait for splash animation
    await new Promise(r => setTimeout(r, 1400));
  }

  document.getElementById('splash').classList.add('hidden');
  document.getElementById('web-login-overlay').classList.add('hidden');
  document.getElementById('main').classList.remove('hidden');

  renderUser();
  renderModeUI();

  if (state.config) {
    const el = document.getElementById('contract-addr');
    if (el) el.textContent = state.config.contractAddress ? shorten(state.config.contractAddress) : 'Not deployed';
  }

  await Promise.all([loadTransactions(), loadReferrals()]);
}

// ─── Render Mode UI ────────────────────────────────────────────────────────────
function renderModeUI() {
  const badge = document.getElementById('mode-badge');
  const avatarMini = document.getElementById('header-avatar');

  if (state.mode === 'telegram') {
    badge.textContent = 'Telegram';
    badge.className = 'mode-badge tg';
    if (avatarMini) avatarMini.style.display = 'none';
  } else {
    badge.textContent = 'Web';
    badge.className = 'mode-badge web';
    if (avatarMini) avatarMini.style.display = 'flex';
  }

  // Web users see profile menu on avatar click
  const pmName = document.getElementById('pm-name');
  const pmType = document.getElementById('pm-type');
  if (pmName) pmName.textContent = state.user?.display_name || state.user?.first_name || 'User';
  if (pmType) pmType.textContent = state.mode === 'telegram' ? '📱 Telegram Account' : '🌐 Web Account';
}

// ─── Render User ──────────────────────────────────────────────────────────────
function renderUser() {
  const u = state.user;
  if (!u) return;

  const bal = parseFloat(u.bmak_balance || 0).toFixed(2);
  const earned = parseFloat(u.total_earned || 0).toFixed(2);
  const name = u.display_name || u.first_name || u.username || 'User';
  const today = new Date().toISOString().split('T')[0];
  const lastCheckin = u.last_checkin ? new Date(u.last_checkin).toISOString().split('T')[0] : null;
  const checkedIn = lastCheckin === today;

  // Header
  el('header-balance').textContent = fmtNum(bal);
  el('header-avatar').textContent = name.charAt(0).toUpperCase();

  // Hero
  el('greeting').textContent = `Hey, ${name}! 👋`;
  el('hero-balance').textContent = fmtNum(bal, 2);
  el('total-earned').textContent = fmtNum(earned, 2);
  el('streak-val').textContent = u.checkin_streak || 0;
  el('refs-val').textContent = u.total_referrals || 0;
  el('checkin-status').textContent = checkedIn ? '✅ Done' : '⏳ Ready';

  // Wallet tab
  el('wallet-balance').textContent = `${fmtNum(bal, 2)} BMAK`;
  el('bmak-asset-bal').textContent = fmtNum(bal, 2);
  if (u.wallet_address) {
    el('wallet-addr-display').textContent = shorten(u.wallet_address);
    el('receive-addr-text').textContent = u.wallet_address;
  }

  // Checkin button
  const btn = el('checkin-btn');
  const btnText = el('checkin-btn-text');
  if (checkedIn) {
    btn.disabled = true;
    btnText.textContent = '✓ Done Today';
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    const diff = next - Date.now();
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    el('streak-info').textContent = `🕐 Next check-in in ${hrs}h ${mins}m`;
  } else {
    btn.disabled = false;
    btnText.textContent = 'Check In +100';
    el('streak-info').textContent = '';
  }

  // Referral tab
  el('ref-code').textContent = u.referral_code || '—';
  el('ref-count').textContent = u.total_referrals || 0;
  el('ref-earned').textContent = ((u.total_referrals || 0) * 50).toLocaleString();

  // Milestones
  updateMilestone('7', u.checkin_streak || 0, 7);
  updateMilestone('14', u.checkin_streak || 0, 14);
  updateMilestone('30', u.checkin_streak || 0, 30);

  // Profile menu
  const pmName = el('pm-name');
  if (pmName) pmName.textContent = name;
}

function updateMilestone(id, streak, target) {
  const fill = el(`ms-fill-${id}`);
  const card = el(`ms-${id}`);
  const pct = Math.min((streak / target) * 100, 100);
  if (fill) fill.style.width = `${pct}%`;
  if (card && streak >= target) card.classList.add('ms-done');
}

// ─── Check-in ─────────────────────────────────────────────────────────────────
async function doCheckin() {
  if (!state.user) return showToast('Please wait...');

  const btn = el('checkin-btn');
  const btnText = el('checkin-btn-text');
  btn.disabled = true;
  btnText.textContent = '⏳ Claiming...';

  try {
    const data = await apiFetch('/api/rewards/checkin', 'POST', {
      userId: state.user.id,
    });

    if (data.success) {
      state.user = data.user;
      renderUser();
      const msg = data.bonusMessage
        ? `+${data.reward} BMAK! ${data.bonusMessage}`
        : `+${data.reward} BMAK! Day ${data.streak} streak! 🔥`;
      showToast(msg, 'green');
      await loadTransactions();
    } else {
      showToast(data.message || 'Already checked in today!');
      btn.disabled = true;
      btnText.textContent = '✓ Done Today';
    }
  } catch (e) {
    console.error('[Checkin]', e);
    showToast('Error. Please try again.');
    btn.disabled = false;
    btnText.textContent = 'Check In +100';
  }
}

// ─── Transactions ─────────────────────────────────────────────────────────────
const TX_ICONS = { checkin: '📅', referral: '👥', send: '↑', receive: '↓' };
const TX_LABELS = { checkin: 'Daily Reward', referral: 'Referral Bonus', send: 'Sent', receive: 'Received' };

async function loadTransactions() {
  if (!state.user) return;
  try {
    const data = await apiFetch(`/api/transactions/${state.user.id}?limit=50`);
    renderTransactions(data.transactions || []);
  } catch (e) {}
}

function renderTransactions(txs) {
  const html = txs.length === 0 ? '' : txs.map(tx => {
    const isSend = tx.type === 'send';
    const amt = parseFloat(tx.amount);
    const sign = isSend ? '-' : '+';
    const cls = isSend ? 'neg' : 'pos';
    return `<div class="tx-row">
      <div class="tx-ico ${tx.type}">${TX_ICONS[tx.type] || '💎'}</div>
      <div class="tx-info">
        <div class="tx-type">${TX_LABELS[tx.type] || tx.type}</div>
        <div class="tx-desc">${tx.description || ''}</div>
      </div>
      <div>
        <div class="tx-amt ${cls}">${sign}${amt.toLocaleString()} BMAK</div>
        <div class="tx-time">${formatTime(tx.created_at)}</div>
      </div>
    </div>`;
  }).join('');

  const emptyHtml = '<div class="empty-state">No activity yet.<br/>Complete your first check-in!</div>';
  el('recent-txs').innerHTML = html || emptyHtml;
  el('all-txs').innerHTML = html;
  const emptyEl = el('tx-empty');
  if (emptyEl) emptyEl.classList.toggle('hidden', txs.length > 0);
}

// ─── Referrals ────────────────────────────────────────────────────────────────
async function loadReferrals() {
  if (!state.user) return;
  try {
    const data = await apiFetch(`/api/rewards/referrals/${state.user.id}`);
    state.refData = data;
    renderReferrals(data);
  } catch (e) {}
}

function renderReferrals(data) {
  // Show both links
  const box = document.getElementById('share-links-box');
  const webUrl = document.getElementById('sl-web-url');
  const tgUrl = document.getElementById('sl-tg-url');

  if (data.webReferralLink && box) {
    box.style.display = 'flex';
    if (webUrl) webUrl.textContent = data.webReferralLink;
    if (tgUrl) tgUrl.textContent = data.referralLink;
  }

  const list = el('ref-list');
  if (!list) return;

  if (!data.referrals || data.referrals.length === 0) {
    list.innerHTML = '<div class="empty-state">Invite friends to see them here! 👥</div>';
    return;
  }

  list.innerHTML = data.referrals.map(r => {
    const name = r.username ? `@${r.username}` : (r.display_name || r.first_name || 'Friend');
    return `<div class="ref-row">
      <div class="ref-avatar">👤</div>
      <div>
        <div class="ref-name">${name}</div>
        <div class="ref-date">${formatTime(r.created_at)}</div>
      </div>
      <div class="ref-bonus">+50 BMAK</div>
    </div>`;
  }).join('');
}

function copyWebRefLink() {
  const url = document.getElementById('sl-web-url')?.textContent;
  if (url) { navigator.clipboard.writeText(url).catch(() => {}); showToast('Web link copied! 🌐'); }
}

function copyTgRefLink() {
  const url = document.getElementById('sl-tg-url')?.textContent;
  if (url) { navigator.clipboard.writeText(url).catch(() => {}); showToast('Telegram link copied! 📱'); }
}

// ─── Wallet ───────────────────────────────────────────────────────────────────
function showConnectWallet() { el('wallet-modal').classList.remove('hidden'); }
function showSend() {
  if (!state.user?.wallet_address) return showToast('Connect wallet first');
  el('send-modal').classList.remove('hidden');
}
function showReceive() {
  if (!state.user?.wallet_address) return showToast('Connect wallet first');
  el('receive-modal').classList.remove('hidden');
}
function closeModal(id) { el(id).classList.add('hidden'); }

async function saveWallet() {
  const addr = el('wallet-input').value.trim();
  if (!addr.startsWith('0x') || addr.length !== 42) {
    return showToast('Enter a valid BSC address (0x...)');
  }
  try {
    await apiFetch('/api/users/wallet', 'POST', { userId: state.user.id, walletAddress: addr });
    state.user.wallet_address = addr;
    el('wallet-addr-display').textContent = shorten(addr);
    el('receive-addr-text').textContent = addr;
    closeModal('wallet-modal');
    showToast('Wallet connected! ✓', 'green');
  } catch (e) { showToast('Error saving wallet'); }
}

function confirmSend() {
  const addr = el('send-addr').value.trim();
  const amt = el('send-amount').value.trim();
  if (!addr || !amt) return showToast('Fill in all fields');
  closeModal('send-modal');
  showToast(`Transaction initiated for ${amt} BMAK`);
}

function copyAddress() {
  const addr = state.user?.wallet_address;
  if (addr) { navigator.clipboard.writeText(addr).catch(() => {}); showToast('Address copied! 📋'); }
}

// ─── Referral Share ───────────────────────────────────────────────────────────
function copyRefCode() {
  const code = state.user?.referral_code;
  if (code) { navigator.clipboard.writeText(code).catch(() => {}); showToast('Referral code copied! 📋'); }
}

function shareRef() {
  const data = state.refData;
  if (!data) return;

  if (state.mode === 'telegram' && window.Telegram?.WebApp) {
    const link = data.referralLink;
    const text = `🌟 Join B_MAK Mini App and earn BMAK tokens every day!\n\nUse my link:\n${link}`;
    window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
  } else {
    const link = data.webReferralLink || data.referralLink;
    const text = `🌟 Join B_MAK and earn BMAK tokens daily!\n\n${link}`;
    if (navigator.share) {
      navigator.share({ title: 'B_MAK Blockchain Rewards', text, url: link }).catch(() => {});
    } else {
      navigator.clipboard.writeText(link).catch(() => {});
      showToast('Referral link copied! 🔗');
    }
  }
}

// ─── Profile Menu (web) ───────────────────────────────────────────────────────
function showProfileMenu() {
  if (state.mode === 'telegram') return;
  el('profile-menu').classList.toggle('hidden');
}
function closeProfileMenu() { el('profile-menu').classList.add('hidden'); }

function logoutWeb() {
  localStorage.removeItem('bmak_web_uid');
  closeProfileMenu();
  showToast('Logged out. Reloading...');
  setTimeout(() => window.location.reload(), 1000);
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(e => e.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
  el(`tab-${tab}`).classList.remove('hidden');
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
  closeProfileMenu();
  state.currentTab = tab;
  if (tab === 'history') loadTransactions();
  if (tab === 'referral') loadReferrals();
}

// ─── Utilities ────────────────────────────────────────────────────────────────
async function apiFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function el(id) { return document.getElementById(id); }

function shorten(addr) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function fmtNum(n, decimals = 0) {
  const num = parseFloat(n) || 0;
  return decimals > 0
    ? num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : num.toLocaleString();
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

function showSplashError(msg) {
  const splash = el('splash');
  if (splash) {
    splash.innerHTML = `<div style="text-align:center;padding:20px">
      <div style="font-size:48px;margin-bottom:16px">⚠️</div>
      <div style="color:#ef4444;font-weight:700;margin-bottom:8px">${msg}</div>
      <button onclick="location.reload()" style="background:#8b5cf6;color:#fff;border:none;padding:10px 24px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:700">Retry</button>
    </div>`;
  }
}

let toastTimer;
function showToast(msg) {
  const e = el('toast');
  e.textContent = msg;
  e.className = 'toast';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => e.classList.add('hidden'), 3000);
}

// Close profile menu when clicking outside
document.addEventListener('click', (e) => {
  const menu = el('profile-menu');
  const avatar = el('header-avatar');
  if (menu && !menu.classList.contains('hidden')) {
    if (!menu.contains(e.target) && e.target !== avatar) closeProfileMenu();
  }
});

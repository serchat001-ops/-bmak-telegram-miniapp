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
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref') || '';
    const resetToken = params.get('reset') || '';
    const inp = document.getElementById('wl-name-input');
    if (inp && refCode) inp.dataset.ref = refCode;
    if (resetToken) {
      showResetPassword();
    } else {
      const loginInp = document.getElementById('wl-login-email');
      if (loginInp) loginInp.focus();
    }
  }, delay);
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('wl-login-form');
  const registerForm = document.getElementById('wl-register-form');
  const forgotForm = document.getElementById('wl-forgot-form');
  const resetForm = document.getElementById('wl-reset-form');
  const loginBtn = document.getElementById('tab-login-btn');
  const registerBtn = document.getElementById('tab-register-btn');
  const tabsBar = document.querySelector('.wl-tabs');

  forgotForm?.classList.add('hidden');
  resetForm?.classList.add('hidden');
  if (tabsBar) tabsBar.style.display = '';

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    loginBtn.classList.add('active');
    registerBtn.classList.remove('active');
    document.getElementById('wl-login-email')?.focus();
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    loginBtn.classList.remove('active');
    registerBtn.classList.add('active');
    document.getElementById('wl-register-email')?.focus();
  }
}

function showForgotPassword() {
  document.getElementById('wl-login-form').classList.add('hidden');
  document.getElementById('wl-register-form').classList.add('hidden');
  document.getElementById('wl-reset-form').classList.add('hidden');
  document.getElementById('wl-forgot-form').classList.remove('hidden');
  const tabsBar = document.querySelector('.wl-tabs');
  if (tabsBar) tabsBar.style.display = 'none';
  document.getElementById('wl-forgot-email')?.focus();
}

function showResetPassword() {
  document.getElementById('wl-login-form').classList.add('hidden');
  document.getElementById('wl-register-form').classList.add('hidden');
  document.getElementById('wl-forgot-form').classList.add('hidden');
  document.getElementById('wl-reset-form').classList.remove('hidden');
  const tabsBar = document.querySelector('.wl-tabs');
  if (tabsBar) tabsBar.style.display = 'none';
  document.getElementById('wl-reset-password')?.focus();
}

async function submitForgotPassword() {
  const emailInput = document.getElementById('wl-forgot-email');
  const btn = document.getElementById('wl-forgot-btn');
  const errEl = document.getElementById('wl-forgot-error');
  const okEl = document.getElementById('wl-forgot-success');
  const email = emailInput.value.trim();
  errEl.classList.add('hidden');
  okEl.classList.add('hidden');
  if (!email || !email.includes('@')) {
    errEl.textContent = 'Veuillez entrer une adresse email valide';
    errEl.classList.remove('hidden');
    return;
  }
  btn.disabled = true;
  btn.textContent = '⏳ Envoi...';
  try {
    const data = await apiFetch('/api/users/forgot-password', 'POST', { email });
    okEl.textContent = data.message || '📧 Email envoyé ! Vérifiez votre boîte de réception (et les spams).';
    okEl.classList.remove('hidden');
    btn.textContent = '✅ Envoyé';
  } catch (e) {
    errEl.textContent = e?.data?.error || 'Erreur lors de l\'envoi';
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = '📧 Envoyer le lien';
  }
}

async function submitResetPassword() {
  const p1 = document.getElementById('wl-reset-password').value;
  const p2 = document.getElementById('wl-reset-password2').value;
  const btn = document.getElementById('wl-reset-btn');
  const errEl = document.getElementById('wl-reset-error');
  const token = new URLSearchParams(window.location.search).get('reset') || '';
  errEl.classList.add('hidden');
  if (p1.length < 6) {
    errEl.textContent = 'Le mot de passe doit contenir au moins 6 caractères';
    errEl.classList.remove('hidden');
    return;
  }
  if (p1 !== p2) {
    errEl.textContent = 'Les mots de passe ne correspondent pas';
    errEl.classList.remove('hidden');
    return;
  }
  btn.disabled = true;
  btn.textContent = '⏳ Mise à jour...';
  try {
    await apiFetch('/api/users/reset-password', 'POST', { token, newPassword: p1 });
    alert('✅ Mot de passe réinitialisé ! Vous pouvez vous connecter.');
    window.location.href = '/app/';
  } catch (e) {
    errEl.textContent = e?.data?.error || 'Erreur lors de la réinitialisation';
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = '🔐 Réinitialiser';
  }
}

// ─── Login Submit ─────────────────────────────────────────────────────────────
async function submitLogin() {
  const emailInput = document.getElementById('wl-login-email');
  const passInput = document.getElementById('wl-login-password');
  const btn = document.getElementById('wl-login-btn');
  const errEl = document.getElementById('wl-login-error');

  const email = emailInput.value.trim();
  const password = passInput.value;

  errEl.classList.add('hidden');

  if (!email || !email.includes('@')) {
    errEl.textContent = 'Veuillez entrer une adresse email valide';
    errEl.classList.remove('hidden');
    return;
  }
  if (!password) {
    errEl.textContent = 'Veuillez entrer votre mot de passe';
    errEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Connexion...';

  try {
    const data = await apiFetch('/api/users/web-login', 'POST', { email, password });
    if (data.user && data.webUid) {
      localStorage.setItem('bmak_web_uid', data.webUid);
      state.user = data.user;
      state.webUid = data.webUid;
      document.getElementById('web-login-overlay').classList.add('hidden');
      finishInit();
    }
  } catch (e) {
    const msg = e?.data?.error || 'Email ou mot de passe incorrect.';
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = '🔐 Se connecter';
  }
}

// ─── Register Submit ──────────────────────────────────────────────────────────
async function submitWebLogin() {
  const emailInput = document.getElementById('wl-register-email');
  const nameInput = document.getElementById('wl-name-input');
  const passInput = document.getElementById('wl-register-password');
  const pass2Input = document.getElementById('wl-register-password2');
  const btn = document.getElementById('wl-submit-btn');
  const errEl = document.getElementById('wl-error');

  const email = emailInput.value.trim();
  const name = nameInput.value.trim();
  const password = passInput.value;
  const password2 = pass2Input.value;

  errEl.classList.add('hidden');

  if (!email || !email.includes('@')) {
    errEl.textContent = 'Veuillez entrer une adresse email valide';
    errEl.classList.remove('hidden');
    return;
  }
  if (name.length < 2) {
    errEl.textContent = 'Le nom doit contenir au moins 2 caractères';
    errEl.classList.remove('hidden');
    return;
  }
  if (password.length < 6) {
    errEl.textContent = 'Le mot de passe doit contenir au moins 6 caractères';
    errEl.classList.remove('hidden');
    return;
  }
  if (password !== password2) {
    errEl.textContent = 'Les mots de passe ne correspondent pas';
    errEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Création du compte...';

  const refCode = nameInput.dataset.ref || new URLSearchParams(window.location.search).get('ref') || '';

  try {
    const data = await apiFetch('/api/users/web-register', 'POST', {
      email,
      displayName: name,
      password,
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
    const msg = e?.data?.error || 'Inscription échouée. Réessayez.';
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = '🚀 Créer mon compte';
  }
}

// Allow Enter key in forms
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('wl-login-email')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitLogin(); });
  document.getElementById('wl-login-password')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitLogin(); });
  document.getElementById('wl-register-password2')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitWebLogin(); });
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

  await Promise.all([loadTransactions(), loadReferrals(), loadNotifications()]);
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

  // Show admin button if this user is in the admin allowlist
  const adminBtn = document.getElementById('pm-admin-btn');
  const adminEmails = state.config?.adminEmails || (state.config?.adminEmail ? [state.config.adminEmail] : []);
  const userEmail = state.user?.email?.toLowerCase();
  if (adminBtn && userEmail && adminEmails.map(e => e.toLowerCase()).includes(userEmail)) {
    adminBtn.classList.remove('hidden');
  }
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

  // Reclaim button visibility (balance >= min and wallet present)
  const reclaimCard = el('reclaim-card');
  if (reclaimCard) {
    const min = state.config?.minReclaimAmount || 1500;
    const eligible = !!u.wallet_address && parseFloat(u.bmak_balance || 0) >= min;
    reclaimCard.classList.toggle('hidden', !eligible);
    const reclaimAmount = el('reclaim-amount');
    if (reclaimAmount) reclaimAmount.textContent = fmtNum(bal, 0);
  }

  // Re-apply balance mask after re-render
  if (state.balanceHidden) applyBalanceMask();
}

// ─── Reclamations ─────────────────────────────────────────────────────────────
async function doReclaim() {
  if (!state.user) return;
  const min = state.config?.minReclaimAmount || 1500;
  if (!state.user.wallet_address) return showToast('Connectez d\'abord votre wallet BSC');
  if (parseFloat(state.user.bmak_balance || 0) < min) return showToast(`Solde minimum : ${min} B_MAK`);
  if (!confirm(`Demander le transfert de ${fmtNum(state.user.bmak_balance, 0)} B_MAK vers ${shorten(state.user.wallet_address)} ?`)) return;
  const btn = el('reclaim-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Envoi...'; }
  try {
    await apiFetch('/api/reclamations', 'POST', {
      userId: state.user.id,
      webUid: localStorage.getItem('bmak_web_uid'),
    });
    showToast('Demande envoyée ! L\'admin la traitera bientôt.', 'green');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Demande en attente'; }
  } catch (e) {
    showToast(e.message || 'Erreur lors de la demande');
    if (btn) { btn.disabled = false; btn.textContent = '💰 Réclamer mes B_MAK'; }
  }
}

// ─── Notifications ────────────────────────────────────────────────────────────
async function loadNotifications() {
  if (!state.user) return;
  try {
    const data = await apiFetch(`/api/notifications/${state.user.id}`, 'GET');
    state.notifications = (data.notifications || []).filter(n => !n.read);
    const badge = el('notif-badge');
    if (badge) {
      const count = state.notifications.length;
      badge.textContent = count > 9 ? '9+' : count;
      badge.classList.toggle('hidden', count === 0);
    }
  } catch (e) {}
}

async function showNotifications() {
  await loadNotifications();
  const notifs = state.notifications || [];
  if (notifs.length === 0) return showToast('Aucune nouvelle notification');
  const msg = notifs.slice(0, 5).map(n =>
    `📬 ${n.title}\n${n.message}`
  ).join('\n\n');
  alert(msg);
  try {
    await apiFetch(`/api/notifications/${state.user.id}/read-all`, 'PATCH');
    state.notifications = [];
    const badge = el('notif-badge');
    if (badge) badge.classList.add('hidden');
  } catch (e) {}
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

// ─── MetaMask ─────────────────────────────────────────────────────────────────
async function connectMetaMask() {
  if (!window.ethereum) {
    if (/Mobi|Android/i.test(navigator.userAgent)) {
      const url = location.host + location.pathname;
      window.location.href = `https://metamask.app.link/dapp/${url}`;
      return;
    }
    return showToast('MetaMask non détecté. Installez l\'extension.');
  }
  const btn = el('metamask-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Connexion...'; }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts || !accounts[0]) throw new Error('Aucun compte');
    const addr = accounts[0];

    // Switch to BSC mainnet
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x38' }],
      });
    } catch (switchErr) {
      if (switchErr.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x38',
            chainName: 'BNB Smart Chain',
            nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
            rpcUrls: ['https://bsc-dataseed.binance.org/'],
            blockExplorerUrls: ['https://bscscan.com'],
          }],
        });
      }
    }

    await apiFetch('/api/users/wallet', 'POST', { userId: state.user.id, walletAddress: addr });
    state.user.wallet_address = addr;
    el('wallet-addr-display').textContent = shorten(addr);
    el('receive-addr-text').textContent = addr;
    showToast('🦊 MetaMask connecté !', 'green');
    await loadOnChainBalance();
    renderUser();
  } catch (e) {
    showToast(e.message || 'Connexion MetaMask refusée');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🦊 MetaMask'; }
  }
}

// ─── Hide/Show Balance ────────────────────────────────────────────────────────
state.balanceHidden = localStorage.getItem('bmak_balance_hidden') === '1';

function applyBalanceMask() {
  const hidden = state.balanceHidden;
  const eye = el('balance-eye');
  if (eye) eye.textContent = hidden ? '🙈' : '👁';
  const ids = ['header-balance', 'hero-balance', 'wallet-balance', 'bmak-asset-bal', 'bnb-bal', 'total-earned', 'reclaim-amount'];
  ids.forEach(id => {
    const node = el(id);
    if (!node) return;
    if (hidden) {
      if (!node.dataset.real) node.dataset.real = node.textContent;
      node.textContent = '••••';
    } else if (node.dataset.real) {
      node.textContent = node.dataset.real;
      delete node.dataset.real;
    }
  });
}

function toggleBalanceHidden() {
  state.balanceHidden = !state.balanceHidden;
  localStorage.setItem('bmak_balance_hidden', state.balanceHidden ? '1' : '0');
  // Clear stored values so renderUser writes fresh ones, then re-mask
  ['header-balance','hero-balance','wallet-balance','bmak-asset-bal','bnb-bal','total-earned','reclaim-amount'].forEach(id => {
    const n = el(id); if (n) delete n.dataset.real;
  });
  renderUser();
  loadOnChainBalance();
  applyBalanceMask();
}
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
    showToast('Wallet connecté ! ✓', 'green');
    await loadOnChainBalance();
  } catch (e) { showToast('Error saving wallet'); }
}

async function loadOnChainBalance() {
  const addr = state.user?.wallet_address;
  const bnbEl = el('bnb-bal');
  const bnbUsdEl = el('bnb-usd');
  const bmakAssetEl = el('bmak-asset-bal');
  const bmakUsdEl = bmakAssetEl ? bmakAssetEl.closest('.asset-right')?.querySelector('.asset-usd') : null;

  if (!addr) {
    if (bnbEl) bnbEl.textContent = '—';
    if (bnbUsdEl) bnbUsdEl.textContent = 'Connectez un wallet';
    return;
  }

  if (bnbEl) bnbEl.textContent = '⏳';
  if (bnbUsdEl) bnbUsdEl.textContent = 'Chargement...';

  try {
    const data = await apiFetch(`/api/wallet/balance/${addr}`);

    if (bnbEl) bnbEl.textContent = data.bnb !== null ? `${data.bnb} BNB` : '—';
    if (bnbUsdEl) bnbUsdEl.textContent = 'BNB Smart Chain';

    if (data.bmak !== null && bmakAssetEl) {
      bmakAssetEl.textContent = fmtNum(data.bmak, 4);
      if (bmakUsdEl) bmakUsdEl.textContent = 'On-chain (BSC)';
    }
    if (state.balanceHidden) applyBalanceMask();
  } catch (e) {
    if (bnbEl) bnbEl.textContent = '—';
    if (bnbUsdEl) bnbUsdEl.textContent = 'Erreur réseau';
  }
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

// ─── Change Password ──────────────────────────────────────────────────────────
function openChangePassword() {
  closeProfileMenu();
  ['old-pwd','new-pwd','new-pwd2'].forEach(id => { const n = el(id); if (n) n.value = ''; });
  el('change-pwd-error')?.classList.add('hidden');
  el('change-password-modal')?.classList.remove('hidden');
}

async function submitChangePassword() {
  const oldPwd = el('old-pwd').value;
  const newPwd = el('new-pwd').value;
  const newPwd2 = el('new-pwd2').value;
  const errEl = el('change-pwd-error');
  const showErr = (m) => { errEl.textContent = m; errEl.classList.remove('hidden'); };
  errEl.classList.add('hidden');

  if (!oldPwd || !newPwd || !newPwd2) return showErr('Tous les champs sont requis');
  if (newPwd.length < 6) return showErr('Le nouveau mot de passe doit contenir au moins 6 caractères');
  if (newPwd !== newPwd2) return showErr('Les deux nouveaux mots de passe ne correspondent pas');
  if (oldPwd === newPwd) return showErr('Le nouveau mot de passe doit être différent de l\'ancien');
  if (!state.user?.id) return showErr('Session invalide, reconnectez-vous');

  try {
    await apiFetch('/api/users/change-password', 'POST', {
      userId: state.user.id, oldPassword: oldPwd, newPassword: newPwd,
    });
    closeModal('change-password-modal');
    showToast('✅ Mot de passe modifié avec succès', 'green');
  } catch (e) {
    showErr(e.message || 'Erreur lors du changement');
  }
}
function goToAdmin() {
  closeProfileMenu();
  window.location.href = '/admin/';
}

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
  if (tab === 'wallet') loadOnChainBalance();
}

// ─── Utilities ────────────────────────────────────────────────────────────────
async function apiFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.data = data;
    throw err;
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

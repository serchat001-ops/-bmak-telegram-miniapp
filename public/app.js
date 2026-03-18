// B_MAK Mini App - Main Application

const API_BASE = '';

let state = {
  user: null,
  telegramUser: null,
  initData: '',
  config: null,
  currentTab: 'home',
};

// ─── Init ────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);

async function init() {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    state.initData = tg.initData || '';
    state.telegramUser = tg.initDataUnsafe?.user || null;
  }

  // Load app config from backend
  try {
    const cfg = await apiFetch('/api/config');
    state.config = cfg;
    document.getElementById('contract-addr').textContent =
      cfg.contractAddress ? shorten(cfg.contractAddress) : 'Not deployed';
  } catch(e) {}

  // Auth with backend
  const refCode = new URLSearchParams(window.location.search).get('ref') || '';
  try {
    const data = await apiFetch('/api/users/auth', 'POST', {
      initData: state.initData,
      referralCode: refCode,
      user: state.telegramUser,
    });
    if (data.user) {
      state.user = data.user;
      renderUser();
    }
  } catch (e) {
    console.error('[Auth]', e);
  }

  await Promise.all([
    loadTransactions(),
    loadReferrals(),
  ]);

  // Hide splash after 1.5s
  setTimeout(() => {
    document.getElementById('splash').classList.add('hidden');
    document.getElementById('main').classList.remove('hidden');
  }, 1500);
}

// ─── Render User ─────────────────────────────────────────────────────────────
function renderUser() {
  const u = state.user;
  if (!u) return;

  const bal = parseFloat(u.bmak_balance).toFixed(2);
  const earned = parseFloat(u.total_earned).toFixed(2);
  const name = u.first_name || u.username || 'User';
  const today = new Date().toISOString().split('T')[0];
  const checkedIn = u.last_checkin && new Date(u.last_checkin).toISOString().split('T')[0] === today;

  document.getElementById('header-balance').textContent = parseFloat(bal).toLocaleString();
  document.getElementById('hero-balance').textContent = parseFloat(bal).toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2});
  document.getElementById('total-earned').textContent = parseFloat(earned).toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2});
  document.getElementById('greeting').textContent = `Hey, ${name}! 👋`;
  document.getElementById('streak-val').textContent = u.checkin_streak || 0;
  document.getElementById('refs-val').textContent = u.total_referrals || 0;
  document.getElementById('checkin-status').textContent = checkedIn ? '✅ Done' : '⏳ Ready';

  document.getElementById('wallet-balance').textContent = `${parseFloat(bal).toLocaleString()} BMAK`;
  document.getElementById('bmak-asset-bal').textContent = parseFloat(bal).toLocaleString(undefined, {minimumFractionDigits:2});

  if (u.wallet_address) {
    document.getElementById('wallet-addr-display').textContent = shorten(u.wallet_address);
    document.getElementById('receive-addr-text').textContent = u.wallet_address;
  }

  // Checkin button state
  const btn = document.getElementById('checkin-btn');
  const btnText = document.getElementById('checkin-btn-text');
  if (checkedIn) {
    btn.disabled = true;
    btnText.textContent = '✓ Done Today';
    const nextCheckin = new Date();
    nextCheckin.setDate(nextCheckin.getDate() + 1);
    nextCheckin.setHours(0,0,0,0);
    const diff = nextCheckin - Date.now();
    const hrs = Math.floor(diff/3600000);
    const mins = Math.floor((diff%3600000)/60000);
    document.getElementById('streak-info').textContent = `🕐 Next check-in in ${hrs}h ${mins}m`;
  } else {
    btn.disabled = false;
    btnText.textContent = 'Check In +100';
  }

  // Referral
  document.getElementById('ref-code').textContent = u.referral_code || '—';
  document.getElementById('ref-count').textContent = u.total_referrals || 0;
  document.getElementById('ref-earned').textContent = ((u.total_referrals || 0) * 50).toLocaleString();

  // Streak milestones
  const streak = u.checkin_streak || 0;
  updateMilestone('7', streak, 7);
  updateMilestone('14', streak, 14);
  updateMilestone('30', streak, 30);
}

function updateMilestone(id, streak, target) {
  const fill = document.getElementById(`ms-fill-${id}`);
  const card = document.getElementById(`ms-${id}`);
  const pct = Math.min((streak / target) * 100, 100);
  if (fill) fill.style.width = `${pct}%`;
  if (card && streak >= target) card.classList.add('ms-done');
}

// ─── Check-in ────────────────────────────────────────────────────────────────
async function doCheckin() {
  if (!state.user) return showToast('Please wait, loading...');

  const btn = document.getElementById('checkin-btn');
  const btnText = document.getElementById('checkin-btn-text');
  btn.disabled = true;
  btnText.textContent = '⏳ Claiming...';

  try {
    const data = await apiFetch('/api/rewards/checkin', 'POST', {
      telegramId: state.user.telegram_id,
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
      btnText.textContent = '✓ Done Today';
    }
  } catch (e) {
    console.error('[Checkin]', e);
    showToast('Error claiming reward. Try again.');
    btn.disabled = false;
    btnText.textContent = 'Check In +100';
  }
}

// ─── Transactions ─────────────────────────────────────────────────────────────
const TX_ICONS = { checkin:'📅', referral:'👥', send:'↑', receive:'↓', default:'💎' };
const TX_LABELS = { checkin:'Daily Reward', referral:'Referral Bonus', send:'Sent', receive:'Received' };

async function loadTransactions() {
  if (!state.user) return;
  try {
    const data = await apiFetch(`/api/transactions/${state.user.telegram_id}?limit=50`);
    renderTransactions(data.transactions || []);
  } catch(e) {}
}

function renderTransactions(txs) {
  const recent = document.getElementById('recent-txs');
  const all = document.getElementById('all-txs');
  const empty = document.getElementById('tx-empty');

  const html = txs.length === 0 ? '' : txs.map(tx => {
    const isSend = tx.type === 'send';
    const amt = parseFloat(tx.amount);
    const sign = isSend ? '-' : '+';
    const cls = isSend ? 'neg' : 'pos';
    const ico = TX_ICONS[tx.type] || TX_ICONS.default;
    const lbl = TX_LABELS[tx.type] || tx.type;
    const time = formatTime(tx.created_at);
    return `<div class="tx-row">
      <div class="tx-ico ${tx.type}">${ico}</div>
      <div class="tx-info">
        <div class="tx-type">${lbl}</div>
        <div class="tx-desc">${tx.description || ''}</div>
      </div>
      <div>
        <div class="tx-amt ${cls}">${sign}${amt.toLocaleString()} BMAK</div>
        <div class="tx-time">${time}</div>
      </div>
    </div>`;
  }).join('');

  if (recent) recent.innerHTML = html || '<div class="empty-state">No activity yet</div>';
  if (all) all.innerHTML = html;
  if (empty) empty.classList.toggle('hidden', txs.length > 0);
}

// ─── Referrals ────────────────────────────────────────────────────────────────
async function loadReferrals() {
  if (!state.user) return;
  try {
    const data = await apiFetch(`/api/rewards/referrals/${state.user.telegram_id}`);
    const list = document.getElementById('ref-list');
    if (!list) return;

    if (!data.referrals || data.referrals.length === 0) {
      list.innerHTML = '<div class="empty-state">Invite friends to see them here! 👥</div>';
      return;
    }

    list.innerHTML = data.referrals.map(r => {
      const name = r.username ? `@${r.username}` : (r.first_name || 'Friend');
      return `<div class="ref-row">
        <div class="ref-avatar">👤</div>
        <div>
          <div class="ref-name">${name}</div>
          <div class="ref-date">${formatTime(r.created_at)}</div>
        </div>
        <div class="ref-bonus">+50 BMAK</div>
      </div>`;
    }).join('');
  } catch(e) {}
}

// ─── Wallet ───────────────────────────────────────────────────────────────────
function showConnectWallet() {
  document.getElementById('wallet-modal').classList.remove('hidden');
}
function showSend() {
  if (!state.user?.wallet_address) return showToast('Connect wallet first');
  document.getElementById('send-modal').classList.remove('hidden');
}
function showReceive() {
  if (!state.user?.wallet_address) return showToast('Connect wallet first');
  document.getElementById('receive-modal').classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

async function saveWallet() {
  const addr = document.getElementById('wallet-input').value.trim();
  if (!addr || (!addr.startsWith('0x') || addr.length !== 42)) {
    return showToast('Enter a valid BSC address (0x...)');
  }
  try {
    await apiFetch('/api/users/wallet', 'POST', {
      telegramId: state.user.telegram_id,
      walletAddress: addr,
    });
    state.user.wallet_address = addr;
    document.getElementById('wallet-addr-display').textContent = shorten(addr);
    document.getElementById('receive-addr-text').textContent = addr;
    closeModal('wallet-modal');
    showToast('Wallet connected! ✓', 'green');
  } catch(e) {
    showToast('Error saving wallet');
  }
}

function confirmSend() {
  const addr = document.getElementById('send-addr').value.trim();
  const amt = document.getElementById('send-amount').value.trim();
  if (!addr || !amt) return showToast('Fill in all fields');
  closeModal('send-modal');
  showToast(`Transaction initiated for ${amt} BMAK`);
}

function copyAddress() {
  const addr = state.user?.wallet_address;
  if (addr) {
    navigator.clipboard.writeText(addr).catch(() => {});
    showToast('Address copied! 📋');
  }
}

// ─── Referral Share ────────────────────────────────────────────────────────────
function copyRefCode() {
  const code = state.user?.referral_code;
  if (code) {
    navigator.clipboard.writeText(code).catch(() => {});
    showToast('Referral code copied! 📋');
  }
}

function shareRef() {
  const code = state.user?.referral_code;
  if (!code) return;
  const botUsername = 'bmak_miniapp_bot';
  const link = `https://t.me/${botUsername}?start=${code}`;
  const text = `🌟 Join B_MAK Mini App and earn BMAK tokens every day!\n\nUse my referral link:\n${link}`;

  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
  } else {
    navigator.clipboard.writeText(link).catch(() => {});
    showToast('Link copied to clipboard!');
  }
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  document.getElementById(`tab-${tab}`).classList.remove('hidden');
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');

  state.currentTab = tab;

  if (tab === 'history') loadTransactions();
  if (tab === 'referral') loadReferrals();
}

// ─── Utilities ────────────────────────────────────────────────────────────────
async function apiFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function shorten(addr) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0,6)}...${addr.slice(-4)}`;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff/86400000)}d ago`;
  return d.toLocaleDateString();
}

let toastTimer;
function showToast(msg, type = 'default') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

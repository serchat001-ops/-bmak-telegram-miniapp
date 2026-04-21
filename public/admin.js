// B_MAK Admin Panel
const API = '';

let adminState = {
  webUid: null,
  user: null,
  usersCurrentPage: 1,
  usersSearch: '',
  balanceTargetId: null,
  payoutTargetId: null,
  searchTimeout: null,
};

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const saved = localStorage.getItem('bmak_admin_uid');
  if (saved) {
    try {
      const data = await apiFetch('/api/users/web-session', 'POST', { webUid: saved });
      if (data.user) {
        const cfg = await apiFetch('/api/config').catch(() => ({}));
        const allowed = (cfg.adminEmails || (cfg.adminEmail ? [cfg.adminEmail] : [])).map(e => e.toLowerCase());
        if (data.user.email && allowed.includes(data.user.email.toLowerCase())) {
          adminState.webUid = saved;
          adminState.user = data.user;
          enterAdminApp();
          return;
        }
      }
    } catch (e) {
      localStorage.removeItem('bmak_admin_uid');
    }
  }
});

// ─── Login ────────────────────────────────────────────────────────────────────
async function adminLogin() {
  const email = document.getElementById('admin-email-input').value.trim();
  const password = document.getElementById('admin-pass-input').value;
  const btn = document.getElementById('admin-login-btn');
  const err = document.getElementById('admin-login-err');

  err.classList.add('hidden');
  err.textContent = '';

  if (!email || !password) {
    err.textContent = 'Email et mot de passe requis';
    err.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Connexion...';

  try {
    const data = await apiFetch('/api/users/web-login', 'POST', { email, password });
    if (!data.user) throw new Error('Aucun utilisateur retourné');

    const cfg = await apiFetch('/api/config');
    const allowed = (cfg.adminEmails || (cfg.adminEmail ? [cfg.adminEmail] : [])).map(e => e.toLowerCase());
    if (!data.user.email || !allowed.includes(data.user.email.toLowerCase())) {
      err.textContent = 'Accès refusé — compte non administrateur';
      err.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = '🔐 Connexion';
      return;
    }

    adminState.webUid = data.webUid;
    adminState.user = data.user;
    localStorage.setItem('bmak_admin_uid', data.webUid);
    enterAdminApp();
  } catch (e) {
    err.textContent = e?.data?.error || 'Email ou mot de passe incorrect';
    err.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = '🔐 Connexion';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('admin-pass-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });
  document.getElementById('admin-email-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });
});

function adminLogout() {
  localStorage.removeItem('bmak_admin_uid');
  location.reload();
}

function enterAdminApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-app').style.display = 'block';
  document.getElementById('sidebar-email').textContent = adminState.user.email;
  loadDashboard();
  loadReclamations();
  if (window._reclamPoll) clearInterval(window._reclamPoll);
  window._reclamPoll = setInterval(loadReclamations, 30000);
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'à l\'instant';
  if (diff < 3600000) return `il y a ${Math.floor(diff/60000)}m`;
  if (diff < 86400000) return `il y a ${Math.floor(diff/3600000)}h`;
  return d.toLocaleDateString('fr-FR');
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`page-${name}`)?.classList.add('active');
  document.querySelector(`[data-page="${name}"]`)?.classList.add('active');

  if (name === 'dashboard') loadDashboard();
  else if (name === 'users') loadUsers();
  else if (name === 'transactions') loadTransactions();
  else if (name === 'payouts') loadPayouts();
  else if (name === 'reclamations') loadReclamations();
}

// ─── Reclamations ─────────────────────────────────────────────────────────────
async function loadReclamations() {
  const tb = document.getElementById('reclam-tbody');
  if (tb) tb.innerHTML = '<tr><td colspan="7" class="loading">Chargement...</td></tr>';
  try {
    const data = await adminFetch('/api/reclamations/admin/pending');
    const list = data.reclamations || [];
    const badge = document.getElementById('reclam-badge');
    const count = document.getElementById('reclam-count');
    if (badge) {
      badge.textContent = list.length;
      badge.classList.toggle('hidden', list.length === 0);
    }
    if (count) count.textContent = `Réclamations en attente (${list.length})`;
    if (list.length === 0) {
      tb.innerHTML = '<tr><td colspan="7" class="loading">Aucune réclamation en attente 🎉</td></tr>';
      return;
    }
    tb.innerHTML = list.map(r => {
      const u = r.users || {};
      const wallet = r.wallet_address || u.wallet_address || '';
      const wShort = wallet ? `${wallet.slice(0,6)}...${wallet.slice(-4)}` : '—';
      return `<tr>
        <td>#${r.id}</td>
        <td>${u.display_name || '—'}</td>
        <td>${u.email || '—'}</td>
        <td><strong>${Number(r.amount).toLocaleString('fr-FR')}</strong></td>
        <td><a href="https://bscscan.com/address/${wallet}" target="_blank" title="${wallet}">${wShort}</a></td>
        <td>${formatDate(r.created_at)}</td>
        <td>
          <button class="btn btn-sm btn-green" onclick="processReclaim(${r.id})">✅ Traiter</button>
          <button class="btn btn-sm btn-danger" onclick="openReject(${r.id}, '${(u.display_name || '').replace(/'/g,"\\'")}')">✖ Refuser</button>
        </td>
      </tr>`;
    }).join('');
  } catch (e) {
    tb.innerHTML = `<tr><td colspan="7" class="loading">Erreur : ${e.message}</td></tr>`;
  }
}

async function processReclaim(id) {
  if (!confirm('Confirmer le traitement de cette réclamation ?\nLe solde de l\'utilisateur sera mis à 0 et marqué comme payé.')) return;
  try {
    await adminFetch(`/api/reclamations/${id}/process`, 'PATCH');
    await loadReclamations();
  } catch (e) { alert('Erreur : ' + e.message); }
}

let _rejectId = null;
function openReject(id, name) {
  _rejectId = id;
  document.getElementById('reject-modal-user').textContent = name || '';
  document.getElementById('reject-reason').value = '';
  document.getElementById('reject-modal').classList.remove('hidden');
}
async function submitReject() {
  if (!_rejectId) return;
  const reason = document.getElementById('reject-reason').value.trim();
  try {
    await adminFetch(`/api/reclamations/${_rejectId}/reject`, 'PATCH', { reason });
    closeModal('reject-modal');
    _rejectId = null;
    await loadReclamations();
  } catch (e) { alert('Erreur : ' + e.message); }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function loadDashboard() {
  const grid = document.getElementById('stats-grid');
  grid.innerHTML = '<div class="loading">Chargement des statistiques...</div>';

  try {
    const data = await adminFetch('/api/admin/stats');
    grid.innerHTML = `
      <div class="stat-card purple">
        <div class="stat-label">Total Utilisateurs</div>
        <div class="stat-value">${fmt(data.totalUsers)}</div>
        <div class="stat-sub">+${data.newUsersToday} aujourd'hui</div>
      </div>
      <div class="stat-card cyan">
        <div class="stat-label">BMAK Distribués</div>
        <div class="stat-value">${fmtBmak(data.totalBmakDistributed)}</div>
        <div class="stat-sub">Total cumulé</div>
      </div>
      <div class="stat-card green">
        <div class="stat-label">Soldes Actifs</div>
        <div class="stat-value">${fmtBmak(data.totalBmakBalance)}</div>
        <div class="stat-sub">En circulation</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-label">Paiements en attente</div>
        <div class="stat-value">${fmt(data.pendingPayouts)}</div>
        <div class="stat-sub">${fmtBmak(data.pendingPayoutAmount)} BMAK</div>
      </div>
      <div class="stat-card cyan">
        <div class="stat-label">Total Transactions</div>
        <div class="stat-value">${fmt(data.totalTransactions)}</div>
        <div class="stat-sub">Toutes opérations</div>
      </div>
    `;
  } catch (e) {
    grid.innerHTML = `<div class="empty">Erreur: ${e.message}</div>`;
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────
async function loadUsers(page = 1) {
  adminState.usersCurrentPage = page;
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="9" class="loading">Chargement...</td></tr>';

  try {
    const params = new URLSearchParams({ page, limit: 50 });
    if (adminState.usersSearch) params.append('search', adminState.usersSearch);

    const data = await adminFetch(`/api/admin/users?${params}`);
    const users = data.users || [];
    const total = data.total || 0;

    document.getElementById('users-count').textContent = `${total} utilisateur${total > 1 ? 's' : ''}`;
    document.getElementById('users-page-info').textContent = `Page ${page} · ${users.length} affichés sur ${total}`;
    document.getElementById('users-prev').disabled = page <= 1;
    document.getElementById('users-next').disabled = users.length < 50;

    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty">Aucun utilisateur trouvé</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.id}</td>
        <td class="td-main">${esc(u.display_name || u.first_name || '—')}</td>
        <td>${esc(u.email || '—')}</td>
        <td><span class="badge ${authBadge(u.auth_type)}">${u.auth_type || '—'}</span></td>
        <td class="${parseFloat(u.bmak_balance) > 0 ? 'amount-pos' : ''}">${fmtBmak(u.bmak_balance)}</td>
        <td>${fmtBmak(u.total_earned)}</td>
        <td>🔥 ${u.checkin_streak || 0}</td>
        <td>${fmtDate(u.created_at)}</td>
        <td>
          <div class="flex-gap">
            <button class="btn btn-sm btn-primary" onclick="viewUser(${u.id})">Voir</button>
            <button class="btn btn-sm btn-yellow" onclick="openBalance(${u.id},'${esc(u.display_name || u.email)}')">Solde</button>
            ${u.auth_type === 'email' ? `<button class="btn btn-sm btn-purple" onclick="resetPassword(${u.id},'${esc(u.display_name || u.email)}')">🔐 Reset MDP</button>` : ''}
            <button class="btn btn-sm btn-red" onclick="deleteUser(${u.id},'${esc(u.display_name || u.email)}')">Suppr.</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty">Erreur: ${e.message}</td></tr>`;
  }
}

function searchUsers(val) {
  clearTimeout(adminState.searchTimeout);
  adminState.usersSearch = val;
  adminState.searchTimeout = setTimeout(() => loadUsers(1), 400);
}

function usersPage(dir) {
  loadUsers(adminState.usersCurrentPage + dir);
}

// ─── User Detail ──────────────────────────────────────────────────────────────
async function viewUser(id) {
  showPage('user-detail');
  document.querySelector('[data-page="users"]')?.classList.add('active');
  const content = document.getElementById('user-detail-content');
  content.innerHTML = '<div class="loading">Chargement...</div>';

  try {
    const data = await adminFetch(`/api/admin/users/${id}`);
    const u = data.user;
    const txs = data.transactions || [];

    content.innerHTML = `
      <div class="page-title">${esc(u.display_name || u.first_name || 'Utilisateur')} <span class="badge ${authBadge(u.auth_type)}" style="font-size:13px">${u.auth_type}</span></div>
      <div class="user-detail-grid">
        <div class="detail-card"><div class="detail-label">Email</div><div class="detail-value">${esc(u.email || '—')}</div></div>
        <div class="detail-card"><div class="detail-label">ID</div><div class="detail-value">#${u.id}</div></div>
        <div class="detail-card"><div class="detail-label">Solde BMAK</div><div class="detail-value amount-pos">${fmtBmak(u.bmak_balance)}</div></div>
        <div class="detail-card"><div class="detail-label">Total gagné</div><div class="detail-value">${fmtBmak(u.total_earned)}</div></div>
        <div class="detail-card"><div class="detail-label">Streak</div><div class="detail-value">🔥 ${u.checkin_streak || 0} jours</div></div>
        <div class="detail-card"><div class="detail-label">Parrainages</div><div class="detail-value">👥 ${u.total_referrals || 0}</div></div>
        <div class="detail-card"><div class="detail-label">Wallet BSC</div><div class="detail-value" style="font-size:12px">${esc(u.wallet_address || 'Non connecté')}</div></div>
        <div class="detail-card"><div class="detail-label">Paiement envoyé</div><div class="detail-value">${u.payout_sent ? '✅ Oui — ' + fmtBmak(u.payout_sent_amount) : '⏳ Non'}</div></div>
        <div class="detail-card"><div class="detail-label">Inscrit le</div><div class="detail-value" style="font-size:13px">${fmtDate(u.created_at)}</div></div>
        <div class="detail-card"><div class="detail-label">Dernier check-in</div><div class="detail-value" style="font-size:13px">${u.last_checkin || '—'}</div></div>
      </div>
      <div class="flex-gap section-gap">
        <button class="btn btn-yellow" onclick="openBalance(${u.id},'${esc(u.display_name || u.email)}')">💱 Ajuster solde</button>
        ${!u.payout_sent && parseFloat(u.bmak_balance) > 0 ? `<button class="btn btn-green" onclick="openPayout(${u.id},'${esc(u.display_name || u.email)}',${u.bmak_balance})">💰 Marquer payé</button>` : ''}
        ${u.auth_type === 'email' ? `<button class="btn btn-purple" onclick="resetPassword(${u.id},'${esc(u.display_name || u.email)}')">🔐 Reset mot de passe</button>` : ''}
        <button class="btn btn-red" onclick="deleteUser(${u.id},'${esc(u.display_name || u.email)}')">🗑 Supprimer</button>
      </div>
      <div class="table-card">
        <div class="table-header"><span class="table-title">Dernières transactions (${txs.length})</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Type</th><th>Montant</th><th>Description</th><th>Date</th></tr></thead>
            <tbody>
              ${txs.length ? txs.map(t => `
                <tr>
                  <td>${t.id}</td>
                  <td><span class="badge ${txBadge(t.type)}">${t.type}</span></td>
                  <td class="${parseFloat(t.amount) > 0 ? 'amount-pos' : 'amount-neg'}">+${fmtBmak(t.amount)}</td>
                  <td>${esc(t.description || '—')}</td>
                  <td>${fmtDate(t.created_at)}</td>
                </tr>`).join('') : '<tr><td colspan="5" class="empty">Aucune transaction</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (e) {
    content.innerHTML = `<div class="empty">Erreur: ${e.message}</div>`;
  }
}

// ─── Transactions ─────────────────────────────────────────────────────────────
async function loadTransactions() {
  const tbody = document.getElementById('tx-tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="loading">Chargement...</td></tr>';

  try {
    const data = await adminFetch('/api/admin/transactions?limit=200');
    const txs = data.transactions || [];
    document.getElementById('tx-count').textContent = `${data.total || txs.length} transactions`;

    if (!txs.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">Aucune transaction</td></tr>';
      return;
    }

    tbody.innerHTML = txs.map(t => `
      <tr>
        <td>${t.id}</td>
        <td class="td-main">${esc(t.users?.display_name || '—')}<br><span style="font-size:11px;color:var(--text3)">${esc(t.users?.email || '')}</span></td>
        <td><span class="badge ${txBadge(t.type)}">${t.type}</span></td>
        <td class="${parseFloat(t.amount) > 0 ? 'amount-pos' : ''}">${fmtBmak(t.amount)}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.description || '—')}</td>
        <td><span class="badge badge-green">${t.status || 'completed'}</span></td>
        <td>${fmtDate(t.created_at)}</td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Erreur: ${e.message}</td></tr>`;
  }
}

// ─── Payouts ──────────────────────────────────────────────────────────────────
async function loadPayouts() {
  const tbody = document.getElementById('payouts-tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="loading">Chargement...</td></tr>';

  try {
    const data = await adminFetch('/api/admin/users?limit=200');
    const allUsers = data.users || [];
    const pending = allUsers.filter(u => !u.payout_sent && parseFloat(u.bmak_balance) > 0);

    document.getElementById('payouts-count').textContent = `${pending.length} paiement${pending.length > 1 ? 's' : ''} en attente`;

    if (!pending.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">✅ Aucun paiement en attente</td></tr>';
      return;
    }

    tbody.innerHTML = pending.map(u => `
      <tr>
        <td>${u.id}</td>
        <td class="td-main">${esc(u.display_name || u.first_name || '—')}</td>
        <td>${esc(u.email || '—')}</td>
        <td class="amount-pos">${fmtBmak(u.bmak_balance)}</td>
        <td style="font-size:11px;color:var(--text3);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.wallet_address || 'Non connecté')}</td>
        <td>${fmtBmak(u.total_earned)}</td>
        <td>
          <button class="btn btn-sm btn-green" onclick="openPayout(${u.id},'${esc(u.display_name||u.email)}',${u.bmak_balance})">💰 Marquer payé</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Erreur: ${e.message}</td></tr>`;
  }
}

// ─── Balance Modal ────────────────────────────────────────────────────────────
function openBalance(id, name) {
  adminState.balanceTargetId = id;
  document.getElementById('balance-modal-user').textContent = `Utilisateur : ${name}`;
  document.getElementById('balance-amount').value = '';
  document.getElementById('balance-note').value = '';
  document.getElementById('balance-err').classList.add('hidden');
  document.getElementById('balance-modal').classList.remove('hidden');
}

async function submitBalance() {
  const amount = parseFloat(document.getElementById('balance-amount').value);
  const note = document.getElementById('balance-note').value.trim();
  const err = document.getElementById('balance-err');
  err.classList.add('hidden');

  if (isNaN(amount) || amount === 0) {
    err.textContent = 'Montant invalide';
    err.classList.remove('hidden');
    return;
  }

  try {
    await adminFetch(`/api/admin/users/${adminState.balanceTargetId}/balance`, 'PATCH', { amount, note });
    closeModal('balance-modal');
    alert(`✅ Solde ajusté de ${amount > 0 ? '+' : ''}${amount} BMAK`);
    loadUsers(adminState.usersCurrentPage);
  } catch (e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
  }
}

// ─── Payout Modal ─────────────────────────────────────────────────────────────
function openPayout(id, name, balance) {
  adminState.payoutTargetId = id;
  document.getElementById('payout-modal-user').textContent = `Utilisateur : ${name} — Solde : ${fmtBmak(balance)} BMAK`;
  document.getElementById('payout-amount').value = balance;
  document.getElementById('payout-err').classList.add('hidden');
  document.getElementById('payout-modal').classList.remove('hidden');
}

async function submitPayout() {
  const amount = parseFloat(document.getElementById('payout-amount').value);
  const err = document.getElementById('payout-err');
  err.classList.add('hidden');

  if (isNaN(amount) || amount <= 0) {
    err.textContent = 'Montant invalide';
    err.classList.remove('hidden');
    return;
  }

  try {
    await adminFetch(`/api/admin/users/${adminState.payoutTargetId}/payout`, 'PATCH', { amount });
    closeModal('payout-modal');
    alert('✅ Paiement enregistré avec succès');
    loadPayouts();
  } catch (e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
  }
}

// ─── Reset User Password ──────────────────────────────────────────────────────
async function resetPassword(id, name) {
  if (!confirm(`Réinitialiser le mot de passe de "${name}" ?\n\nUn mot de passe temporaire sera généré. Vous devrez le communiquer à l'utilisateur.`)) return;
  try {
    const res = await adminFetch(`/api/admin/users/${id}/reset-password`, 'POST');
    const tmp = res.tempPassword;
    const msg = `🔐 Mot de passe temporaire généré pour ${name}\n\n${tmp}\n\n⚠️ Communiquez-le à l'utilisateur.\nIl devra le changer immédiatement après connexion.\n\nCliquez sur OK pour le copier dans le presse-papiers.`;
    if (confirm(msg)) {
      try { await navigator.clipboard.writeText(tmp); alert('✅ Copié !'); } catch { /* noop */ }
    }
  } catch (e) {
    alert(`Erreur: ${e.message}`);
  }
}

// ─── Delete User ──────────────────────────────────────────────────────────────
async function deleteUser(id, name) {
  if (!confirm(`⚠️ Supprimer définitivement l'utilisateur "${name}" (ID: ${id}) ?\n\nCette action est irréversible.`)) return;
  try {
    await adminFetch(`/api/admin/users/${id}`, 'DELETE');
    alert('✅ Utilisateur supprimé');
    loadUsers(adminState.usersCurrentPage);
  } catch (e) {
    alert(`Erreur: ${e.message}`);
  }
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id);
});

// ─── API Helpers ──────────────────────────────────────────────────────────────
async function adminFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-web-uid': adminState.webUid || '',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.data = data;
    throw err;
  }
  return res.json();
}

async function apiFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.data = data;
    throw err;
  }
  return res.json();
}

// ─── Formatting ───────────────────────────────────────────────────────────────
function fmt(n) { return Number(n || 0).toLocaleString('fr-FR'); }
function fmtBmak(n) { return parseFloat(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function authBadge(t) {
  if (t === 'telegram') return 'badge-blue';
  if (t === 'email') return 'badge-purple';
  return 'badge-gray';
}
function txBadge(t) {
  if (t === 'checkin') return 'badge-green';
  if (t === 'referral') return 'badge-blue';
  if (t === 'payout') return 'badge-yellow';
  if (t === 'admin_credit') return 'badge-purple';
  if (t === 'admin_debit') return 'badge-red';
  return 'badge-gray';
}

// Expose functions globally for inline onclick handlers
window.adminLogin = adminLogin;
window.adminLogout = adminLogout;
window.showPage = showPage;
window.viewUser = viewUser;
window.openBalance = openBalance;
window.submitBalance = submitBalance;
window.openPayout = openPayout;
window.submitPayout = submitPayout;
window.deleteUser = deleteUser;
window.resetPassword = resetPassword;
window.closeModal = closeModal;
window.searchUsers = searchUsers;
window.usersPage = usersPage;
window.loadUsers = loadUsers;

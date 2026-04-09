const express = require('express');
const router = express.Router();
const { supabase } = require('../db');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

// ─── Admin Auth Middleware ────────────────────────────────────────────────────
async function requireAdmin(req, res, next) {
  const webUid = req.headers['x-web-uid'] || req.body?.webUid;
  if (!webUid) return res.status(401).json({ error: 'Non authentifié' });

  const { data: user } = await supabase
    .from('users')
    .select('id, email, display_name')
    .eq('web_uid', webUid)
    .maybeSingle();

  if (!user) return res.status(401).json({ error: 'Session invalide' });
  if (!ADMIN_EMAIL || user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Accès refusé — administrateur uniquement' });
  }

  req.adminUser = user;
  next();
}

// ─── Stats Overview ───────────────────────────────────────────────────────────
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [usersRes, txRes, payoutRes] = await Promise.all([
      supabase.from('users').select('id, bmak_balance, total_earned, created_at, auth_type', { count: 'exact' }),
      supabase.from('transactions').select('id, amount, type, created_at', { count: 'exact' }),
      supabase.from('users').select('id, bmak_balance, total_earned').eq('payout_sent', false).gt('bmak_balance', 0),
    ]);

    const users = usersRes.data || [];
    const txs = txRes.data || [];
    const pendingPayouts = payoutRes.data || [];

    const totalBmakDistributed = users.reduce((s, u) => s + parseFloat(u.total_earned || 0), 0);
    const totalBmakBalance = users.reduce((s, u) => s + parseFloat(u.bmak_balance || 0), 0);
    const pendingPayoutAmount = pendingPayouts.reduce((s, u) => s + parseFloat(u.bmak_balance || 0), 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newUsersToday = users.filter(u => new Date(u.created_at) >= today).length;

    res.json({
      totalUsers: usersRes.count || users.length,
      totalTransactions: txRes.count || txs.length,
      totalBmakDistributed: totalBmakDistributed.toFixed(2),
      totalBmakBalance: totalBmakBalance.toFixed(2),
      pendingPayouts: pendingPayouts.length,
      pendingPayoutAmount: pendingPayoutAmount.toFixed(2),
      newUsersToday,
    });
  } catch (err) {
    console.error('[Admin Stats]', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── List Users ───────────────────────────────────────────────────────────────
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('users')
      .select('id, email, display_name, first_name, username, auth_type, bmak_balance, total_earned, checkin_streak, total_referrals, payout_sent, payout_sent_amount, wallet_address, created_at, last_checkin', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (search) {
      query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%,username.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ users: data, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('[Admin Users]', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Get Single User ──────────────────────────────────────────────────────────
router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const { data: txs } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_db_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    res.json({ user, transactions: txs || [] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Update User Balance ──────────────────────────────────────────────────────
router.patch('/users/:id/balance', requireAdmin, async (req, res) => {
  const { amount, note } = req.body;
  if (amount === undefined) return res.status(400).json({ error: 'Montant requis' });

  try {
    const { data: user } = await supabase.from('users').select('bmak_balance, total_earned').eq('id', req.params.id).single();
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const newBalance = parseFloat(user.bmak_balance) + parseFloat(amount);
    const newTotal = parseFloat(amount) > 0
      ? parseFloat(user.total_earned) + parseFloat(amount)
      : user.total_earned;

    await supabase.from('users').update({
      bmak_balance: newBalance,
      total_earned: newTotal,
      updated_at: new Date().toISOString(),
    }).eq('id', req.params.id);

    await supabase.from('transactions').insert({
      user_db_id: parseInt(req.params.id),
      type: parseFloat(amount) > 0 ? 'admin_credit' : 'admin_debit',
      amount: Math.abs(parseFloat(amount)),
      description: note || `Ajustement administrateur (${amount > 0 ? '+' : ''}${amount} BMAK)`,
      status: 'completed',
    });

    res.json({ success: true, newBalance });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Mark Payout Sent ─────────────────────────────────────────────────────────
router.patch('/users/:id/payout', requireAdmin, async (req, res) => {
  const { amount } = req.body;
  try {
    await supabase.from('users').update({
      payout_sent: true,
      payout_sent_at: new Date().toISOString(),
      payout_sent_amount: amount || 0,
      bmak_balance: 0,
      updated_at: new Date().toISOString(),
    }).eq('id', req.params.id);

    await supabase.from('transactions').insert({
      user_db_id: parseInt(req.params.id),
      type: 'payout',
      amount: parseFloat(amount) || 0,
      description: 'Paiement envoyé par l\'administrateur',
      status: 'completed',
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── All Transactions ─────────────────────────────────────────────────────────
router.get('/transactions', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('transactions')
      .select('*, users(display_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;
    res.json({ transactions: data, total: count });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Delete User ──────────────────────────────────────────────────────────────
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    await supabase.from('transactions').delete().eq('user_db_id', req.params.id);
    await supabase.from('referrals').delete().or(`referrer_db_id.eq.${req.params.id},referred_db_id.eq.${req.params.id}`);
    await supabase.from('users').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

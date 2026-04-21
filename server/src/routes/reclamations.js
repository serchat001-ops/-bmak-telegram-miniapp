const express = require('express');
const router = express.Router();
const { supabase } = require('../db');

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ||
  'ben.makoma98@gmail.com,serchat001@gmail.com,officielbmak@gmail.com')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

const MIN_RECLAIM = parseInt(process.env.MIN_RECLAIM_AMOUNT || '1500', 10);

async function getUserByWebUid(webUid) {
  if (!webUid) return null;
  const { data } = await supabase
    .from('users').select('*').eq('web_uid', webUid).maybeSingle();
  return data;
}

function isAdminEmail(email) {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

async function requireAdmin(req, res, next) {
  const webUid = req.headers['x-web-uid'] || req.body?.webUid;
  const user = await getUserByWebUid(webUid);
  if (!user) return res.status(401).json({ error: 'Session invalide' });
  if (!isAdminEmail(user.email)) return res.status(403).json({ error: 'Accès refusé' });
  req.adminUser = user;
  next();
}

// ─── User: create reclamation ─────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { userId, webUid } = req.body;
  try {
    let user = null;
    if (webUid) user = await getUserByWebUid(webUid);
    else if (userId) {
      const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
      user = data;
    }
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
    if (!user.wallet_address) return res.status(400).json({ error: 'Wallet BSC requis' });

    const balance = Number(user.bmak_balance || 0);
    if (balance < MIN_RECLAIM) {
      return res.status(400).json({ error: `Solde insuffisant (min ${MIN_RECLAIM} B_MAK)` });
    }

    const { data: existing } = await supabase
      .from('reclamations')
      .select('id').eq('user_id', user.id).eq('status', 'pending').maybeSingle();
    if (existing) return res.status(409).json({ error: 'Demande déjà en attente' });

    const { data, error } = await supabase.from('reclamations').insert({
      user_id: user.id,
      amount: balance,
      wallet_address: user.wallet_address,
      status: 'pending',
    }).select().single();
    if (error) throw error;
    res.json({ success: true, reclamation: data });
  } catch (err) {
    console.error('[Reclamation create]', err.message);
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

// ─── User: get my reclamations ────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const webUid = req.headers['x-web-uid'] || req.query.webUid;
  const userId = req.query.userId;
  try {
    let user = null;
    if (webUid) user = await getUserByWebUid(webUid);
    else if (userId) {
      const { data } = await supabase.from('users').select('id').eq('id', userId).maybeSingle();
      user = data;
    }
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { data } = await supabase
      .from('reclamations').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(20);
    res.json({ reclamations: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Admin: list pending ──────────────────────────────────────────────────────
router.get('/admin/pending', requireAdmin, async (req, res) => {
  try {
    const { data } = await supabase
      .from('reclamations')
      .select('*, users(id, display_name, email, wallet_address, bmak_balance)')
      .eq('status', 'pending').order('created_at', { ascending: false });
    res.json({ reclamations: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Admin: process ───────────────────────────────────────────────────────────
router.patch('/:id/process', requireAdmin, async (req, res) => {
  try {
    const { data: reclaim } = await supabase
      .from('reclamations').select('*').eq('id', req.params.id).maybeSingle();
    if (!reclaim) return res.status(404).json({ error: 'Réclamation introuvable' });
    if (reclaim.status !== 'pending') return res.status(400).json({ error: 'Déjà traitée' });

    await supabase.from('reclamations').update({
      status: 'processed',
      processed_at: new Date().toISOString(),
      processed_by: req.adminUser.id,
    }).eq('id', reclaim.id);

    await supabase.from('users').update({
      bmak_balance: 0,
      payout_sent: true,
      payout_sent_at: new Date().toISOString(),
      payout_sent_amount: reclaim.amount,
      updated_at: new Date().toISOString(),
    }).eq('id', reclaim.user_id);

    await supabase.from('transactions').insert({
      user_db_id: reclaim.user_id,
      type: 'reclaim_processed',
      amount: reclaim.amount,
      description: `Réclamation traitée - Transfert BSC ${reclaim.amount} B_MAK`,
      status: 'completed',
    });

    await supabase.from('notifications').insert({
      user_id: reclaim.user_id,
      type: 'reclaim_processed',
      title: 'Réclamation traitée !',
      message: `Votre réclamation de ${Number(reclaim.amount).toLocaleString('fr-FR')} B_MAK a été traitée vers ${reclaim.wallet_address}`,
      read: false,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Reclamation process]', err.message);
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

// ─── Admin: reject ────────────────────────────────────────────────────────────
router.patch('/:id/reject', requireAdmin, async (req, res) => {
  const { reason } = req.body || {};
  try {
    const { data: reclaim } = await supabase
      .from('reclamations').select('*').eq('id', req.params.id).maybeSingle();
    if (!reclaim) return res.status(404).json({ error: 'Introuvable' });

    await supabase.from('reclamations').update({
      status: 'rejected',
      processed_at: new Date().toISOString(),
      processed_by: req.adminUser.id,
      reject_reason: reason || null,
    }).eq('id', reclaim.id);

    await supabase.from('notifications').insert({
      user_id: reclaim.user_id,
      type: 'reclaim_rejected',
      title: 'Réclamation refusée',
      message: reason || 'Votre demande a été refusée. Contactez le support.',
      read: false,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

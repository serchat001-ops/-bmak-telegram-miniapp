const express = require('express');
const router = express.Router();
const { supabase } = require('../db');

async function resolveUser(req) {
  const webUid = req.headers['x-web-uid'] || req.query.webUid || req.body?.webUid;
  if (webUid) {
    const { data } = await supabase.from('users').select('id').eq('web_uid', webUid).maybeSingle();
    if (data) return data;
  }
  const id = req.params.userId || req.body?.userId;
  if (id) {
    const { data } = await supabase.from('users').select('id').eq('id', id).maybeSingle();
    if (data) return data;
  }
  return null;
}

// Get unread notifications
router.get('/:userId', async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { data } = await supabase
      .from('notifications')
      .select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(20);
    res.json({ notifications: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mark all read
router.patch('/:userId/read-all', async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    await supabase.from('notifications').update({ read: true })
      .eq('user_id', user.id).eq('read', false);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

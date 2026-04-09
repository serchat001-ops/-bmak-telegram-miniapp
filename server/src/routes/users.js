const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const { validateTelegramWebAppData, generateReferralCode } = require('../telegram');
const { randomUUID } = require('crypto');

// ─── Telegram Auth ────────────────────────────────────────────────────────────
router.post('/auth', async (req, res) => {
  const { initData, referralCode } = req.body;

  let telegramUser = validateTelegramWebAppData(initData);

  if (!telegramUser) {
    if (process.env.NODE_ENV !== 'production') {
      telegramUser = req.body.user || { id: 12345678, first_name: 'Demo', username: 'demo_user' };
    } else {
      return res.status(401).json({ error: 'Invalid Telegram data' });
    }
  }

  try {
    const code = generateReferralCode(telegramUser.id);

    let referredByDbId = null;
    if (referralCode) {
      const { data: refData } = await supabase
        .from('users')
        .select('id, telegram_id')
        .eq('referral_code', referralCode)
        .maybeSingle();
      if (refData && refData.telegram_id !== telegramUser.id) {
        referredByDbId = refData.id;
      }
    }

    // Upsert user
    const { data: user, error } = await supabase
      .from('users')
      .upsert({
        telegram_id: telegramUser.id,
        username: telegramUser.username || null,
        first_name: telegramUser.first_name || null,
        last_name: telegramUser.last_name || null,
        display_name: telegramUser.first_name || telegramUser.username || 'User',
        referral_code: code,
        auth_type: 'telegram',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'telegram_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) throw error;

    if (referredByDbId && !user.referred_by) {
      await supabase.from('users').update({ referred_by: referredByDbId }).eq('id', user.id);
      await supabase.from('referrals').upsert({
        referrer_db_id: referredByDbId,
        referred_db_id: user.id,
      }, { onConflict: 'referrer_db_id,referred_db_id', ignoreDuplicates: true });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error('[Auth] Error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── Web Register ─────────────────────────────────────────────────────────────
router.post('/web-register', async (req, res) => {
  const { displayName, referralCode } = req.body;
  if (!displayName || displayName.trim().length < 2) {
    return res.status(400).json({ error: 'Display name must be at least 2 characters' });
  }

  const webUid = randomUUID();
  const safeName = displayName.trim().slice(0, 32);
  const code = 'WEB' + webUid.replace(/-/g, '').slice(0, 8).toUpperCase();

  try {
    let referredByDbId = null;
    if (referralCode) {
      const { data: refData } = await supabase
        .from('users')
        .select('id')
        .eq('referral_code', referralCode)
        .maybeSingle();
      if (refData) referredByDbId = refData.id;
    }

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        web_uid: webUid,
        display_name: safeName,
        first_name: safeName,
        referral_code: code,
        auth_type: 'web',
      })
      .select()
      .single();

    if (error) throw error;

    if (referredByDbId) {
      await supabase.from('users').update({ referred_by: referredByDbId }).eq('id', user.id);
      await supabase.from('referrals').insert({
        referrer_db_id: referredByDbId,
        referred_db_id: user.id,
      });
    }

    res.json({ success: true, user, webUid });
  } catch (err) {
    console.error('[Web Register] Error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ─── Web Session ──────────────────────────────────────────────────────────────
router.post('/web-session', async (req, res) => {
  const { webUid } = req.body;
  if (!webUid) return res.status(400).json({ error: 'webUid required' });

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('web_uid', webUid)
      .maybeSingle();

    if (error) throw error;
    if (!user) return res.status(404).json({ error: 'Session not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── Profile ──────────────────────────────────────────────────────────────────
router.get('/profile/:userId', async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.userId)
      .maybeSingle();

    if (error) throw error;
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── Save Wallet ──────────────────────────────────────────────────────────────
router.post('/wallet', async (req, res) => {
  const { userId, walletAddress } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const { error } = await supabase
      .from('users')
      .update({ wallet_address: walletAddress, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;

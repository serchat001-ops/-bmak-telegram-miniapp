const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { supabase } = require('../db');
const { validateTelegramWebAppData, generateReferralCode } = require('../telegram');
const { randomUUID, randomBytes } = require('crypto');
const { sendMail } = require('../email');

const REFERRAL_BONUS = parseInt(process.env.REFERRAL_BONUS || '50', 10);

async function rewardReferrer(referrerDbId, newUserDbId) {
  const { data: refUser } = await supabase
    .from('users')
    .select('id, telegram_id, bmak_balance, total_earned, total_referrals')
    .eq('id', referrerDbId)
    .maybeSingle();
  if (!refUser) return;
  await supabase.from('users').update({
    bmak_balance: Number(refUser.bmak_balance || 0) + REFERRAL_BONUS,
    total_earned: Number(refUser.total_earned || 0) + REFERRAL_BONUS,
    total_referrals: Number(refUser.total_referrals || 0) + 1,
    updated_at: new Date().toISOString(),
  }).eq('id', refUser.id);
  await supabase.from('transactions').insert({
    user_db_id: refUser.id,
    telegram_id: refUser.telegram_id || null,
    type: 'referral',
    amount: REFERRAL_BONUS,
    description: 'Referral bonus - new user joined',
  });
  await supabase.from('notifications').insert({
    user_id: refUser.id,
    type: 'referral',
    title: 'Nouveau filleul !',
    message: `+${REFERRAL_BONUS} B_MAK ajoutés à votre solde`,
    read: false,
  });
}

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
  const { displayName, email, password, referralCode } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Adresse email invalide' });
  }
  if (!displayName || displayName.trim().length < 2) {
    return res.status(400).json({ error: 'Le nom doit contenir au moins 2 caractères' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  const safeName = displayName.trim().slice(0, 32);
  const safeEmail = email.trim().toLowerCase();

  try {
    // Check if email already registered
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', safeEmail)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'Cette adresse email est déjà utilisée' });
    }

    const webUid = randomUUID();
    const code = 'WEB' + webUid.replace(/-/g, '').slice(0, 8).toUpperCase();
    const passwordHash = await bcrypt.hash(password, 10);

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
        email: safeEmail,
        referral_code: code,
        auth_type: 'email',
        password_hash: passwordHash,
      })
      .select()
      .single();

    if (error) throw error;

    if (referredByDbId) {
      await supabase.from('users').update({ referred_by: referredByDbId }).eq('id', user.id);
      await supabase.from('referrals').insert({
        referrer_db_id: referredByDbId,
        referred_db_id: user.id,
        bonus_paid: true,
      });
      await rewardReferrer(referredByDbId, user.id);
    }

    res.json({ success: true, user, webUid });
  } catch (err) {
    console.error('[Web Register] Error:', err.message);
    res.status(500).json({ error: 'Échec de l\'inscription' });
  }
});

// ─── Web Login ────────────────────────────────────────────────────────────────
router.post('/web-login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (error) throw error;
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    if (!user.password_hash) {
      return res.status(401).json({ error: 'Aucun mot de passe défini pour ce compte. Contactez l\'administrateur.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    res.json({ success: true, user, webUid: user.web_uid });
  } catch (err) {
    console.error('[Web Login] Error:', err.message);
    res.status(500).json({ error: 'Erreur de connexion' });
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

// ─── Change Password (user, with old password verification) ───────────────────
router.post('/change-password', async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  if (!userId || !oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Champs requis manquants' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
  }
  try {
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (!user || !user.password_hash) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const valid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Ancien mot de passe incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await supabase.from('users')
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq('id', userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Forgot Password (request reset link) ─────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Adresse email invalide' });
  }
  const safeEmail = email.trim().toLowerCase();
  try {
    const { data: user } = await supabase
      .from('users').select('id, email, display_name, first_name')
      .eq('email', safeEmail).maybeSingle();

    // Always respond success to avoid email enumeration
    if (!user) {
      return res.json({ success: true, message: 'Si ce compte existe, un email a été envoyé.' });
    }

    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

    await supabase.from('users').update({
      password_reset_token: token,
      password_reset_expires: expires,
    }).eq('id', user.id);

    const base = process.env.MINI_APP_URL || `https://${req.get('host')}`;
    const resetUrl = `${base}/app/?reset=${token}`;
    const name = user.display_name || user.first_name || 'utilisateur';

    try {
      await sendMail({
        to: safeEmail,
        subject: 'B_MAK — Réinitialisation de votre mot de passe',
        text: `Bonjour ${name},\n\nVous avez demandé à réinitialiser votre mot de passe B_MAK.\n\nCliquez sur ce lien (valide 1 heure) :\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\nL'équipe B_MAK`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0d0d1a;color:#fff;border-radius:12px;">
            <h2 style="background:linear-gradient(135deg,#8b5cf6,#06b6d4);-webkit-background-clip:text;background-clip:text;color:transparent;">B_MAK</h2>
            <p>Bonjour <b>${name}</b>,</p>
            <p>Vous avez demandé à réinitialiser votre mot de passe B_MAK.</p>
            <p style="text-align:center;margin:30px 0;">
              <a href="${resetUrl}" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:bold;">🔐 Réinitialiser mon mot de passe</a>
            </p>
            <p style="font-size:12px;color:#aaa;">Ce lien est valide pendant 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
            <hr style="border-color:#333;margin:20px 0;" />
            <p style="font-size:11px;color:#666;">L'équipe B_MAK — bmak.finance</p>
          </div>`,
      });
    } catch (mailErr) {
      console.error('[Forgot Password] Email send failed:', mailErr.message);
    }

    res.json({ success: true, message: 'Si ce compte existe, un email a été envoyé.' });
  } catch (err) {
    console.error('[Forgot Password] Error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Reset Password (verify token + set new) ──────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Lien invalide' });
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }
  try {
    const { data: user } = await supabase
      .from('users').select('id, password_reset_expires')
      .eq('password_reset_token', token).maybeSingle();
    if (!user) return res.status(400).json({ error: 'Lien invalide ou expiré' });
    if (user.password_reset_expires && new Date(user.password_reset_expires) < new Date()) {
      return res.status(400).json({ error: 'Lien expiré, demandez-en un nouveau' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await supabase.from('users').update({
      password_hash: passwordHash,
      password_reset_token: null,
      password_reset_expires: null,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);
    res.json({ success: true, message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' });
  } catch (err) {
    console.error('[Reset Password] Error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

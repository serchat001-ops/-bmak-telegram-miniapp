const express = require('express');
const router = express.Router();
const { pool } = require('../db');
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

  const client = await pool.connect();
  try {
    const code = generateReferralCode(telegramUser.id);

    let referredByDbId = null;
    if (referralCode) {
      const refRes = await client.query(
        'SELECT id, telegram_id FROM users WHERE referral_code = $1',
        [referralCode]
      );
      if (refRes.rows.length > 0 && refRes.rows[0].telegram_id !== telegramUser.id) {
        referredByDbId = refRes.rows[0].id;
      }
    }

    const result = await client.query(`
      INSERT INTO users (telegram_id, username, first_name, last_name, display_name, referral_code, auth_type)
      VALUES ($1, $2, $3, $4, $5, $6, 'telegram')
      ON CONFLICT (telegram_id) DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        display_name = COALESCE(users.display_name, EXCLUDED.first_name),
        updated_at = NOW()
      RETURNING *
    `, [
      telegramUser.id,
      telegramUser.username || null,
      telegramUser.first_name || null,
      telegramUser.last_name || null,
      telegramUser.first_name || telegramUser.username || 'User',
      code,
    ]);

    const user = result.rows[0];

    if (referredByDbId && !user.referred_by) {
      await client.query(
        'UPDATE users SET referred_by = $1 WHERE id = $2',
        [referredByDbId, user.id]
      );
      await client.query(
        `INSERT INTO referrals (referrer_db_id, referred_db_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [referredByDbId, user.id]
      );
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error('[Auth] Error:', err.message);
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
});

// ─── Web Register (new user via web) ─────────────────────────────────────────
router.post('/web-register', async (req, res) => {
  const { displayName, referralCode } = req.body;
  if (!displayName || displayName.trim().length < 2) {
    return res.status(400).json({ error: 'Display name must be at least 2 characters' });
  }

  const webUid = randomUUID();
  const safeName = displayName.trim().slice(0, 32);
  const code = 'WEB' + webUid.replace(/-/g, '').slice(0, 8).toUpperCase();

  const client = await pool.connect();
  try {
    let referredByDbId = null;
    if (referralCode) {
      const refRes = await client.query(
        'SELECT id FROM users WHERE referral_code = $1',
        [referralCode]
      );
      if (refRes.rows.length > 0) referredByDbId = refRes.rows[0].id;
    }

    const result = await client.query(`
      INSERT INTO users (web_uid, display_name, first_name, referral_code, auth_type)
      VALUES ($1, $2, $2, $3, 'web')
      RETURNING *
    `, [webUid, safeName, code]);

    const user = result.rows[0];

    if (referredByDbId) {
      await client.query(
        'UPDATE users SET referred_by = $1 WHERE id = $2',
        [referredByDbId, user.id]
      );
      await client.query(
        'INSERT INTO referrals (referrer_db_id, referred_db_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [referredByDbId, user.id]
      );
    }

    res.json({ success: true, user, webUid });
  } catch (err) {
    console.error('[Web Register] Error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

// ─── Web Session (returning web user) ────────────────────────────────────────
router.post('/web-session', async (req, res) => {
  const { webUid } = req.body;
  if (!webUid) return res.status(400).json({ error: 'webUid required' });

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM users WHERE web_uid = $1',
      [webUid]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Session not found' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
});

// ─── Profile by DB id ─────────────────────────────────────────────────────────
router.get('/profile/:userId', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM users WHERE id = $1',
      [req.params.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
});

// ─── Save wallet ──────────────────────────────────────────────────────────────
router.post('/wallet', async (req, res) => {
  const { userId, walletAddress } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE users SET wallet_address = $1, updated_at = NOW() WHERE id = $2',
      [walletAddress, userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
});

module.exports = router;

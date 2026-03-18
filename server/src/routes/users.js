const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { validateTelegramWebAppData, generateReferralCode } = require('../telegram');

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

    let referredBy = null;
    if (referralCode) {
      const refRes = await client.query(
        'SELECT telegram_id FROM users WHERE referral_code = $1',
        [referralCode]
      );
      if (refRes.rows.length > 0 && refRes.rows[0].telegram_id !== telegramUser.id) {
        referredBy = refRes.rows[0].telegram_id;
      }
    }

    const result = await client.query(`
      INSERT INTO users (telegram_id, username, first_name, last_name, referral_code, referred_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (telegram_id) DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        updated_at = NOW()
      RETURNING *
    `, [
      telegramUser.id,
      telegramUser.username || null,
      telegramUser.first_name || null,
      telegramUser.last_name || null,
      code,
      referredBy,
    ]);

    const user = result.rows[0];

    if (referredBy && !user.referred_by) {
      await client.query(
        'INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [referredBy, telegramUser.id]
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

router.get('/profile/:telegramId', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [req.params.telegramId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
});

router.post('/wallet', async (req, res) => {
  const { telegramId, walletAddress } = req.body;
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE users SET wallet_address = $1, updated_at = NOW() WHERE telegram_id = $2',
      [walletAddress, telegramId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
});

module.exports = router;

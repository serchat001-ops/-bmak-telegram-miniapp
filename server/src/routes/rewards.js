const express = require('express');
const router = express.Router();
const { pool } = require('../db');

const DAILY_REWARD = 100;
const REFERRAL_REWARD = 50;
const STREAK_BONUS_DAYS = [7, 14, 30];
const STREAK_BONUS_AMOUNTS = [500, 1000, 3000];

router.post('/checkin', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const client = await pool.connect();
  try {
    const userRes = await client.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });

    const user = userRes.rows[0];
    const today = new Date().toISOString().split('T')[0];
    const lastCheckin = user.last_checkin ? user.last_checkin.toISOString().split('T')[0] : null;

    if (lastCheckin === today) {
      return res.json({
        success: false,
        message: 'Already checked in today',
        nextCheckin: getNextCheckin(),
        user,
      });
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const newStreak = lastCheckin === yesterday ? user.checkin_streak + 1 : 1;

    let totalReward = DAILY_REWARD;
    let bonusMessage = null;

    const bonusIdx = STREAK_BONUS_DAYS.indexOf(newStreak);
    if (bonusIdx !== -1) {
      totalReward += STREAK_BONUS_AMOUNTS[bonusIdx];
      bonusMessage = `🎉 ${newStreak}-day streak bonus: +${STREAK_BONUS_AMOUNTS[bonusIdx]} BMAK!`;
    }

    await client.query('BEGIN');
    await client.query(`
      UPDATE users SET
        bmak_balance = bmak_balance + $1,
        total_earned = total_earned + $1,
        last_checkin = $2,
        checkin_streak = $3,
        updated_at = NOW()
      WHERE telegram_id = $4
    `, [totalReward, today, newStreak, telegramId]);

    await client.query(`
      INSERT INTO transactions (telegram_id, type, amount, description)
      VALUES ($1, 'checkin', $2, $3)
    `, [telegramId, totalReward, `Daily check-in (Day ${newStreak} streak)`]);

    await client.query('COMMIT');

    const updatedUser = await client.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId]
    );

    res.json({
      success: true,
      reward: totalReward,
      streak: newStreak,
      bonusMessage,
      user: updatedUser.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[Checkin] Error:', err.message);
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
});

router.get('/referrals/:telegramId', async (req, res) => {
  const client = await pool.connect();
  try {
    const userRes = await client.query(
      'SELECT referral_code, total_referrals FROM users WHERE telegram_id = $1',
      [req.params.telegramId]
    );
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });

    const refs = await client.query(`
      SELECT u.telegram_id, u.username, u.first_name, r.created_at, r.bonus_paid
      FROM referrals r
      JOIN users u ON u.telegram_id = r.referred_id
      WHERE r.referrer_id = $1
      ORDER BY r.created_at DESC
      LIMIT 20
    `, [req.params.telegramId]);

    const botUsername = process.env.BOT_USERNAME || 'bmak_miniapp_bot';
    const refLink = `https://t.me/${botUsername}?start=${userRes.rows[0].referral_code}`;

    res.json({
      referralCode: userRes.rows[0].referral_code,
      referralLink: refLink,
      totalReferrals: userRes.rows[0].total_referrals,
      referrals: refs.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
});

router.post('/referral-bonus', async (req, res) => {
  const { referrerId, referredId } = req.body;
  const client = await pool.connect();
  try {
    const refRes = await client.query(
      'SELECT * FROM referrals WHERE referrer_id = $1 AND referred_id = $2 AND bonus_paid = FALSE',
      [referrerId, referredId]
    );
    if (!refRes.rows.length) return res.status(400).json({ error: 'No unpaid referral found' });

    await client.query('BEGIN');
    await client.query(`
      UPDATE users SET
        bmak_balance = bmak_balance + $1,
        total_earned = total_earned + $1,
        total_referrals = total_referrals + 1,
        updated_at = NOW()
      WHERE telegram_id = $2
    `, [REFERRAL_REWARD, referrerId]);

    await client.query(
      'UPDATE referrals SET bonus_paid = TRUE WHERE referrer_id = $1 AND referred_id = $2',
      [referrerId, referredId]
    );

    await client.query(`
      INSERT INTO transactions (telegram_id, type, amount, description)
      VALUES ($1, 'referral', $2, 'Referral bonus')
    `, [referrerId, REFERRAL_REWARD]);

    await client.query('COMMIT');
    res.json({ success: true, reward: REFERRAL_REWARD });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
});

function getNextCheckin() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

module.exports = router;

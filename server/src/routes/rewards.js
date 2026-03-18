const express = require('express');
const router = express.Router();
const { pool } = require('../db');

const DAILY_REWARD = 100;
const STREAK_BONUS_DAYS = [7, 14, 30];
const STREAK_BONUS_AMOUNTS = [500, 1000, 3000];

// Accept userId (DB primary key) for all reward operations
router.post('/checkin', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const client = await pool.connect();
  try {
    const userRes = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });

    const user = userRes.rows[0];
    const today = new Date().toISOString().split('T')[0];
    const lastCheckin = user.last_checkin ? new Date(user.last_checkin).toISOString().split('T')[0] : null;

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
      WHERE id = $4
    `, [totalReward, today, newStreak, userId]);

    await client.query(`
      INSERT INTO transactions (user_db_id, telegram_id, type, amount, description)
      VALUES ($1, $2, 'checkin', $3, $4)
    `, [userId, user.telegram_id, totalReward, `Daily check-in (Day ${newStreak} streak)`]);

    await client.query('COMMIT');

    const updatedUser = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    res.json({ success: true, reward: totalReward, streak: newStreak, bonusMessage, user: updatedUser.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[Checkin] Error:', err.message);
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
});

router.get('/referrals/:userId', async (req, res) => {
  const client = await pool.connect();
  try {
    const userRes = await client.query(
      'SELECT referral_code, total_referrals FROM users WHERE id = $1',
      [req.params.userId]
    );
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });

    const refs = await client.query(`
      SELECT u.id, u.username, u.first_name, u.display_name, r.created_at, r.bonus_paid
      FROM referrals r
      JOIN users u ON u.id = r.referred_db_id
      WHERE r.referrer_db_id = $1
      ORDER BY r.created_at DESC
      LIMIT 20
    `, [req.params.userId]);

    const botUsername = process.env.BOT_USERNAME || 'bmak_miniapp_bot';
    const domain = process.env.REPLIT_DEV_DOMAIN || process.env.APP_DOMAIN || '';
    const webLink = domain ? `https://${domain}?ref=${userRes.rows[0].referral_code}` : '';
    const tgLink = `https://t.me/${botUsername}?start=${userRes.rows[0].referral_code}`;

    res.json({
      referralCode: userRes.rows[0].referral_code,
      referralLink: tgLink,
      webReferralLink: webLink,
      totalReferrals: userRes.rows[0].total_referrals,
      referrals: refs.rows,
    });
  } catch (err) {
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

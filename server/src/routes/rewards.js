const express = require('express');
const router = express.Router();
const { supabase } = require('../db');

const DAILY_REWARD = 100;
const STREAK_BONUS_DAYS = [7, 14, 30];
const STREAK_BONUS_AMOUNTS = [500, 1000, 3000];

router.post('/checkin', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const today = new Date().toISOString().split('T')[0];
    const lastCheckin = user.last_checkin
      ? new Date(user.last_checkin).toISOString().split('T')[0]
      : null;

    if (lastCheckin === today) {
      return res.json({
        success: false,
        message: 'Already checked in today',
        nextCheckin: getNextCheckin(),
        user,
      });
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const newStreak = lastCheckin === yesterday ? (user.checkin_streak || 0) + 1 : 1;

    let totalReward = DAILY_REWARD;
    let bonusMessage = null;
    const bonusIdx = STREAK_BONUS_DAYS.indexOf(newStreak);
    if (bonusIdx !== -1) {
      totalReward += STREAK_BONUS_AMOUNTS[bonusIdx];
      bonusMessage = `🎉 ${newStreak}-day streak bonus: +${STREAK_BONUS_AMOUNTS[bonusIdx]} BMAK!`;
    }

    const newBalance = parseFloat(user.bmak_balance || 0) + totalReward;
    const newEarned = parseFloat(user.total_earned || 0) + totalReward;

    const { data: updatedUser, error: updateErr } = await supabase
      .from('users')
      .update({
        bmak_balance: newBalance,
        total_earned: newEarned,
        last_checkin: today,
        checkin_streak: newStreak,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await supabase.from('transactions').insert({
      user_db_id: userId,
      telegram_id: user.telegram_id || null,
      type: 'checkin',
      amount: totalReward,
      description: `Daily check-in (Day ${newStreak} streak)`,
    });

    res.json({ success: true, reward: totalReward, streak: newStreak, bonusMessage, user: updatedUser });
  } catch (err) {
    console.error('[Checkin] Error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/referrals/:userId', async (req, res) => {
  try {
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('referral_code, total_referrals')
      .eq('id', req.params.userId)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { data: refs, error: refsErr } = await supabase
      .from('referrals')
      .select('referred_db_id, created_at, bonus_paid')
      .eq('referrer_db_id', req.params.userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (refsErr) throw refsErr;

    const referredIds = (refs || []).map(r => r.referred_db_id).filter(Boolean);
    let usersMap = {};
    if (referredIds.length > 0) {
      const { data: refUsers } = await supabase
        .from('users')
        .select('id, username, first_name, display_name')
        .in('id', referredIds);
      (refUsers || []).forEach(u => { usersMap[u.id] = u; });
    }

    const referrals = (refs || []).map(r => ({
      ...(usersMap[r.referred_db_id] || {}),
      created_at: r.created_at,
      bonus_paid: r.bonus_paid,
    }));

    const botUsername = process.env.BOT_USERNAME || 'B_MAK_officiel_bot';
    const domain = process.env.REPLIT_DEV_DOMAIN || process.env.APP_DOMAIN || '';
    const webLink = domain ? `https://${domain}/app?ref=${user.referral_code}` : '';
    const tgLink = `https://t.me/${botUsername}?start=${user.referral_code}`;

    res.json({
      referralCode: user.referral_code,
      referralLink: tgLink,
      webReferralLink: webLink,
      totalReferrals: user.total_referrals,
      referrals,
    });
  } catch (err) {
    console.error('[Referrals] Error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

function getNextCheckin() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

module.exports = router;

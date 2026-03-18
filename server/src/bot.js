const { Telegraf, Markup } = require('telegraf');
const { pool } = require('./db');
const { generateReferralCode } = require('./telegram');

function createBot() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('[Bot] No TELEGRAM_BOT_TOKEN — bot disabled');
    return null;
  }

  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.APP_DOMAIN;

  bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    const startPayload = ctx.startPayload;

    const client = await pool.connect();
    try {
      const code = generateReferralCode(telegramId);
      let referredBy = null;

      if (startPayload && startPayload.startsWith('BMAK')) {
        const refRes = await client.query(
          'SELECT telegram_id FROM users WHERE referral_code = $1',
          [startPayload]
        );
        if (refRes.rows.length > 0 && refRes.rows[0].telegram_id !== telegramId) {
          referredBy = refRes.rows[0].telegram_id;
        }
      }

      await client.query(`
        INSERT INTO users (telegram_id, username, first_name, last_name, referral_code, referred_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (telegram_id) DO UPDATE SET
          username = EXCLUDED.username,
          first_name = EXCLUDED.first_name,
          updated_at = NOW()
      `, [
        telegramId,
        ctx.from.username || null,
        ctx.from.first_name || null,
        ctx.from.last_name || null,
        code,
        referredBy,
      ]);

      if (referredBy) {
        await client.query(
          'INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [referredBy, telegramId]
        );
        await client.query(`
          UPDATE users SET
            bmak_balance = bmak_balance + 50,
            total_earned = total_earned + 50,
            total_referrals = total_referrals + 1,
            updated_at = NOW()
          WHERE telegram_id = $1
        `, [referredBy]);

        await client.query(`
          INSERT INTO transactions (telegram_id, type, amount, description)
          VALUES ($1, 'referral', 50, 'Referral bonus - new user joined')
        `, [referredBy]);

        await client.query(
          'UPDATE referrals SET bonus_paid = TRUE WHERE referrer_id = $1 AND referred_id = $2',
          [referredBy, telegramId]
        );
      }
    } finally {
      client.release();
    }

    const miniAppUrl = domain ? `https://${domain}` : null;

    const welcomeText = `
🌟 *Welcome to B\\_MAK Mini App!*

The complete blockchain rewards platform on BSC.

💎 *What you can do:*
• 📅 Daily check-in → earn *100 BMAK* per day
• 🔥 Streak bonuses → up to *3000 BMAK* for consistency
• 👥 Referral rewards → *50 BMAK* per friend you invite
• 💰 Multi-chain wallet support
• ⛓️ Real BSC blockchain transactions

Your referral code: \`${generateReferralCode(telegramId)}\`
    `.trim();

    const keyboard = miniAppUrl
      ? Markup.inlineKeyboard([
          [Markup.button.webApp('🚀 Open B_MAK App', miniAppUrl)],
          [Markup.button.callback('📊 My Stats', 'stats')],
          [Markup.button.callback('👥 Referrals', 'referrals')],
        ])
      : Markup.inlineKeyboard([
          [Markup.button.callback('📊 My Stats', 'stats')],
          [Markup.button.callback('👥 Referrals', 'referrals')],
        ]);

    await ctx.replyWithMarkdown(welcomeText, keyboard);
  });

  bot.action('stats', async (ctx) => {
    const client = await pool.connect();
    try {
      const res = await client.query(
        'SELECT * FROM users WHERE telegram_id = $1',
        [ctx.from.id]
      );
      if (!res.rows.length) return ctx.answerCbQuery('User not found');

      const u = res.rows[0];
      await ctx.editMessageText(`
📊 *Your B\\_MAK Stats*

💰 Balance: *${parseFloat(u.bmak_balance).toFixed(2)} BMAK*
🏆 Total Earned: *${parseFloat(u.total_earned).toFixed(2)} BMAK*
🔥 Streak: *${u.checkin_streak} days*
👥 Referrals: *${u.total_referrals}*
📅 Last Check-in: *${u.last_checkin ? new Date(u.last_checkin).toLocaleDateString() : 'Never'}*
      `.trim(), { parse_mode: 'Markdown' });
    } finally {
      client.release();
      ctx.answerCbQuery();
    }
  });

  bot.action('referrals', async (ctx) => {
    const code = generateReferralCode(ctx.from.id);
    const botUsername = ctx.botInfo?.username || 'bmak_miniapp_bot';
    const link = `https://t.me/${botUsername}?start=${code}`;
    await ctx.editMessageText(`
👥 *Your Referral Info*

🔗 Your referral link:
\`${link}\`

💎 Earn *50 BMAK* for each friend who joins!
    `.trim(), { parse_mode: 'Markdown' });
    ctx.answerCbQuery();
  });

  bot.on('message', (ctx) => {
    ctx.reply('Use /start to open the B_MAK Mini App! 🚀');
  });

  return bot;
}

module.exports = { createBot };

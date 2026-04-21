const { Telegraf, Markup } = require('telegraf');
const { supabase } = require('./db');
const { generateReferralCode } = require('./telegram');

function getMiniAppUrl() {
  if (process.env.MINI_APP_URL) return process.env.MINI_APP_URL;
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.APP_DOMAIN;
  return domain ? `https://${domain}` : null;
}

async function upsertUserOnStart(ctx) {
  if (!supabase) return;
  const telegramId = ctx.from.id;
  const startPayload = ctx.startPayload;
  const code = generateReferralCode(telegramId);

  let referrerRow = null;
  if (startPayload && startPayload.startsWith('BMAK')) {
    const { data } = await supabase
      .from('users')
      .select('id, telegram_id')
      .eq('referral_code', startPayload)
      .maybeSingle();
    if (data && data.telegram_id !== telegramId) referrerRow = data;
  }

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('users')
      .update({
        username: ctx.from.username || null,
        first_name: ctx.from.first_name || null,
        last_name: ctx.from.last_name || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return;
  }

  const { data: inserted } = await supabase
    .from('users')
    .insert({
      telegram_id: telegramId,
      username: ctx.from.username || null,
      first_name: ctx.from.first_name || null,
      last_name: ctx.from.last_name || null,
      referral_code: code,
      referred_by: referrerRow ? referrerRow.telegram_id : null,
      auth_type: 'telegram',
    })
    .select('id')
    .single();

  if (referrerRow && inserted) {
    await supabase.from('referrals').insert({
      referrer_db_id: referrerRow.id,
      referred_db_id: inserted.id,
      referrer_id: referrerRow.telegram_id,
      referred_id: telegramId,
      bonus_paid: true,
    });

    const { data: refUser } = await supabase
      .from('users')
      .select('bmak_balance, total_earned, total_referrals')
      .eq('id', referrerRow.id)
      .single();

    if (refUser) {
      await supabase
        .from('users')
        .update({
          bmak_balance: Number(refUser.bmak_balance || 0) + 50,
          total_earned: Number(refUser.total_earned || 0) + 50,
          total_referrals: Number(refUser.total_referrals || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', referrerRow.id);

      await supabase.from('transactions').insert({
        user_db_id: referrerRow.id,
        telegram_id: referrerRow.telegram_id,
        type: 'referral',
        amount: 50,
        description: 'Referral bonus - new user joined',
      });
    }
  }
}

function createBot() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('[Bot] No TELEGRAM_BOT_TOKEN — bot disabled');
    return null;
  }

  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

  bot.start(async (ctx) => {
    try {
      await upsertUserOnStart(ctx);
    } catch (e) {
      console.warn('[Bot] upsert error:', e.message);
    }

    const telegramId = ctx.from.id;
    const miniAppUrl = getMiniAppUrl();

    // Show pending notifications on /start
    if (supabase) {
      try {
        const { data: u } = await supabase.from('users').select('id').eq('telegram_id', telegramId).maybeSingle();
        if (u) {
          const { data: notifs } = await supabase
            .from('notifications').select('*')
            .eq('user_id', u.id).eq('read', false)
            .order('created_at', { ascending: false }).limit(5);
          if (notifs && notifs.length > 0) {
            const lines = notifs.map(n => `📬 *${n.title}*\n${n.message}`).join('\n\n');
            await ctx.replyWithMarkdown(lines);
            await supabase.from('notifications').update({ read: true })
              .eq('user_id', u.id).eq('read', false);
          }
        }
      } catch (e) { /* silent */ }
    }

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
    try {
      if (!supabase) return ctx.answerCbQuery('DB not configured');
      const { data: u } = await supabase
        .from('users')
        .select('bmak_balance, total_earned, checkin_streak, total_referrals, last_checkin')
        .eq('telegram_id', ctx.from.id)
        .maybeSingle();
      if (!u) return ctx.answerCbQuery('User not found');

      await ctx.editMessageText(`
📊 *Your B\\_MAK Stats*

💰 Balance: *${parseFloat(u.bmak_balance || 0).toFixed(2)} BMAK*
🏆 Total Earned: *${parseFloat(u.total_earned || 0).toFixed(2)} BMAK*
🔥 Streak: *${u.checkin_streak || 0} days*
👥 Referrals: *${u.total_referrals || 0}*
📅 Last Check-in: *${u.last_checkin ? new Date(u.last_checkin).toLocaleDateString() : 'Never'}*
      `.trim(), { parse_mode: 'Markdown' });
    } finally {
      ctx.answerCbQuery();
    }
  });

  bot.action('referrals', async (ctx) => {
    const code = generateReferralCode(ctx.from.id);
    const botUsername =
      ctx.botInfo?.username || process.env.TELEGRAM_BOT_USERNAME || 'B_MAK_officiel_bot';
    const link = `https://t.me/${botUsername}?start=${code}`;
    await ctx.editMessageText(`
👥 *Your Referral Info*

🔗 Your referral link:
\`${link}\`

💎 Earn *50 BMAK* for each friend who joins!
    `.trim(), { parse_mode: 'Markdown' });
    ctx.answerCbQuery();
  });

  bot.command('app', async (ctx) => {
    const miniAppUrl = getMiniAppUrl();
    if (!miniAppUrl) return ctx.reply('Mini app URL not configured.');
    await ctx.reply(
      'Open the B_MAK Mini App:',
      Markup.inlineKeyboard([[Markup.button.webApp('🚀 Open B_MAK App', miniAppUrl)]])
    );
  });

  bot.command('claim', async (ctx) => {
    const miniAppUrl = getMiniAppUrl();
    if (!supabase) return ctx.reply('Service indisponible.');
    const { data: u } = await supabase
      .from('users')
      .select('bmak_balance, wallet_address')
      .eq('telegram_id', ctx.from.id).maybeSingle();
    const min = parseInt(process.env.MIN_RECLAIM_AMOUNT || '1500', 10);
    const bal = Number(u?.bmak_balance || 0);
    if (!u) return ctx.reply('Compte introuvable. Tapez /start pour vous inscrire.');
    if (!u.wallet_address) {
      const kb = miniAppUrl
        ? Markup.inlineKeyboard([[Markup.button.webApp('🔗 Connecter wallet', miniAppUrl)]])
        : undefined;
      return ctx.reply('⚠️ Connectez d\'abord votre wallet BSC dans la mini app.', kb);
    }
    if (bal < min) return ctx.reply(`💰 Solde minimum requis : ${min} B_MAK\n(Solde actuel : ${bal.toLocaleString('fr-FR')})`);

    const kb = miniAppUrl
      ? Markup.inlineKeyboard([[Markup.button.webApp('💰 Réclamer dans l\'app', miniAppUrl)]])
      : undefined;
    return ctx.reply(`✅ Vous êtes éligible !\nSolde : ${bal.toLocaleString('fr-FR')} B_MAK\nWallet : ${u.wallet_address.slice(0,6)}...${u.wallet_address.slice(-4)}\n\nOuvrez la mini app pour confirmer la demande.`, kb);
  });

  bot.command('balance', async (ctx) => {
    if (!supabase) return ctx.reply('Service indisponible.');
    const { data: u } = await supabase
      .from('users')
      .select('bmak_balance, total_earned, checkin_streak, total_referrals')
      .eq('telegram_id', ctx.from.id).maybeSingle();
    if (!u) return ctx.reply('Compte introuvable. Tapez /start.');
    return ctx.replyWithMarkdown(`
💰 *Solde* : ${Number(u.bmak_balance||0).toLocaleString('fr-FR')} B\\_MAK
🏆 *Total gagné* : ${Number(u.total_earned||0).toLocaleString('fr-FR')} B\\_MAK
🔥 *Streak* : ${u.checkin_streak||0} jours
👥 *Filleuls* : ${u.total_referrals||0}
    `.trim());
  });

  bot.on('message', (ctx) => {
    const miniAppUrl = getMiniAppUrl();
    if (miniAppUrl) {
      return ctx.reply(
        'Use /start or tap below to open the B_MAK Mini App 🚀',
        Markup.inlineKeyboard([[Markup.button.webApp('🚀 Open B_MAK App', miniAppUrl)]])
      );
    }
    ctx.reply('Use /start to open the B_MAK Mini App! 🚀');
  });

  return bot;
}

module.exports = { createBot };

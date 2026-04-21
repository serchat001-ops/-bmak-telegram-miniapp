// Local development entry point. On Vercel, api/index.js is used instead.
const { app, getBot, initDb } = require('./app');

const PORT = process.env.API_PORT || 3001;

async function start() {
  try {
    await initDb();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] API running on port ${PORT}`);
    });

    const bot = getBot();
    if (bot) {
      const domain = process.env.REPLIT_DEV_DOMAIN;
      if (domain) {
        try {
          await bot.telegram.setWebhook(
            `https://${domain}/bot${process.env.TELEGRAM_BOT_TOKEN}`
          );
          console.log('[Bot] Webhook set to domain');
        } catch (e) {
          console.warn('[Bot] Webhook failed, using polling:', e.message);
          bot.launch();
        }
      } else {
        bot.launch();
        console.log('[Bot] Using polling mode');
      }

      process.once('SIGINT', () => bot.stop('SIGINT'));
      process.once('SIGTERM', () => bot.stop('SIGTERM'));
    }
  } catch (err) {
    console.error('[Startup] Fatal error:', err);
    process.exit(1);
  }
}

start();

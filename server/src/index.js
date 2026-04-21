require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');
const { createBot } = require('./bot');

const usersRouter = require('./routes/users');
const rewardsRouter = require('./routes/rewards');
const transactionsRouter = require('./routes/transactions');
const adminRouter = require('./routes/admin');
const walletRouter = require('./routes/wallet');
const reclamationsRouter = require('./routes/reclamations');
const notificationsRouter = require('./routes/notifications');

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());

app.use((req, res, next) => {
  if (req.path !== '/api/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/users', usersRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/reclamations', reclamationsRouter);
app.use('/api/notifications', notificationsRouter);

app.get('/api/config', (req, res) => {
  res.json({
    contractAddress: process.env.BMAK_CONTRACT_ADDRESS || null,
    network: 'BSC',
    chainId: 56,
    rpcUrl: 'https://bsc-dataseed.binance.org/',
    tokenSymbol: 'BMAK',
    dailyReward: 100,
    referralReward: 50,
    minReclaimAmount: parseInt(process.env.MIN_RECLAIM_AMOUNT || '1500', 10),
    adminEmail: process.env.ADMIN_EMAIL || null,
    adminEmails: (process.env.ADMIN_EMAILS ||
      'ben.makoma98@gmail.com,serchat001@gmail.com,officielbmak@gmail.com')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'B_MAK_officiel_bot',
  });
});

// Serve built frontend in production
const distPath = path.join(__dirname, '../../dist');
const fs = require('fs');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await initDb();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] API running on port ${PORT}`);
    });

    const bot = createBot();
    if (bot) {
      const domain = process.env.REPLIT_DEV_DOMAIN;
      if (domain) {
        try {
          await bot.telegram.setWebhook(`https://${domain}/bot${process.env.TELEGRAM_BOT_TOKEN}`);
          app.post(`/bot${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
            bot.handleUpdate(req.body, res);
          });
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

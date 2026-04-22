require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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

app.use(cors({ origin: true, credentials: true }));
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
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'B_MAK_Clean_Bot',
  });
});

// Telegram bot webhook (singleton across serverless invocations)
let _bot = null;
function getBot() {
  if (_bot) return _bot;
  _bot = createBot();
  return _bot;
}

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (botToken) {
  app.post(`/bot${botToken}`, (req, res) => {
    const bot = getBot();
    if (!bot) return res.status(503).send('bot unavailable');
    bot.handleUpdate(req.body, res);
  });
}

// One-shot endpoint to register the Telegram webhook on the deployed domain.
// Call once after deploy: GET /api/setup-webhook
app.get('/api/setup-webhook', async (req, res) => {
  try {
    if (!botToken) return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN missing' });
    const bot = getBot();
    if (!bot) return res.status(503).json({ error: 'bot unavailable' });
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const url = `${proto}://${host}/bot${botToken}`;
    await bot.telegram.setWebhook(url);
    res.json({ ok: true, webhook: url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Local-only: serve built frontend if dist/ exists (not used on Vercel)
const distPath = path.join(__dirname, '../../dist');
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

module.exports = { app, getBot, initDb };

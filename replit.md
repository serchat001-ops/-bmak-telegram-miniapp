# B_MAK Telegram Mini App

Complete blockchain Telegram Mini App with daily rewards, referral system, and BSC integration.

## Architecture

- **Frontend**: Vanilla HTML/CSS/JS served by Vite (port 5000) — Telegram WebApp UI
- **Backend**: Node.js + Express API (port 3001) — business logic, rewards, bot
- **Database**: Replit PostgreSQL — users, transactions, referrals
- **Blockchain**: BSC (BNB Smart Chain) via ethers.js
- **Bot**: Telegraf.js Telegram bot with webhook

## Project Structure

```
public/
  index.html       - Main app HTML shell
  style.css        - Complete UI styles
  app.js           - Frontend JS (API calls, state, UI)

server/
  src/
    index.js       - Express app entry + bot startup
    db.js          - PostgreSQL pool + schema init
    bot.js         - Telegraf Telegram bot
    telegram.js    - WebApp initData validation + utils
    routes/
      users.js     - Auth, profile, wallet endpoints
      rewards.js   - Daily check-in, referral bonuses
      transactions.js - Transaction history

vite.config.ts     - Vite dev server (serves public/, proxies /api → 3001)
```

## Workflows

- **Start application** — `npm run dev` on port 5000 (frontend + proxy)
- **Backend API** — `node server/src/index.js` on port 3001

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/config` | App config (contract addr, chain info) |
| POST | `/api/users/auth` | Authenticate/register Telegram user |
| GET | `/api/users/profile/:id` | Get user profile |
| POST | `/api/users/wallet` | Save wallet address |
| POST | `/api/rewards/checkin` | Daily check-in (100 BMAK) |
| GET | `/api/rewards/referrals/:id` | Get referral info + link |
| GET | `/api/transactions/:id` | Transaction history |

## Features

- 📅 **Daily Check-in** — 100 BMAK per day, with streak tracking
- 🔥 **Streak Bonuses** — 500 BMAK at 7d, 1000 at 14d, 3000 at 30d
- 👥 **Referral System** — 50 BMAK per referred friend
- 💼 **Wallet Tab** — Connect BSC wallet, view BMAK/BNB balances
- ⛓️ **BSC Integration** — Contract address configured, BSC mainnet
- 📋 **Transaction History** — All rewards and transactions logged
- 🤖 **Telegram Bot** — `/start` with referral support, stats, share links

## Environment Variables

| Key | Purpose |
|-----|---------|
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `BMAK_CONTRACT_ADDRESS` | BSC BMAK token contract |
| `DATABASE_URL` | Replit PostgreSQL (auto-provided) |
| `REPLIT_DEV_DOMAIN` | Auto-provided for webhook URL |

## Deployment

- Build: `npm run build` (Vite builds public/ → dist/)
- Run: `node server/src/index.js` (serves API + serves dist/ in prod)
- Target: Autoscale

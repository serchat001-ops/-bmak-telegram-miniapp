# B_MAK — Blockchain Rewards Platform

A complete blockchain rewards platform on BSC that works as both a **Telegram Mini App** and a **regular web app**, sharing the same PostgreSQL database.

## Architecture

- **Frontend**: Vanilla HTML/CSS/JS served by Vite (port 5000) — dual-mode UI (Telegram + Web)
- **Backend**: Node.js + Express API (port 3001) — business logic, rewards, bot
- **Database**: Replit PostgreSQL — users (web + telegram), transactions, referrals
- **Blockchain**: BSC (BNB Smart Chain) — BMAK token, wallet connect
- **Bot**: Telegraf.js Telegram bot with webhook/polling

## Auth Modes

- **Telegram mode**: Detected by `tg.initDataUnsafe?.user?.id`. Uses Telegram initData validation. Falls back to demo user in dev.
- **Web mode**: Triggered when no real Telegram user is present. Shows a login modal (display name only). Session stored as `bmak_web_uid` UUID in `localStorage`. Web users have `telegram_id = null` in DB.

## Project Structure

```
public/
  index.html       - App HTML (splash, web-login modal, main app)
  style.css        - Complete UI styles (dark theme + web-login styles)
  app.js           - Frontend JS (dual auth, API calls, state, UI)

server/
  src/
    index.js       - Express entry + bot startup + dist serving
    db.js          - PostgreSQL pool + schema + migrations
    bot.js         - Telegraf Telegram bot
    telegram.js    - initData validation + referral code gen
    routes/
      users.js     - Auth, web-register, web-session, profile, wallet
      rewards.js   - Daily check-in, streak bonuses, referral info
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
| POST | `/api/users/web-register` | Register new web user (displayName) → returns webUid |
| POST | `/api/users/web-session` | Restore web session (webUid) → returns user |
| GET | `/api/users/profile/:userId` | Get user profile by DB id |
| POST | `/api/users/wallet` | Save BSC wallet address (userId) |
| POST | `/api/rewards/checkin` | Daily check-in (100 BMAK) — uses userId |
| GET | `/api/rewards/referrals/:userId` | Get referral info + web/TG links |
| GET | `/api/transactions/:userId` | Transaction history |

## Database Schema

- **users**: `id`, `telegram_id` (nullable), `web_uid` (nullable), `auth_type` ('telegram'|'web'), `display_name`, `username`, `first_name`, `referral_code`, `bmak_balance`, `checkin_streak`, etc.
- **transactions**: `id`, `user_db_id` (FK → users.id), `telegram_id` (nullable), `type`, `amount`, `description`
- **referrals**: `id`, `referrer_db_id` / `referred_db_id` (FK → users.id), `bonus_paid`

## Features

- 📅 **Daily Check-in** — 100 BMAK per day, streak tracking
- 🔥 **Streak Bonuses** — 500 BMAK at 7d, 1000 at 14d, 3000 at 30d
- 👥 **Referral System** — 50 BMAK per invited friend (web + TG links)
- 💼 **Wallet** — Connect BSC wallet, view BMAK/BNB balances
- 🌐 **Web Mode** — Works outside Telegram; session via localStorage UUID
- 📱 **Telegram Mini App** — Full Telegram WebApp integration
- 📋 **Transaction History** — All rewards logged
- 🤖 **Telegram Bot** — `/start` referral support, stats

## Environment Variables

| Key | Purpose |
|-----|---------|
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `BMAK_CONTRACT_ADDRESS` | BSC BMAK token contract |
| `DATABASE_URL` | Replit PostgreSQL (auto-provided) |
| `REPLIT_DEV_DOMAIN` | Auto-provided for webhook URL |

## Deployment

- Build: `npm run build` (Vite builds public/ → dist/)
- Run: `node server/src/index.js` (serves API + dist/ in production)
- Target: Autoscale

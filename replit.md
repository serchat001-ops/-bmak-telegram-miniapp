# B_MAK Telegram Mini App

A complete blockchain Telegram Mini App built with React + TypeScript + Vite.

## Overview

A Telegram Mini App that provides a blockchain wallet experience with:
- **Wallet** - Portfolio overview, multi-token balances, send/receive/swap actions
- **History** - Transaction history with type filtering and monthly stats
- **Staking** - Staking pools with APY display, flexible and locked options

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Blockchain**: ethers.js v6
- **Telegram SDK**: @telegram-apps/sdk-react
- **Runtime**: Node.js 20

## Project Structure

```
src/
  App.tsx          - Root component with navigation tabs
  App.css          - App-level styles
  index.css        - Global CSS variables (Telegram theme vars)
  main.tsx         - Entry point
  pages/
    WalletPage.tsx       - Portfolio & assets view
    TransactionsPage.tsx - Transaction history
    StakingPage.tsx      - Staking pools & rewards
```

## Development

```bash
npm run dev    # Start dev server on port 5000
npm run build  # Build for production
```

## Configuration

- Dev server runs on `0.0.0.0:5000` with `allowedHosts: true` for Replit proxy compatibility
- Telegram WebApp SDK is loaded via CDN in `index.html`
- Theme adapts to Telegram's CSS variables

## Deployment

Configured as a **static** deployment:
- Build: `npm run build`
- Public dir: `dist`

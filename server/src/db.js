const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase')
    ? { rejectUnauthorized: false }
    : false,
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        referral_code TEXT UNIQUE,
        referred_by BIGINT,
        wallet_address TEXT,
        bmak_balance NUMERIC(20,4) DEFAULT 0,
        total_earned NUMERIC(20,4) DEFAULT 0,
        last_checkin DATE,
        checkin_streak INTEGER DEFAULT 0,
        total_referrals INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT NOT NULL,
        type TEXT NOT NULL,
        amount NUMERIC(20,4) NOT NULL,
        description TEXT,
        tx_hash TEXT,
        status TEXT DEFAULT 'completed',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_id BIGINT NOT NULL,
        referred_id BIGINT NOT NULL,
        bonus_paid BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_telegram_id ON transactions(telegram_id);
    `);
    console.log('[DB] Schema initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDb };

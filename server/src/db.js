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
    // ── Step 1: Create tables (if they don't exist) ──────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE,
        web_uid TEXT UNIQUE,
        auth_type TEXT DEFAULT 'telegram',
        username TEXT,
        display_name TEXT,
        first_name TEXT,
        last_name TEXT,
        referral_code TEXT UNIQUE,
        referred_by INTEGER,
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
        user_db_id INTEGER,
        telegram_id BIGINT,
        type TEXT NOT NULL,
        amount NUMERIC(20,4) NOT NULL,
        description TEXT,
        tx_hash TEXT,
        status TEXT DEFAULT 'completed',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_db_id INTEGER,
        referred_db_id INTEGER,
        referrer_id BIGINT,
        referred_id BIGINT,
        bonus_paid BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Step 2: Migrate existing tables (add new columns if missing) ─────────
    const migrations = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS web_uid TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_type TEXT DEFAULT 'telegram'`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT`,
      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_db_id INTEGER`,
      `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referrer_db_id INTEGER`,
      `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referred_db_id INTEGER`,
    ];
    for (const m of migrations) {
      try { await client.query(m); } catch (e) {}
    }

    // ── Step 3: Create indexes (after columns exist) ─────────────────────────
    const indexes = [
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_web_uid ON users(web_uid) WHERE web_uid IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_user_db_id ON transactions(user_db_id)`,
    ];
    for (const idx of indexes) {
      try { await client.query(idx); } catch (e) {}
    }

    console.log('[DB] Schema initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDb };

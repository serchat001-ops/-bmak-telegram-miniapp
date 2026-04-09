const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[DB] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// Raw SQL via Supabase RPC (for schema init / DDL)
async function rpc(sql) {
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) throw error;
}

async function initDb() {
  // We use Supabase's REST API for data operations.
  // For schema creation we use the pg REST endpoint with service key.
  // Supabase exposes /rest/v1/rpc — we'll create tables via raw SQL if the rpc exists,
  // otherwise verify tables exist via a select.

  // Check if tables exist by doing a simple select
  const { error: checkErr } = await supabase.from('users').select('id').limit(1);

  if (checkErr && checkErr.code === '42P01') {
    // Table doesn't exist — we need to create it via SQL
    // Use the pg endpoint (available in Supabase management API)
    console.warn('[DB] Tables missing. Please create them in the Supabase dashboard SQL editor:');
    console.warn(`
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
  } else if (checkErr) {
    console.warn('[DB] Check warning:', checkErr.message);
  }

  console.log('[DB] Supabase client ready');
}

module.exports = { supabase, initDb };

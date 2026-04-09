const express = require('express');
const router = express.Router();
const { supabase } = require('../db');

router.get('/:userId', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;

  try {
    const { data: transactions, error, count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_db_id', req.params.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ transactions: transactions || [], total: count || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;

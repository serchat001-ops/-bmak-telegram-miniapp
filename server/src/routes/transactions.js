const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/:userId', async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM transactions
      WHERE user_db_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.params.userId, Math.min(parseInt(limit), 100), parseInt(offset)]);

    const countRes = await client.query(
      'SELECT COUNT(*) FROM transactions WHERE user_db_id = $1',
      [req.params.userId]
    );

    res.json({ transactions: result.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
});

module.exports = router;

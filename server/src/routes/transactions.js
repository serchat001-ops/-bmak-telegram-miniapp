const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/:telegramId', async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM transactions
      WHERE telegram_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.params.telegramId, Math.min(parseInt(limit), 100), parseInt(offset)]);

    const countRes = await client.query(
      'SELECT COUNT(*) FROM transactions WHERE telegram_id = $1',
      [req.params.telegramId]
    );

    res.json({
      transactions: result.rows,
      total: parseInt(countRes.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
});

router.get('/stats/:telegramId', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        type,
        SUM(amount) as total,
        COUNT(*) as count
      FROM transactions
      WHERE telegram_id = $1
      GROUP BY type
    `, [req.params.telegramId]);
    res.json({ stats: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
});

module.exports = router;

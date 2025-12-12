const express = require('express');
const router = express.Router();

// GET /api/admin
router.get('/', (req, res) => {
  res.json({
    message: 'GET /api/admin not implemented yet',
  });
});

// GET /api/admin/raw-sql
// (později: endpoint pro demonstrační "špatné" SQL dotazy)
router.get('/raw-sql', (req, res) => {
  res.json({
    message: 'GET /api/admin/raw-sql not implemented yet',
  });
});

// POST /api/admin/reset-db
// (volitelně: reset/seed databáze pro demo)
router.post('/reset-db', (req, res) => {
  res.json({
    message: 'POST /api/admin/reset-db not implemented yet',
  });
});

module.exports = router;

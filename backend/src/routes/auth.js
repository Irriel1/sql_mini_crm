const express = require('express');
const { login, register, demoRawLogin } = require('../controllers/authController');
const { DEMO_VULN } = require('../config');
const router = express.Router();

// 🛠 správný import middleware:
const { authMiddleware } = require('../middleware/auth');

// DB instance
const { pool } = require('../db');

//   GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      'SELECT id, email, name, role, created_at FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('GET /auth/me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// standard endpoints
router.post('/login', login);
router.post('/register', register);

// optional vulnerable route
if (DEMO_VULN) {
  router.post('/demo/raw-login', demoRawLogin);
}
module.exports = router;

const express = require('express');
const { DEMO_SQLI_LAB } = require('../../config');
const { authMiddleware, requireRole } = require('../../middleware/auth');
const { run } = require('./SqliLabService');

const router = express.Router();

router.post('/run',
  authMiddleware,
  requireRole('admin'),
  (req, res, next) => {
    if (!DEMO_SQLI_LAB) return res.status(404).json({ error: 'Not found' });
    return next();
  },
  async (req, res) => {
    const result = await run({ user: req.user, input: req.body });
    res.json(result);
  }
);

module.exports = router;
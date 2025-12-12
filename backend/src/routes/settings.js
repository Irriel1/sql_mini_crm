// src/routes/settings.js
const express = require('express');
const { authMiddleware } = require('../middleware/auth.js');
const { requireRole } = require('../middleware/requireRole.js');
const settingsController = require('../controllers/settingsController');

const router = express.Router();

// GET /api/settings
router.get('/', authMiddleware, settingsController.getSettings);

// PUT /api/settings
router.put('/', authMiddleware, requireRole("admin"), settingsController.updateSettings);

module.exports = router;

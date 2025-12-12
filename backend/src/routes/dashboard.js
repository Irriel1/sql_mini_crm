// src/routes/dashboard.js
const express = require('express');
const { authMiddleware } = require('../middleware/auth.js');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

// GET /api/dashboard
router.get('/', authMiddleware, dashboardController.getDashboard);

module.exports = router;

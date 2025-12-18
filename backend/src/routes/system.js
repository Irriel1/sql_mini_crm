const express = require('express');
const { authMiddleware } = require('../middleware/auth.js');
const systemController = require('../controllers/systemController');

const router = express.Router();

// systémový healthcheck
router.get('/health', authMiddleware, systemController.getHealth);

// verze aplikace
router.get('/version', authMiddleware, systemController.getVersion);

// detailnější info
router.get('/info', authMiddleware, systemController.getInfo);

module.exports = router;

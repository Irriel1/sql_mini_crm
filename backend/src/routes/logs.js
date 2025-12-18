const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.js');
const logsController = require('../controllers/logsController');

const router = express.Router()

router.get('/', authMiddleware, requireRole('admin'), logsController.listLogs);
router.get('/:id', authMiddleware, requireRole('admin'), logsController.getLog);

module.exports = router;

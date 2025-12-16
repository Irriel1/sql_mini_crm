const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const inventoryMovementsController = require('../controllers/inventoryMovementsController');

const router = express.Router();

router.get('/ping', (req, res) => res.json({ ok: true }));

function requireDemoVuln(req, res, next) {
  if (process.env.DEMO_VULN !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

// /api/demo/inventory-movements
router.get(
  '/inventory-movements',
  authMiddleware,
  requireDemoVuln,
  requireRole('admin'),
  inventoryMovementsController.listMovementsVuln
);

router.post(
  '/inventory-movements',
  authMiddleware,
  requireDemoVuln,
  requireRole('admin'),
  inventoryMovementsController.createMovementDemo
);

module.exports = router;

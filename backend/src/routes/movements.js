const express = require('express');
const { authMiddleware } = require('../middleware/auth.js');
const inventoryMovementsController = require('../controllers/inventoryMovementsController');

const router = express.Router();

// GET /api/inventory-movements
router.get('/', authMiddleware, inventoryMovementsController.listMovements);
// GET /api/inventory-movements/:id
router.get('/:id', authMiddleware, inventoryMovementsController.getMovement);
// POST /api/inventory-movements
router.post('/', authMiddleware, inventoryMovementsController.createMovement);

module.exports = router;
// src/routes/items.js
const express = require('express');
const { authMiddleware } = require('../middleware/auth.js');
const { requireRole } = require('../middleware/requireRole.js');
const itemsController = require('../controllers/itemsController');
const variantsController = require('../controllers/variantsController');

const router = express.Router();

// GET /api/items?search=&limit=&offset=&sort=&dir=
router.get('/', authMiddleware, itemsController.listItems);

// GET /api/items/:id
router.get('/:id', authMiddleware, itemsController.getItem);

// POST /api/items
router.post('/', authMiddleware, itemsController.createItem);

// PUT /api/items/:id
router.put('/:id', authMiddleware, requireRole('admin'), itemsController.updateItem); // only admin can update items

// DELETE /api/items/:id
router.delete('/:id', authMiddleware, requireRole('admin'), itemsController.deleteItem); // only admin can delete items

// VARIANTS ROUTES NESTED UNDER ITEMS

// GET /api/items/:itemId/variants
router.get('/:itemId/variants', authMiddleware, variantsController.listVariantsForItem);

// POST /api/items/:itemId/variants
router.post('/:itemId/variants', authMiddleware, variantsController.createVariantForItem);

module.exports = router;

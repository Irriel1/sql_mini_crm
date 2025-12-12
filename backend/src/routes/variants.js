const express = require('express');
const { authMiddleware } = require('../middleware/auth.js');
const variantsController = require('../controllers/variantsController');

const router = express.Router();

// GET /api/variants/:id
router.get('/:id', authMiddleware, variantsController.getVariant);

// PUT /api/variants/:id
router.put('/:id', authMiddleware, variantsController.updateVariant);

// DELETE /api/variants/:id
router.delete('/:id', authMiddleware, variantsController.deleteVariant);

module.exports = router;

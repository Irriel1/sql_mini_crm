const express = require('express');
const { authMiddleware } = require('../middleware/auth.js');
const variantsController = require('../controllers/variantsController');

const router = express.Router();

router.get('/:id', authMiddleware, variantsController.getVariant);

router.put('/:id', authMiddleware, variantsController.updateVariant);

router.delete('/:id', authMiddleware, variantsController.deleteVariant); // edge-case safe

module.exports = router;
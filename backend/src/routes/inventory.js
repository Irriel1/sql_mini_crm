const express = require('express');
const { authMiddleware } = require('../middleware/auth.js');

const router = express.Router();

// Placeholder inventory endpointy nejsou verejne. I kdyz zatim vraci jen text,
// patri do stejne chranene skladove vrstvy jako inventory movements.
router.use(authMiddleware);

// GET /api/inventory
// (souhrnný přehled skladových zásob)
router.get('/', (req, res) => {
  res.json({
    message: 'GET /api/inventory not implemented yet',
  });
});

// GET /api/inventory/:variantId
router.get('/:variantId', (req, res) => {
  res.json({
    message: 'GET /api/inventory/:variantId not implemented yet',
    variantId: req.params.variantId,
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();

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

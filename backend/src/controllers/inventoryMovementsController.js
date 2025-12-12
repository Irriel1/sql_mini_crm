// src/controllers/inventoryMovementsController.js
const Joi = require('joi');
const inventoryMovementsDao = require('../dao/inventoryMovementsDao');
const variantsDao = require('../dao/variantsDao');

const listSchema = Joi.object({
  variant_id: Joi.number().integer().min(1).optional(),
  type: Joi.string().valid('IN', 'OUT', 'ADJUST').optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
  offset: Joi.number().integer().min(0).optional(),
});

const createSchema = Joi.object({
  variant_id: Joi.number().integer().min(1).required(),
  type: Joi.string().valid('IN', 'OUT', 'ADJUST').required(),
  quantity: Joi.number().integer().min(0).required(),
  note: Joi.string().allow('', null).optional(),
});

// GET /api/inventory-movements
async function listMovements(req, res, next) {
  try {
    const query = req.query || {};
    const { error, value = {} } = listSchema.validate(query, {
      abortEarly: true,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const limit = value.limit || 50;
    const offset = value.offset || 0;
    const variantId = value.variant_id;
    const type = value.type;

    const movements = await inventoryMovementsDao.getMovements({
      variantId,
      type,
      limit,
      offset,
    });

    res.json({ movements, limit, offset });
  } catch (err) {
    next(err);
  }
}

// GET /api/inventory-movements/:id
async function getMovement(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const movement = await inventoryMovementsDao.getMovementById(id);

    if (!movement) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json({ movement });
  } catch (err) {
    next(err);
  }
}

// POST /api/inventory-movements
async function createMovement(req, res, next) {
  try {
    const body = req.body || {};
    const { error, value = {} } = createSchema.validate(body, {
      abortEarly: true, // Return all errors, not just the first one
      stripUnknown: true, // Remove unknown properties
    });

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Existence varianty
    const variant = await variantsDao.getVariantById(value.variant_id);
    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    // user_id z tokenu
    const userId = req.user?.id || null;

    try {
      const movement = await inventoryMovementsDao.createMovement({
        variant_id: value.variant_id,
        user_id: userId,
        type: value.type,
        quantity: value.quantity,
        note: value.note
      });

      res.status(201).json({ movement });

    } catch (err) {
      if (err.code === 'NEGATIVE_STOCK') {
        return res.status(400).json({ error: 'Stock cannot go negative' });
      }
      if (err.code === 'INVALID_TYPE') {
        return res.status(400).json({ error: 'Invalid type' });
      }
      throw err;
    }

  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMovements,
  getMovement,
  createMovement,
};
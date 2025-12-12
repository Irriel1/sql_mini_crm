const Joi = require('joi');
const variantsDao = require('../dao/variantsDao');
const itemsDao = require('../dao/itemsDao');

const listByItemSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).optional(),
  offset: Joi.number().integer().min(0).optional(),
});

const variantBodySchema = Joi.object({
  variant_name: Joi.string().min(1).required(),
  sku: Joi.string().max(100).allow('', null).optional(),
  attributes: Joi.object().unknown(true).optional(),
  price: Joi.number().precision(2).min(0).optional(),
  stock_count: Joi.number().integer().min(0).optional(),
});

// GET /api/items/:itemId/variants
async function listVariantsForItem(req, res, next) {
  try {
    const itemId = parseInt(req.params.itemId, 10);
    if (Number.isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid itemId' });
    }

    const { error, value = {} } = listByItemSchema.validate(req.query || {});
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const limit = value.limit ? parseInt(value.limit, 10) : 25;
    const offset = value.offset ? parseInt(value.offset, 10) : 0;

    const item = await itemsDao.getItemById(itemId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const variants = await variantsDao.getVariantsByItemId(itemId, { limit, offset });

    res.json({ itemId, variants });
  } catch (err) {
    next(err);
  }
}

// POST /api/items/:itemId/variants
async function createVariantForItem(req, res, next) {
  try {
    const itemId = parseInt(req.params.itemId, 10);
    if (Number.isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid itemId' });
    }

    const body = req.body || {};
    const { error, value = {} } = variantBodySchema.validate(body, {
      abortEarly: true,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    if (!value.variant_name) {
      return res.status(400).json({ error: 'variant_name is required' });
    }

    const item = await itemsDao.getItemById(itemId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const variant = await variantsDao.createVariant(itemId, {
      sku: value.sku,
      variant_name: value.variant_name,
      attributes: value.attributes,
      price: value.price,
      stock_count: value.stock_count,
    });

    res.status(201).json({ variant });
  } catch (err) {
    next(err);
  }
}

// GET /api/variants/:id
async function getVariant(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const variant = await variantsDao.getVariantById(id);
    if (!variant) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json({ variant });
  } catch (err) {
    next(err);
  }
}

// PUT /api/variants/:id
async function updateVariant(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const body = req.body || {};
    const { error, value = {} } = variantBodySchema.validate(body, {
      abortEarly: true,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    if (!value.variant_name) {
      return res.status(400).json({ error: 'variant_name is required' });
    }

    const updated = await variantsDao.updateVariant(id, {
      sku: value.sku,
      variant_name: value.variant_name,
      attributes: value.attributes,
      price: value.price,
      stock_count: value.stock_count,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json({ variant: updated });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/variants/:id
async function deleteVariant(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const deleted = await variantsDao.deleteVariant(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listVariantsForItem,
  createVariantForItem,
  getVariant,
  updateVariant,
  deleteVariant,
};
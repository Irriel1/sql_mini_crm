// src/controllers/inventoryMovementsController.js
const Joi = require('joi');
const inventoryMovementsDao = require('../dao/inventoryMovementsDao');
const variantsDao = require('../dao/variantsDao');

/**
 * SAFE list schema (tight validation)
 * Query params: variant_id, type, note, limit, offset
 */
const listSchema = Joi.object({
  variant_id: Joi.number().integer().min(1).optional(),
  type: Joi.string().valid('IN', 'OUT', 'ADJUST').optional(),
  note: Joi.string().allow('', null).optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
  offset: Joi.number().integer().min(0).optional(),
});

/**
 * CREATE schema (safe)
 */
const createSchema = Joi.object({
  variant_id: Joi.number().integer().min(1).required(),
  type: Joi.string().valid('IN', 'OUT', 'ADJUST').required(),
  quantity: Joi.number().integer().min(1).required(),
  note: Joi.string().allow('', null).optional(),
});

/**
 * VULN list schema (intentionally loose)
 * NOTE: allow strings for numeric fields and free-form sort/dir etc.
 */
const vulnListSchema = Joi.object({
  variant_id: Joi.string().optional(), // intentionally string
  type: Joi.string().optional(),       // intentionally free
  note: Joi.string().optional(),       // intentionally free (note-based demo)
  user_id: Joi.string().optional(),
  date_from: Joi.string().optional(),
  date_to: Joi.string().optional(),
  sort: Joi.string().optional(),
  dir: Joi.string().optional(),
  limit: Joi.string().optional(),
  offset: Joi.string().optional(),
}).unknown(true);

/**
 * SAFE: GET /api/inventory-movements
 */
async function listMovements(req, res, next) {
  try {
    const query = req.query || {};
    const { error, value = {} } = listSchema.validate(query, {
      abortEarly: true,
      stripUnknown: true,
    });
    if (error) return res.status(400).json({ error: error.details[0].message });

    const limit = value.limit ?? 50;
    const offset = value.offset ?? 0;

    const movements = await inventoryMovementsDao.getMovements({
      variantId: value.variant_id ?? null,
      type: value.type ?? null,
      note: value.note ?? null,
      limit,
      offset,
    });

    // audit "read/list"
     {/*
    await req.audit.commit({
      action: "MOVEMENTS_LIST",
      meta: {
        filters: {
          variant_id: value.variant_id ?? null,
          type: value.type ?? null,
          note: value.note ?? null,
          limit,
          offset,
        },
        result_count: movements.length,
      },
    });
      */}
    return res.json({ movements, limit, offset });
  } catch (err) {
    next(err);
  }
}

/**
 * DEMO/VULN: GET /api/demo/inventory-movements
 * (admin-only + DEMO_VULN gating řeší router/middleware)
 */
async function listMovementsVuln(req, res, next) {
  try {
    const { error, value = {} } = vulnListSchema.validate(req.query || {}, {
      abortEarly: true,
      stripUnknown: true,
    });
    if (error) return res.status(400).json({ error: error.details[0].message });

    const movements = await inventoryMovementsDao.getMovementsVuln({
      variantId: value.variant_id,
      type: value.type,
      note: value.note,
      userId: value.user_id,
      dateFrom: value.date_from,
      dateTo: value.date_to,
      sort: value.sort,
      dir: value.dir,
      limit: value.limit,
      offset: value.offset,
    });

    // Audit demo/vuln list – užitečné pro dohledávání "co kdo zkoušel"
    await req.audit.commit({
      action: "MOVEMENTS_VULN_LIST",
      meta: {
        // meta záměrně jen v tom, co se validovalo ve vulnListSchema
        // (neukládat celý req.query bez kontroly)
        filters: {
          variant_id: value.variant_id ?? null,
          type: value.type ?? null,
          note: value.note ?? null,
          user_id: value.user_id ?? null,
          date_from: value.date_from ?? null,
          date_to: value.date_to ?? null,
          sort: value.sort ?? null,
          dir: value.dir ?? null,
          limit: value.limit ?? null,
          offset: value.offset ?? null,
        },
        result_count: Array.isArray(movements) ? movements.length : null,
      },
    });

    return res.json({ movements });
  } catch (err) {
    next(err);
  }
}

/**
 * SAFE: GET /api/inventory-movements/:id
 */
async function getMovement(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const movement = await inventoryMovementsDao.getMovementById(id);
    if (!movement) return res.status(404).json({ error: 'Not found' });

    // (Volitelné) audit read detail
    {/*
    await req.audit.commit({
      action: "MOVEMENT_READ",
      meta: { movement_id: id, variant_id: movement.variant_id },
    });

      */}
    return res.json({ movement });
  } catch (err) {
    next(err);
  }
}

/**
 * SAFE: POST /api/inventory-movements
 */
async function createMovement(req, res, next) {
  try {
    const body = req.body || {};
    const { error, value = {} } = createSchema.validate(body, {
      abortEarly: true,
      stripUnknown: true,
    });
    if (error) return res.status(400).json({ error: error.details[0].message });

    // ověření varianty (ať máme i item_id / sku / name pro audit meta)
    const variant = await variantsDao.getVariantById(value.variant_id);
    if (!variant) return res.status(404).json({ error: 'Variant not found' });

    const userId = req.user.id;

    const movement = await inventoryMovementsDao.createMovement({
      variant_id: value.variant_id,
      user_id: userId,
      type: value.type,
      quantity: value.quantity,
      note: value.note,
    });

    // Audit až po úspěchu
    await req.audit.commit({
      action: "MOVEMENT_CREATE",
      meta: {
        movement_id: movement.id,
        variant_id: movement.variant_id,
        item_id: variant.item_id,
        type: movement.type,
        quantity: movement.quantity,
        note: movement.note ?? null,
      },
    });

    return res.status(201).json({ movement });
  } catch (err) {
    if (err.code === 'NEGATIVE_STOCK') return res.status(400).json({ error: 'Stock cannot go negative' });
    if (err.code === 'INVALID_TYPE') return res.status(400).json({ error: 'Invalid type' });
    if (err.code === 'VARIANT_NOT_FOUND') return res.status(404).json({ error: 'Variant not found' });
    next(err);
  }
}

/**
 * DEMO: POST /api/demo/inventory-movements
 * Intentionally STILL SAFE create (to avoid arbitrary SQL write).
 */
async function createMovementDemo(req, res, next) {
  // Necháme to projít stejným SAFE create, a tím pádem se i audit provede stejně.
  // Pokud chceš odlišit demo create v logu, udělej tady vlastní commit s jinou action.
  return createMovement(req, res, next);
}

module.exports = {
  listMovements,
  listMovementsVuln,
  getMovement,
  createMovement,
  createMovementDemo,
};

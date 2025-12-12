// src/controllers/settingsController.js
const Joi = require('joi');
const settingsDao = require('../dao/settingsDao');

const settingsSchema = Joi.object({
  warehouse_name: Joi.string().max(255).optional(),
  currency: Joi.string().length(3).uppercase().optional(),
  low_stock_threshold: Joi.number().integer().min(0).optional(),
  id: Joi.forbidden(), // id se nesmí měnit přes API
});

const SETTINGS_ID = 1; // jediný řádek v tabulce

// GET /api/settings
async function getSettings(req, res, next) {
  try {
    const settings = await settingsDao.getSettings();

    if (!settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

// PUT /api/settings
async function updateSettings(req, res, next) {
  try {
    const body = req.body || {};
    const { error, value = {} } = settingsSchema.validate(body, {
      stripUnknown: true,
      abortEarly: true,
    });

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // zjistíme, jestli byl zaslán aspoň jeden povolený field
    const hasAnyField =
      value.warehouse_name !== undefined ||
      value.currency !== undefined ||
      value.low_stock_threshold !== undefined;

    if (!hasAnyField) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await settingsDao.updateSettings(SETTINGS_ID, {
      warehouse_name: value.warehouse_name,
      currency: value.currency,
      low_stock_threshold: value.low_stock_threshold,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    res.json({ settings: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSettings,
  updateSettings,
};

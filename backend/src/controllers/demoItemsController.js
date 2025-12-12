// src/controllers/demoItemsController.js
const demoItemsDao = require('../dao/demoItemsDao');

/**
 * GET /api/demo/items/search-raw?search=...
 * ZRANITELNÉ:
 * - žádná validace
 * - žádné limit/offset
 * - search jde přímo do SQL
 */
async function searchRaw(req, res, next) {
  try {
    const search = req.query.search || '';
    const items = await demoItemsDao.searchItemsRaw(search);
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/demo/items/:id-raw
 * ZRANITELNÉ:
 * - id je použito přímo ve SQL
 */
async function getItemRaw(req, res, next) {
  try {
    const id = req.params.id; // žádný parseInt, žádná kontrola
    const item = await demoItemsDao.getItemByIdRaw(id);

    if (!item) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json({ item });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  searchRaw,
  getItemRaw,
};

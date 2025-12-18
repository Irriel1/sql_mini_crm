// src/controllers/itemsController.js
const Joi = require('joi');
const itemsDao = require('../dao/itemsDao');

const listItemsSchema = Joi.object({
  search: Joi.string().allow('').optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  offset: Joi.number().integer().min(0).optional(),
  sort: Joi.string().valid('name', 'category', 'created_at').optional(),
  dir: Joi.string().valid('ASC', 'DESC').optional(),
});

const itemBodySchema = Joi.object({
  name: Joi.string().min(1).required(),
  category: Joi.string().allow('').optional(),
  description: Joi.string().allow('').optional(),
});
  
  async function createItem(req, res, next) { // vytvořit novou položku
    try {
      const body = req.body || {}; // jistota, že není undefined
  
      const { error, value = {} } = itemBodySchema.validate(body, {
        abortEarly: true,
        stripUnknown: true,
      });
  
      if (error) {
        // kdyby "name" chybělo / bylo prázdné
        return res.status(400).json({ error: error.details[0].message });
      }
  
      // extra bezpečnost – kdyby z nějakého důvodu value.name nebylo
      if (!value.name) {
        return res.status(400).json({ error: 'Name is required' });
      }
  
      const item = await itemsDao.createItem({
        name: value.name,
        category: value.category || '',
        description: value.description || '',
      });
  
      if (!item) {
        // kdyby z nějakého důvodu INSERT proběhl divně
        return res.status(500).json({ error: 'Failed to create item' });
      }
      await req.audit.commit({
        action: "ITEM_CREATE",
        meta: { item_id: item.id, name: item.name }
      });
  
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  }

async function listItems(req, res, next) { // seznam položek
  try {
    const { error, value } = listItemsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const search = value.search || '';
    const limit = value.limit ? parseInt(value.limit, 10) : 25;
    const offset = value.offset ? parseInt(value.offset, 10) : 0;
    const sort = value.sort || 'name';
    const dir = value.dir || 'ASC';

    const items = await itemsDao.getItems({ search, limit, offset, sort, dir });

    res.json({ items });
  } catch (err) {
    next(err);
  }
}

async function getItem(req, res, next) {
  try {
    const id = Number(req.params.id);

    // přísnější validace než parseInt (nepropustí "12abc")
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const item = await itemsDao.getItemById(id);
    if (!item) {
      return res.status(404).json({ error: "Not found" });
    }

    // načtení variants pro item
    const variants = await itemsDao.getVariantsByItemId(id);

    // agregace pro UI (statistiky)
    const stock_total = variants.reduce(
      (sum, v) => sum + Number(v.stock_count ?? 0),
      0
    );

    return res.json({
      ...item,                 // rozbalí item fields (id,name,category,...)
      variants,                // pole variant
      variants_count: variants.length,
      stock_total,
    });
  } catch (err) {
    next(err);
  }
}


async function updateItem(req, res, next) { // aktualizovat existující položku
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const { error, value } = itemBodySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const item = await itemsDao.updateItem(id, {
      name: value.name,
      category: value.category || '',
      description: value.description || '',
    });

    if (!item) {
      return res.status(404).json({ error: 'Not found' });
    }

    await req.audit.commit({
      action: "ITEM_UPDATE",
      meta: { item_id: item.id, fields: ["name", "category", "description"] }
    });

    res.json({ item });
  } catch (err) {
    next(err);
  }
}

async function deleteItem(req, res, next) { // smazat položku (soft delete)
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const item = await itemsDao.getItemById(id);
    if (!item) return res.status(404).json({ error: 'Not found' });

    const deleted = await itemsDao.softDeleteItem(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Not found' });
    }
    await req.audit.commit({
      action: "ITEM_DELETE",
      meta: { item_id: id, name: item.name }
    });
    return res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
};

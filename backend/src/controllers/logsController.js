const Joi = require('joi');
const logsDao = require('../dao/logsDao');

const listSchema = Joi.object({
  user_id: Joi.number().integer().min(1).optional(),
  action: Joi.string().max(255).optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
  offset: Joi.number().integer().min(0).optional(),
});

// GET /api/logs
async function listLogs(req, res, next) {
  try {
    const query = req.query || {};
    const { error, value = {} } = listSchema.validate(query, {
      stripUnknown: true,
      abortEarly: true
    });

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const limit = value.limit || 50;
    const offset = value.offset || 0;
    const userId = value.user_id || undefined;
    const action = value.action || undefined;

    const logs = await logsDao.getLogs({
      userId,
      action,
      limit,
      offset
    });

    res.json({ logs, limit, offset });
  } catch (err) {
    next(err);
  }
}

// GET /api/logs/:id
async function getLog(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const log = await logsDao.getLogById(id);
    if (!log) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json({ log });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listLogs,
  getLog
};

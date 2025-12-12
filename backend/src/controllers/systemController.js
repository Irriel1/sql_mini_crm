// src/controllers/systemController.js
const systemDao = require('../dao/systemDao');

// pokusíme se načíst verzi z package.json
let appVersion = '0.0.1';
try {
  // podle struktury projektu můžeš upravit cestu
  // pokud máš backend/package.json, možná bude potřeba "../package.json" nebo "../../package.json"
  const pkg = require('../../package.json');
  appVersion = pkg.version || appVersion;
} catch (e) {
  // necháme defaultní verzi
}

// GET /api/system/health
async function getHealth(req, res, next) {
  try {
    const dbOk = await systemDao.pingDb();

    res.json({
      status: 'ok',
      server_time: new Date().toISOString(),
      uptime_seconds: Math.round(process.uptime()),
      db: {
        ok: dbOk,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/system/version
async function getVersion(req, res, next) {
  try {
    res.json({
      version: appVersion,
      node: process.version,
      env: process.env.NODE_ENV || 'development',
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/system/info
async function getInfo(req, res, next) {
  try {
    const dbOk = await systemDao.pingDb();

    res.json({
      app: {
        version: appVersion,
        env: process.env.NODE_ENV || 'development',
      },
      runtime: {
        node: process.version,
        uptime_seconds: Math.round(process.uptime()),
        pid: process.pid,
      },
      db: {
        ok: dbOk,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getHealth,
  getVersion,
  getInfo,
};

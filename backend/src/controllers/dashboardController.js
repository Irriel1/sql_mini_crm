// src/controllers/dashboardController.js
const dashboardDao = require('../dao/dashboardDao');
const settingsDao = require('../dao/settingsDao');

async function getDashboard(req, res, next) {
  try {
    const settings = await settingsDao.getSettings();
    const threshold = settings?.low_stock_threshold ?? 5;

    const [
      itemCount,
      variantCount,
      totalStock,
      lowStock,
      movements,
      recentItems
    ] = await Promise.all([
      dashboardDao.getItemCount(),
      dashboardDao.getVariantCount(),
      dashboardDao.getTotalStock(),
      dashboardDao.getLowStockVariants(threshold),
      dashboardDao.getRecentMovements(5),
      dashboardDao.getRecentItems(5),
    ]);

    res.json({
      items_total: itemCount,
      variants_total: variantCount,
      stock_total: totalStock,
      low_stock_threshold: threshold,
      low_stock_variants: lowStock,
      recent_movements: movements,
      recent_items: recentItems
    });

  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboard,
};
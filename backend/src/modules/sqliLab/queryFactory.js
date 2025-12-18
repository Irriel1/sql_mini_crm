function create({ pattern, target, mode, q, limit }) {
    // boolean-based SQLi lab - items
    if (pattern === 'boolean' && target === 'items') {
  
      if (mode === 'safe') {
        return {
          sql: `
            SELECT id, name, category, created_at
            FROM items
            WHERE deleted_at IS NULL
              AND name LIKE ?
            ORDER BY id DESC
            LIMIT ?
          `,
          params: [`%${q}%`, limit],
          meta: {},
        };
      }
  
      const safeLimit = Math.max(1, Math.min(50, Number(limit || 20)));
  
      return {
        sql: `
          SELECT id, name, category, created_at
          FROM items
          WHERE deleted_at IS NULL
            AND name LIKE '%${q}%'
          ORDER BY id DESC
          LIMIT ${safeLimit}
        `,
        params: [],
        meta: {},
      };
    }
    // boolean-based SQLi lab - variants
    if (pattern === 'boolean' && target === 'variants') {

        if (mode === 'safe') {
          return {
            sql: `
              SELECT
                v.id,
                v.sku,
                v.variant_name,
                v.price,
                v.stock_count,
                i.name AS item_name
              FROM item_variants v
              JOIN items i ON i.id = v.item_id
              WHERE v.sku LIKE ?
              ORDER BY v.id DESC
              LIMIT ?
            `,
            params: [`%${q}%`, limit],
            meta: {},
          };
        }
      
        const safeLimit = Math.max(1, Math.min(50, Number(limit || 20)));
      
        return {
          sql: `
            SELECT
              v.id,
              v.sku,
              v.variant_name,
              v.price,
              v.stock_count,
              i.name AS item_name
            FROM item_variants v
            JOIN items i ON i.id = v.item_id
            WHERE v.sku LIKE '%${q}%'
            ORDER BY v.id DESC
            LIMIT ${safeLimit}
          `,
          params: [],
          meta: {},
        };
      }
    
    // union-based SQLi lab - variants
    if (pattern === 'union' && target === 'variants') {

        if (mode === 'safe') {
          return {
            sql: `
              SELECT
                v.id,
                v.sku,
                v.variant_name,
                v.price,
                v.stock_count,
                i.name AS item_name
              FROM item_variants v
              JOIN items i ON i.id = v.item_id
              WHERE v.sku LIKE ?
              ORDER BY v.id DESC
              LIMIT ?
            `,
            params: [`%${q}%`, limit],
            meta: {},
          };
        }
      
        const safeLimit = Math.max(1, Math.min(50, Number(limit || 20)));
      
        return {
          sql: `
            SELECT
              v.id,
              v.sku,
              v.variant_name,
              v.price,
              v.stock_count,
              i.name AS item_name
            FROM item_variants v
            JOIN items i ON i.id = v.item_id
            WHERE v.sku LIKE '%${q}%'
            ORDER BY 1 DESC
            LIMIT ${safeLimit}
          `,
          params: [],
          meta: {},
        };
    }
    // error-based SQLi lab - variants
    if (pattern === 'error' && target === 'variants') {
        if (mode === 'safe') {
          // safe: parametrizace, žádné raw skládání
          return {
            sql: `
              SELECT v.id, v.sku, v.variant_name, v.price, v.stock_count, i.name AS item_name
              FROM item_variants v
              JOIN items i ON i.id = v.item_id
              WHERE v.sku LIKE ?
              ORDER BY 1 DESC
              LIMIT ?
            `,
            params: [`%${q}%`, limit],
            meta: {},
          };
        }
      
        const safeLimit = Math.max(1, Math.min(50, Number(limit || 20)));
      
        // vuln: q jde do SQL stringu, aby šlo vyvolat chybu
        return {
          sql: `
            SELECT v.id, v.sku, v.variant_name, v.price, v.stock_count, i.name AS item_name
            FROM item_variants v
            JOIN items i ON i.id = v.item_id
            WHERE v.sku LIKE '%${q}%'
            ORDER BY 1 DESC
            LIMIT ${safeLimit}
          `,
          params: [],
          meta: {},
        };
      }
    // time based SQLi lab - variants
    if (pattern === 'time' && target === 'variants') {
        if (mode === 'safe') {
          return {
            sql: `
              SELECT v.id, v.sku, v.variant_name, v.price, v.stock_count, i.name AS item_name
              FROM item_variants v
              JOIN items i ON i.id = v.item_id
              WHERE v.id = (SELECT MIN(id) FROM item_variants)
                AND v.sku LIKE ?
              LIMIT 1
            `,
            params: [`%${q}%`],
            meta: {},
          };
        }
      
        return {
          sql: `
            SELECT v.id, v.sku, v.variant_name, v.price, v.stock_count, i.name AS item_name
            FROM item_variants v
            JOIN items i ON i.id = v.item_id
            WHERE v.id = (SELECT MIN(id) FROM item_variants)
              AND v.sku LIKE '%${q}%'
            LIMIT 1
          `,
          params: [],
          meta: {},
        };
      }
      

    throw new Error('Unsupported pattern/target');
  }
  
  module.exports = { create };
  
  
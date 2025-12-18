const { validateAndNormalize } = require('./validators');
const { getStrategy } = require('./strategies/registry');
const { create } = require('./queryFactory');
const { pool } = require('../../db');

async function runQueryWithHardTimeout(sql, params, timeoutMs = 15000) {
    const conn = await pool.getConnection();
    const threadId = conn.threadId;
  
    if (!threadId) {
      conn.release();
      throw new Error('No threadId on connection (cannot KILL)');
    }
  
    let timer;
    let timedOut = false;
  
    try {
      const queryPromise = conn.query(sql, params);
  
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(async () => {
          timedOut = true;
          let killer;
          try {
            killer = await pool.getConnection();
            await killer.query(`KILL ${threadId}`); // kill whole connection
          } catch (_) {
            // ignore
          } finally {
            if (killer) killer.release();
          }
          reject(new Error('Query timeout'));
        }, timeoutMs);
      });
  
      const [rows] = await Promise.race([queryPromise, timeoutPromise]);
      return rows;
    } catch (err) {
      // Když jsme timeoutnuli, mysql2 často vyhodí "Connection lost"
      const msg = String(err?.message || '');
      if (timedOut && /Connection lost|closed the connection|PROTOCOL_CONNECTION_LOST/i.test(msg)) {
        throw new Error('Query timeout');
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
      // po KILL může být conn mrtvý, release je ok (pool si to ošetří)
      conn.release();
    }
  }

async function run({ user, input }) {
  const started = Date.now();

  const requestedMode = input?.mode || 'safe';
  const norm = validateAndNormalize(input);
  const strategy = getStrategy(norm.pattern);
  const plan = strategy.buildPlan(norm);

  let rows = [];
  let errOut = null;

  try {
    const query = create(plan.factoryInput);
  
    const rowsRaw = await runQueryWithHardTimeout(query.sql, query.params, 12000);
  
    rows = Array.isArray(rowsRaw) ? rowsRaw.slice(0, 20) : [];
  } catch (err) {
    console.error('SQLILAB ERROR:', err);
    const msg = err?.message ? String(err.message) : 'Query failed';
    const allowDetail = Boolean(plan.allowDbErrorInResponse);
  
    errOut = allowDetail ? msg.slice(0, 300) : 'Query failed';
  }
  
  const durationMs = Date.now() - started;
  

  return {
    requestedMode,
    mode: norm.mode,
    pattern: norm.pattern,
    target: norm.target,
    durationMs,
    rowCount: rows.length,
    dataPreview: rows,
    error: errOut,
    note: plan.note || null,
  };
  
}

module.exports = { run, runQueryWithHardTimeout };

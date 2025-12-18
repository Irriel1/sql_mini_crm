const { DEMO_VULN } = require('../../config');

const PATTERNS = new Set(['boolean', 'union', 'error', 'time']);
const TARGETS = new Set(['items', 'variants', 'users']);


function validateAndNormalize(input = {}) {
  const pattern = String(input.pattern || 'boolean');
  const target = String(input.target || 'items');

  if (!PATTERNS.has(pattern)) throw new Error('Invalid pattern');
  if (!TARGETS.has(target)) throw new Error('Invalid target');

  // mode: safe/vuln – vuln povolíme jen když DEMO_VULN=true
  const requestedMode = String(input.mode || 'safe');
  const mode = (requestedMode === 'vuln' && DEMO_VULN) ? 'vuln' : 'safe';

  const q = typeof input.q === 'string' ? input.q : '';
  if (q.length > 200) throw new Error('Payload too long');

  const limitRaw = Number(input.limit ?? 20);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 20;

  const delayMsRaw = Number(input.delayMs ?? 0);
  const delayMs = Number.isFinite(delayMsRaw) ? Math.max(0, Math.min(5000, delayMsRaw)) : 0;

  return { pattern, target, mode, q, limit, delayMs };
}

module.exports = { validateAndNormalize };
const { DEMO_VULN } = require('../../config');

const PATTERNS = new Set(['boolean', 'union', 'error', 'time']);
const TARGETS = new Set(['items', 'variants', 'users']);
const MODES = new Set(['safe', 'vuln']);

function validationError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function validateAndNormalize(input = {}) {
  const pattern = String(input.pattern || 'boolean');
  const target = String(input.target || 'items');

  if (!PATTERNS.has(pattern)) throw validationError('Invalid pattern');
  if (!TARGETS.has(target)) throw validationError('Invalid target');
  // MODE: SAFE / VULN
  const requestedMode = String(input.mode || 'safe');
  if (!MODES.has(requestedMode)) throw validationError('Invalid mode');

  const mode =
    requestedMode === 'vuln' && DEMO_VULN
      ? 'vuln'
      : 'safe';

  // PAYLOAD → q (FE uses "payload")
  const qRaw =
    typeof input.payload === 'string'
      ? input.payload
      : typeof input.q === 'string'
        ? input.q
        : '';

  const q = String(qRaw).trimStart();

  if (q.length > 200) {
    throw validationError('Payload too long');
  }
  // LIMIT
  const limitRaw = Number(input.limit ?? 20);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(50, limitRaw))
    : 20;

  return {
    pattern,
    target,
    mode,
    q,          // ← payload propagates
    limit,
  };
}

module.exports = { validateAndNormalize };

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Unauthorized' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    try {
      // authMiddleware MUSÍ běžet předtím → req.user existuje
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userRole = req.user.role;

      // pokud role není v allowedRoles → 403
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: 'Forbidden: insufficient privileges' });
      }

      // user má povolenou roli → pokračujeme
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { authMiddleware, requireRole };

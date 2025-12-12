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
  
  module.exports = {
    requireRole,
  };
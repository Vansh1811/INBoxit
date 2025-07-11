// middleware/auth.js
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    // Passport sets req.isAuthenticated()
    return next();
  }
  // Not authenticated, send 401
  return res.status(401).json({ error: 'Unauthorized: Please log in.' });
}

module.exports = { ensureAuthenticated };

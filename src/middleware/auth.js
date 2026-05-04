const jwt = require('jsonwebtoken');
const config = require('../../config/config');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, config.auth.jwtSecret, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired — please log in again' });
      }
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Optional auth — attaches user if token present, but doesn't block
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    jwt.verify(token, config.auth.jwtSecret, (err, user) => {
      if (!err) req.user = user;
      next();
    });
  } else {
    next();
  }
}

module.exports = { authenticateToken, optionalAuth };

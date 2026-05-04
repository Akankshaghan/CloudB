const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/register
router.post('/register', authController.register);

// GET /api/auth/profile  [protected]
router.get('/profile', authenticateToken, authController.getProfile);

// POST /api/auth/cloud-account  [protected] — add a new cloud account
router.post('/cloud-account', authenticateToken, authController.addCloudAccount);

// DELETE /api/auth/cloud-account/:cloud  [protected]
router.delete('/cloud-account/:cloud', authenticateToken, authController.removeCloudAccount);

// GET /api/auth/admin/users [protected] - admin only
router.get('/admin/users', authenticateToken, authController.getAllUsersAdmin);

// DELETE /api/auth/admin/users/:id [protected] - admin only
router.delete('/admin/users/:id', authenticateToken, authController.deleteUserAdmin);

// GET /api/auth/admin/config [protected] - read current env settings
router.get('/admin/config', authenticateToken, authController.getAdminConfig);

// POST /api/auth/admin/config [protected] - update env settings live
router.post('/admin/config', authenticateToken, authController.saveAdminConfig);

module.exports = router;

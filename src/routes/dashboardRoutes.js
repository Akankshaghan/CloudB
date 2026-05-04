const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth');

// All dashboard routes are protected
router.use(authenticateToken);

// GET /api/dashboard/status — data source mode (mock or real)
router.get('/status', dashboardController.getDataSourceStatus);

// GET /api/dashboard/multi-cloud?clouds=aws,azure,gcp — summary across clouds
router.get('/multi-cloud', dashboardController.getMultiCloudSummary);

// GET /api/dashboard/:cloud — full dashboard data for a cloud
router.get('/:cloud', dashboardController.getDashboard);

// GET /api/dashboard/:cloud/services — all services for a cloud
router.get('/:cloud/services', dashboardController.getServices);

// GET /api/dashboard/:cloud/alerts — alerts for a cloud
router.get('/:cloud/alerts', dashboardController.getAlerts);

// GET /api/dashboard/:cloud/service/:service — specific service detail
router.get('/:cloud/service/:service', dashboardController.getServiceDetail);

// GET /api/dashboard/:cloud/service/:service/instance/:instanceId — specific resource
router.get('/:cloud/service/:service/instance/:instanceId', dashboardController.getInstanceDetail);

// POST /api/dashboard/:cloud/refresh — force refresh cache
router.post('/:cloud/refresh', dashboardController.refreshCache);

// POST /api/dashboard/refresh — refresh all clouds
router.post('/refresh', dashboardController.refreshCache);

module.exports = router;

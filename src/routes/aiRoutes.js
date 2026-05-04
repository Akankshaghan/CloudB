const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/auth');

// All AI routes are protected
router.use(authenticateToken);

// GET /api/ai/overview/:cloud — dashboard-level AI cost overview
router.get('/overview/:cloud', aiController.getDashboardOverview);

// GET /api/ai/instance/:cloud/:service/:instanceId — instance-level AI analysis
router.get('/instance/:cloud/:service/:instanceId', aiController.getInstanceAnalysis);

// GET /api/ai/migration/:cloud?targetCloud=aws — migration advice
router.get('/migration/:cloud', aiController.getMigrationAdvice);

// GET /api/ai/best-cloud?clouds=aws,azure,gcp — best cloud recommendation
router.get('/best-cloud', aiController.getBestCloudRecommendation);

// POST /api/ai/chat — interactive AI chat
router.post('/chat', aiController.chat);

// POST /api/ai/chat/clear — clear chat history
router.post('/chat/clear', aiController.clearChatHistory);

module.exports = router;

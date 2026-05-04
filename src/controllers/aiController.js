const geminiService = require('../services/ai/geminiService');
const dataSourceService = require('../services/dataSourceService');

// Per-session chat histories (keyed by userId+cloud)
const chatHistories = {};

function getChatKey(userId, cloud, context) {
  return `${userId}-${cloud}-${context}`;
}

// ─── DASHBOARD AI OVERVIEW ────────────────────────────────────────────────────
async function getDashboardOverview(req, res) {
  try {
    const { cloud } = req.params;
    const userId = req.user?.id;
    const cloudData = await dataSourceService.getData(cloud, userId);
    const analysis = await geminiService.generateOverview(cloudData, cloud);
    return res.json({ success: true, cloud, analysis });
  } catch (err) {
    console.error('[AI] getDashboardOverview error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── INSTANCE AI ANALYSIS ────────────────────────────────────────────────────
async function getInstanceAnalysis(req, res) {
  try {
    const { cloud, service, instanceId } = req.params;
    const userId = req.user?.id;
    const cloudData = await dataSourceService.getData(cloud, userId);
    const serviceData = cloudData.services?.[service];

    if (!serviceData) {
      return res.status(404).json({ success: false, message: `Service '${service}' not found` });
    }

    const resourceArrays = ['instances', 'functions', 'buckets', 'tables', 'distributions', 'clusters', 'databases', 'accounts', 'plans', 'environments', 'applications', 'shares'];
    let instance = null;
    for (const key of resourceArrays) {
      if (serviceData[key]) {
        instance = serviceData[key].find(i => i.id === instanceId || i.name === instanceId);
        if (instance) break;
      }
    }

    if (!instance) {
      return res.status(404).json({ success: false, message: `Resource '${instanceId}' not found` });
    }

    const analysis = await geminiService.generateInstanceAnalysis({ ...instance, service: serviceData.service_name, cloud }, cloud);
    return res.json({ success: true, cloud, service, instanceId, analysis });
  } catch (err) {
    console.error('[AI] getInstanceAnalysis error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── MIGRATION ADVICE ────────────────────────────────────────────────────────
async function getMigrationAdvice(req, res) {
  try {
    const { cloud } = req.params;
    const { targetCloud } = req.query;
    const userId = req.user?.id;
    const cloudData = await dataSourceService.getData(cloud, userId);
    const advice = await geminiService.generateMigrationAdvice(cloudData, cloud, targetCloud);
    return res.json({ success: true, currentCloud: cloud, targetCloud: targetCloud || 'best fit', advice });
  } catch (err) {
    console.error('[AI] getMigrationAdvice error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── MULTI-CLOUD BEST RECOMMENDATION ─────────────────────────────────────────
async function getBestCloudRecommendation(req, res) {
  try {
    const { clouds } = req.query;
    const cloudList = clouds ? clouds.split(',').filter(c => ['aws','azure','gcp'].includes(c)) : ['aws'];
    const userId = req.user?.id;
    const multiCloudData = await dataSourceService.getMultiCloudData(cloudList, userId);
    const recommendation = await geminiService.recommendBestCloud(multiCloudData);
    return res.json({ success: true, clouds: cloudList, recommendation });
  } catch (err) {
    console.error('[AI] getBestCloudRecommendation error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── INTERACTIVE CHAT ────────────────────────────────────────────────────────
async function chat(req, res) {
  try {
    const { message, cloud, context } = req.body;
    const userId = req.user?.id || 'anonymous';

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ success: false, message: 'Message too long (max 2000 chars)' });
    }

    // Load cloud data context if cloud is specified
    let cloudData = null;
    if (cloud && ['aws', 'azure', 'gcp'].includes(cloud)) {
      try {
        cloudData = await dataSourceService.getData(cloud, userId);
      } catch (_) {}
    }

    // Get or init chat history
    const chatKey = getChatKey(userId, cloud || 'general', context || 'dashboard');
    if (!chatHistories[chatKey]) chatHistories[chatKey] = [];

    const history = chatHistories[chatKey];
    const response = await geminiService.chat(message.trim(), cloudData, history);

    // Update history (keep last 20 messages to avoid context overflow)
    history.push({ role: 'user', content: message.trim() });
    history.push({ role: 'model', content: response });
    if (history.length > 40) history.splice(0, 2); // remove oldest pair

    return res.json({
      success: true,
      message: response,
      historyLength: history.length / 2,
    });
  } catch (err) {
    console.error('[AI] chat error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── CLEAR CHAT HISTORY ───────────────────────────────────────────────────────
async function clearChatHistory(req, res) {
  const { cloud, context } = req.body;
  const userId = req.user?.id || 'anonymous';
  const chatKey = getChatKey(userId, cloud || 'general', context || 'dashboard');
  chatHistories[chatKey] = [];
  return res.json({ success: true, message: 'Chat history cleared' });
}

module.exports = {
  getDashboardOverview, getInstanceAnalysis, getMigrationAdvice,
  getBestCloudRecommendation, chat, clearChatHistory
};

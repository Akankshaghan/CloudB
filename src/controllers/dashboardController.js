const dataSourceService = require('../services/dataSourceService');

// ─── GET DASHBOARD SUMMARY ────────────────────────────────────────────────────
async function getDashboard(req, res) {
  try {
    const { cloud } = req.params;
    const userId = req.user?.id;
    const data = await dataSourceService.getData(cloud, userId);
    const mode = dataSourceService.getDataSourceMode(userId);

    return res.json({
      success: true,
      dataMode: mode.mode,
      isMockData: !mode.useRealData,
      cloud,
      summary: data.summary,
      meta: data.meta,
      alerts: data.alerts || [],
      top_cost_services: data.top_cost_services || [],
      cost_breakdown_by_tag: data.cost_breakdown_by_tag || {},
      services_overview: Object.entries(data.services || {}).map(([key, svc]) => ({
        key,
        service_name: svc.service_name,
        icon: svc.icon,
        monthly_cost: svc.monthly_cost,
        cost_percentage: svc.cost_percentage,
        trend: svc.trend,
        trend_percent: svc.trend_percent,
        cost_history: svc.cost_history || [],
        months: svc.months || [],
        resource_count:
          (svc.instances || svc.functions || svc.buckets || svc.tables ||
           svc.distributions || svc.clusters || svc.databases ||
           svc.accounts || svc.plans || svc.environments ||
           svc.applications || svc.shares || []).length,
      })),
    });
  } catch (err) {
    console.error('[Dashboard] getDashboard error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET ALL SERVICES FOR A CLOUD ─────────────────────────────────────────────
async function getServices(req, res) {
  try {
    const { cloud } = req.params;
    const userId = req.user?.id;
    const data = await dataSourceService.getData(cloud, userId);

    return res.json({
      success: true,
      cloud,
      services: data.services,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET SPECIFIC SERVICE DETAIL ──────────────────────────────────────────────
async function getServiceDetail(req, res) {
  try {
    const { cloud, service } = req.params;
    const userId = req.user?.id;
    const data = await dataSourceService.getData(cloud, userId);

    const serviceData = data.services?.[service];
    if (!serviceData) {
      return res.status(404).json({
        success: false,
        message: `Service '${service}' not found for cloud '${cloud}'`,
      });
    }

    return res.json({
      success: true,
      cloud,
      service,
      data: serviceData,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET SPECIFIC INSTANCE / RESOURCE DETAIL ──────────────────────────────────
async function getInstanceDetail(req, res) {
  try {
    const { cloud, service, instanceId } = req.params;
    const userId = req.user?.id;
    const data = await dataSourceService.getData(cloud, userId);

    const serviceData = data.services?.[service];
    if (!serviceData) {
      return res.status(404).json({ success: false, message: `Service '${service}' not found` });
    }

    // Find the resource in any array within the service
    const resourceArrays = ['instances', 'functions', 'buckets', 'tables', 'distributions', 'clusters', 'databases', 'accounts', 'plans', 'environments', 'applications', 'shares'];
    let instance = null;

    for (const arrayKey of resourceArrays) {
      if (serviceData[arrayKey]) {
        instance = serviceData[arrayKey].find(item =>
          item.id === instanceId || item.name === instanceId
        );
        if (instance) break;
      }
    }

    if (!instance) {
      return res.status(404).json({ success: false, message: `Resource '${instanceId}' not found` });
    }

    return res.json({
      success: true,
      cloud,
      service,
      service_name: serviceData.service_name,
      instance,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET MULTI-CLOUD SUMMARY ──────────────────────────────────────────────────
async function getMultiCloudSummary(req, res) {
  try {
    const { clouds } = req.query; // e.g. ?clouds=aws,azure,gcp
    const cloudList = clouds ? clouds.split(',').filter(c => ['aws','azure','gcp'].includes(c)) : ['aws'];
    const userId = req.user?.id;
    const results = await dataSourceService.getMultiCloudData(cloudList, userId);
    const mode = dataSourceService.getDataSourceMode(userId);

    const summary = {};
    for (const [cloud, data] of Object.entries(results)) {
      if (data.error) {
        summary[cloud] = { error: data.error };
      } else {
        summary[cloud] = {
          total_monthly_cost: data.summary?.total_monthly_cost,
          active_services: data.summary?.active_services,
          total_resources: data.summary?.total_resources,
          cost_alerts: data.alerts?.length || 0,
          top_service: data.top_cost_services?.[0],
        };
      }
    }

    return res.json({ success: true, dataMode: mode.mode, summary });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET ALERTS ───────────────────────────────────────────────────────────────
async function getAlerts(req, res) {
  try {
    const { cloud } = req.params;
    const userId = req.user?.id;
    const data = await dataSourceService.getData(cloud, userId);
    return res.json({ success: true, cloud, alerts: data.alerts || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── DATA SOURCE STATUS ───────────────────────────────────────────────────────
async function getDataSourceStatus(req, res) {
  const userId = req.user?.id;
  const mode = dataSourceService.getDataSourceMode(userId);
  return res.json({ success: true, ...mode });
}

// ─── REFRESH CACHE ───────────────────────────────────────────────────────────
async function refreshCache(req, res) {
  const { cloud } = req.params;
  const userId = req.user?.id;
  dataSourceService.invalidateCache(cloud || null, userId);
  return res.json({ success: true, message: `Cache cleared for ${cloud || 'all clouds'}` });
}

module.exports = {
  getDashboard, getServices, getServiceDetail, getInstanceDetail,
  getMultiCloudSummary, getAlerts, getDataSourceStatus, refreshCache
};

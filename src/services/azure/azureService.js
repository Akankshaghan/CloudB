const config = require('../../../config/config');
const axios = require('axios');

/**
 * Azure Real-Data Service
 * Uses Azure REST API via axios (bearer token auth)
 * Only called when USE_REAL_DATA=true
 */

let accessToken = null;
let tokenExpiry = null;

// ─── AUTH ─────────────────────────────────────────────────────────────────────
async function getAccessToken(credentials, resource = 'https://management.azure.com/') {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) return accessToken;

  if (!credentials || !credentials.tenantId || !credentials.clientId || !credentials.clientSecret) {
    throw new Error('Azure credentials not provided. Please connect your Azure account.');
  }

  const url = `https://login.microsoftonline.com/${credentials.tenantId}/oauth2/token`;
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    resource,
  });

  const resp = await axios.post(url, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  accessToken = resp.data.access_token;
  tokenExpiry = Date.now() + (resp.data.expires_in - 60) * 1000;
  return accessToken;
}

// ─── API CALL HELPER ─────────────────────────────────────────────────────────
async function azureGet(path, credentials) {
  const token = await getAccessToken(credentials);
  const baseUrl = 'https://management.azure.com';
  const resp = await axios.get(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return resp.data;
}

// ─── VMs ──────────────────────────────────────────────────────────────────────
async function fetchVirtualMachines(credentials) {
  const subId = credentials.subscriptionId;
  const data = await azureGet(`/subscriptions/${subId}/providers/Microsoft.Compute/virtualMachines?api-version=2023-03-01`, credentials);
  return (data.value || []).map(vm => ({
    id: vm.id,
    name: vm.name,
    size: vm.properties?.hardwareProfile?.vmSize,
    region: vm.location,
    status: vm.properties?.provisioningState,
    tags: vm.tags || {},
    monthly_cost: 0,
    recommendations: [],
  }));
}

// ─── COST MANAGEMENT ─────────────────────────────────────────────────────────
async function fetchCosts(credentials) {
  const subId = credentials.subscriptionId;
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const token = await getAccessToken(credentials);
  const resp = await axios.post(
    `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.CostManagement/query?api-version=2023-03-01`,
    {
      type: 'Usage',
      timeframe: 'Custom',
      timePeriod: { from: `${startDate}T00:00:00+00:00`, to: `${endDate}T00:00:00+00:00` },
      dataset: {
        granularity: 'Monthly',
        grouping: [{ type: 'Dimension', name: 'ServiceName' }],
        aggregation: { totalCost: { name: 'PreTaxCost', function: 'Sum' } },
      },
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );

  const services = {};
  for (const row of resp.data?.properties?.rows || []) {
    services[row[1]] = (services[row[1]] || 0) + row[0];
  }
  return services;
}

// ─── MAIN FETCH ALL ───────────────────────────────────────────────────────────
async function fetchAll(credentials) {
  if (!credentials || !credentials.subscriptionId) {
    throw new Error('Azure credentials not provided. Please connect your Azure account.');
  }

  const [vms, costs] = await Promise.allSettled([fetchVirtualMachines(credentials), fetchCosts(credentials)]);
  const serviceCosts = costs.value || {};
  const totalCost = Object.values(serviceCosts).reduce((a, v) => a + v, 0);

  return {
    meta: { cloud: 'azure', subscription_id: credentials.subscriptionId, last_updated: new Date().toISOString() },
    summary: {
      total_monthly_cost: parseFloat(totalCost.toFixed(2)),
      active_services: 8,
      total_resources: (vms.value || []).length,
      cost_alerts: 0,
      projected_monthly_cost: parseFloat((totalCost * 1.08).toFixed(2)),
    },
    services: {
      virtual_machines: { service_name: 'Azure Virtual Machines', monthly_cost: serviceCosts['Virtual Machines'] || 0, instances: vms.value || [] },
    },
    alerts: [],
    top_cost_services: Object.entries(serviceCosts).map(([service, cost]) => ({ service, cost: parseFloat(cost.toFixed(2)) })).sort((a, b) => b.cost - a.cost).slice(0, 10),
  };
}

module.exports = { fetchAll };

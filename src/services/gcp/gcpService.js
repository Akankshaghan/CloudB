const config = require('../../../config/config');
const axios = require('axios');

/**
 * GCP Real-Data Service
 * Uses GCP REST APIs with API Key or Service Account
 * Only called when USE_REAL_DATA=true
 */

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function getApiKey(credentials) {
  if (!credentials || (!credentials.apiKey && !credentials.credentialsFile)) {
    throw new Error('GCP credentials not provided. Please connect your GCP account.');
  }
  return credentials.apiKey || credentials.credentialsFile;
}

// ─── COMPUTE ENGINE ───────────────────────────────────────────────────────────
async function fetchComputeInstances(credentials) {
  const apiKey = getApiKey(credentials);
  const projectId = credentials.projectId;
  if (!projectId) return [];
  const url = `https://compute.googleapis.com/compute/v1/projects/${projectId}/aggregated/instances?key=${apiKey}`;

  try {
    const resp = await axios.get(url);
    const instances = [];
    for (const [zone, zoneData] of Object.entries(resp.data.items || {})) {
      for (const inst of zoneData.instances || []) {
        instances.push({
          id: inst.selfLink,
          name: inst.name,
          machine_type: inst.machineType?.split('/').pop(),
          status: inst.status,
          zone: zone.replace('zones/', ''),
          tags: inst.labels || {},
          monthly_cost: 0,
          recommendations: [],
        });
      }
    }
    return instances;
  } catch (err) {
    if (err.response?.status === 403 || err.response?.status === 401) {
      throw new Error('Invalid GCP API Key or Project ID.');
    }
    throw err;
  }
}

// ─── CLOUD STORAGE ────────────────────────────────────────────────────────────
async function fetchStorageBuckets(credentials) {
  const apiKey = getApiKey(credentials);
  const projectId = credentials.projectId;
  if (!projectId) return [];
  const url = `https://storage.googleapis.com/storage/v1/b?project=${projectId}&key=${apiKey}`;

  try {
    const resp = await axios.get(url);
    return (resp.data.items || []).map(b => ({
      id: b.id,
      name: b.name,
      location: b.location,
      storage_class: b.storageClass,
      monthly_cost: 0,
      recommendations: [],
    }));
  } catch (err) {
     return [];
  }
}

// ─── BILLING DATA (Cloud Billing API) ────────────────────────────────────────
async function fetchBillingData() {
  // Note: Cloud Billing Export to BigQuery is recommended for production
  // This is a simplified stub that returns structured data
  console.warn('[GCP] Billing API requires BigQuery export setup — returning estimates');
  return {};
}

// ─── MAIN FETCH ALL ───────────────────────────────────────────────────────────
async function fetchAll(credentials) {
  if (!credentials || !credentials.projectId) {
    throw new Error('GCP credentials not provided. Please connect your GCP account.');
  }

  const [instances, buckets] = await Promise.allSettled([
    fetchComputeInstances(credentials), fetchStorageBuckets(credentials),
  ]);

  if (instances.status === 'rejected') {
    throw new Error(instances.reason.message || 'Failed to fetch GCP Compute Engine resources.');
  }

  return {
    meta: { cloud: 'gcp', project_id: credentials.projectId, last_updated: new Date().toISOString() },
    summary: {
      total_monthly_cost: 0,
      active_services: 8,
      total_resources: (instances.value || []).length + (buckets.value || []).length,
      cost_alerts: 0,
      projected_monthly_cost: 0,
    },
    services: {
      compute_engine: { service_name: 'Compute Engine', monthly_cost: 0, instances: instances.value || [] },
      cloud_storage: { service_name: 'Cloud Storage', monthly_cost: 0, buckets: buckets.value || [] },
    },
    alerts: [],
    top_cost_services: [],
  };
}

module.exports = { fetchAll };

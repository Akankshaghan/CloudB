const config = require('../../config/config');
const path = require('path');
const fs = require('fs');

const usersFilePath = path.join(__dirname, '../../data/users.json');

function getUserCredentials(userId, cloud) {
  if (!fs.existsSync(usersFilePath)) return null;
  const usersData = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
  const creds = usersData.credentials[userId]?.[cloud] || null;
  if (!creds) return null;
  if (creds.credentials) {
    return creds.credentials;
  }
  return creds;
}

// In-memory store — single source of truth for both mock & real data
// Structured as dataStore[userId] = { aws: null, azure: null, ... }
let dataStore = {};

// ─── MOCK DATA LOADER ─────────────────────────────────────────────────────────
function loadMockData(cloud) {
  const filePath = path.join(__dirname, '../../data/mock', `${cloud}-mock.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Mock data file not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// ─── REAL DATA LOADERS (stubbed — connected in individual cloud services) ─────
async function fetchAWSData(credentials) {
  const awsService = require('./aws/awsService');
  return awsService.fetchAll(credentials);
}

async function fetchAzureData(credentials) {
  const azureService = require('./azure/azureService');
  return azureService.fetchAll(credentials);
}

async function fetchGCPData(credentials) {
  const gcpService = require('./gcp/gcpService');
  return gcpService.fetchAll(credentials);
}

// ─── MAIN DATA FETCHER — Reads the USE_REAL_DATA flag ─────────────────────────
async function getData(cloud, userId) {
  if (!['aws', 'azure', 'gcp'].includes(cloud)) {
    throw new Error(`Unknown cloud provider: ${cloud}`);
  }

  // Initialize store for user if not exists
  if (!dataStore[userId]) {
    dataStore[userId] = { aws: null, azure: null, gcp: null, lastUpdated: null };
  }
  const userStore = dataStore[userId];

  // Return cached data if fresh (< 5 minutes)
  if (userStore[cloud] && userStore.lastUpdated) {
    const ageMs = Date.now() - userStore.lastUpdated;
    if (ageMs < 5 * 60 * 1000) {
      return userStore[cloud];
    }
  }

  let data;
  if (config.useRealData) {
    if (!userId || userId === 'anonymous') {
      throw new Error(`You must be logged in to fetch real data for ${cloud}.`);
    }

    const credentials = getUserCredentials(userId, cloud);
    if (!credentials) {
      throw new Error(`${cloud.toUpperCase()} credentials not configured for your account. Please connect your account first.`);
    }

    console.log(`[DataSource] USE_REAL_DATA=true — fetching live ${cloud.toUpperCase()} data for user ${userId}`);
    try {
      if (cloud === 'aws') data = await fetchAWSData(credentials);
      else if (cloud === 'azure') data = await fetchAzureData(credentials);
      else if (cloud === 'gcp') data = await fetchGCPData(credentials);
    } catch (err) {
      console.error(`[DataSource] ⚠️ Real data fetch failed for ${cloud}: ${err.message}`);
      throw new Error(`Real data fetch failed: ${err.message}`);
    }
  } else {
    console.log(`[DataSource] USE_REAL_DATA=false — loading mock ${cloud.toUpperCase()} data`);
    data = loadMockData(cloud);
  }

  // Store in memory cache
  userStore[cloud] = data;
  userStore.lastUpdated = Date.now();

  return data;
}

// Get data for multiple clouds at once
async function getMultiCloudData(clouds, userId) {
  const results = {};
  await Promise.all(
    clouds.map(async (cloud) => {
      try {
        results[cloud] = await getData(cloud, userId);
      } catch (err) {
        results[cloud] = { error: err.message };
      }
    })
  );
  return results;
}

// Force refresh (bypass cache)
function invalidateCache(cloud, userId) {
  if (userId && dataStore[userId]) {
    if (cloud) {
      dataStore[userId][cloud] = null;
    } else {
      dataStore[userId] = { aws: null, azure: null, gcp: null, lastUpdated: null };
    }
  } else if (!userId) {
     // Clear all caches for all users
     dataStore = {};
  }
}

// Get current data source mode
function getDataSourceMode(userId) {
  const store = (userId && dataStore[userId]) ? dataStore[userId] : { aws: null, azure: null, gcp: null, lastUpdated: null };
  
  return {
    useRealData: config.useRealData,
    mode: config.useRealData ? 'real' : 'mock',
    cacheStatus: {
      aws: !!store.aws,
      azure: !!store.azure,
      gcp: !!store.gcp,
      lastUpdated: store.lastUpdated ? new Date(store.lastUpdated).toISOString() : null,
    },
  };
}

module.exports = { getData, getMultiCloudData, invalidateCache, getDataSourceMode };

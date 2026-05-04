/**
 * General-purpose helpers used across controllers and services
 */

// Format a number as USD currency string
function formatCurrency(amount, decimals = 2) {
  return `$${Number(amount).toFixed(decimals)}`;
}

// Calculate percentage change between two values
function percentChange(current, previous) {
  if (!previous || previous === 0) return 0;
  return parseFloat((((current - previous) / previous) * 100).toFixed(2));
}

// Clamp a number between min and max
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Safely parse float, returning 0 on failure
function safeFloat(value, fallback = 0) {
  const n = parseFloat(value);
  return isNaN(n) ? fallback : n;
}

// Truncate a string to max length with ellipsis
function truncate(str, max = 80) {
  if (!str) return '';
  return str.length > max ? str.substring(0, max - 3) + '...' : str;
}

// Deep-merge two objects (right takes priority)
function deepMerge(target, source) {
  const out = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      out[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

// Generate a short human-readable ID
function shortId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Retry an async function up to N times
async function retry(fn, times = 3, delayMs = 500) {
  for (let i = 0; i < times; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === times - 1) throw err;
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
}

// Convert bytes to human-readable (GB, TB, etc.)
function bytesToHuman(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${(bytes / 1024 ** 4).toFixed(1)} TB`;
}

module.exports = {
  formatCurrency, percentChange, clamp, safeFloat,
  truncate, deepMerge, shortId, retry, bytesToHuman,
};

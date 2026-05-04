/**
 * Simple logger utility
 * Adds timestamps and log levels to all console output
 */

const config = require('../../config/config');

const levels = {
  ERROR: { label: 'ERROR', color: '\x1b[31m' },
  WARN:  { label: 'WARN ', color: '\x1b[33m' },
  INFO:  { label: 'INFO ', color: '\x1b[36m' },
  DEBUG: { label: 'DEBUG', color: '\x1b[90m' },
};
const RESET = '\x1b[0m';

function timestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function log(level, module, message, meta) {
  const { label, color } = levels[level];
  const ts = timestamp();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  // Skip DEBUG in production
  if (level === 'DEBUG' && config.server.env === 'production') return;
  console.log(`${color}[${ts}] ${label} [${module}] ${message}${metaStr}${RESET}`);
}

module.exports = {
  error: (mod, msg, meta) => log('ERROR', mod, msg, meta),
  warn:  (mod, msg, meta) => log('WARN',  mod, msg, meta),
  info:  (mod, msg, meta) => log('INFO',  mod, msg, meta),
  debug: (mod, msg, meta) => log('DEBUG', mod, msg, meta),
};

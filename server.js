const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config/config');

// ─── ROUTES ───────────────────────────────────────────────────────────────────
const authRoutes = require('./src/routes/authRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const aiRoutes = require('./src/routes/aiRoutes');

const app = express();

// ─── SECURITY MIDDLEWARE ──────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Disabled so the test UI can load inline scripts
}));

app.use(cors({
  origin: '*', // In production: restrict to your frontend domain
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { success: false, message: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// AI chat has stricter limits
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { success: false, message: 'AI request limit reached, please wait a moment' },
});
app.use('/api/ai/chat', aiLimiter);

// ─── BODY PARSING ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── LOGGING ──────────────────────────────────────────────────────────────────
if (config.server.env !== 'test') {
  app.use(morgan('dev'));
}

// ─── STATIC TEST UI ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── API ROUTES ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const dataSourceService = require('./src/services/dataSourceService');
  const mode = dataSourceService.getDataSourceMode();
  res.json({
    status: 'ok',
    version: '1.0.0',
    environment: config.server.env,
    dataMode: mode.mode,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    geminiConfigured: !!(config.gemini.apiKey && config.gemini.apiKey !== 'your_gemini_api_key_here'),
  });
});

// ─── API 404 ──────────────────────────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `API route not found: ${req.originalUrl}` });
});

// ─── SERVE FRONTEND SPA (catch-all) ───────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: config.server.env === 'production' ? 'Internal server error' : err.message,
  });
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║      ☁️  Cloud Cost Optimizer — Backend Started       ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\n  🚀 Server:      http://localhost:${PORT}`);
  console.log(`  🖥️  Test UI:     http://localhost:${PORT}`);
  console.log(`  ❤️  Health:      http://localhost:${PORT}/api/health`);
  console.log(`  📊 Data Mode:   ${config.useRealData ? '🟢 REAL DATA (Live Cloud APIs)' : '🟡 MOCK DATA (from /data/mock/*.json)'}`);
  console.log(`  🤖 Gemini AI:   ${config.gemini.apiKey && config.gemini.apiKey !== 'your_gemini_api_key_here' ? '🟢 Connected' : '🔴 Not configured (placeholder responses)'}`);
  console.log(`  🌍 Environment: ${config.server.env}\n`);
  console.log('  📋 Quick test credentials:');
  console.log('     username: admin | password: admin123');
  console.log('     username: demo  | password: demo123\n');
});

module.exports = app;

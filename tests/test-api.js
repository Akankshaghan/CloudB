/**
 * API Test Script — runs without a browser
 * Usage: node tests/test-api.js
 */

const http = require('http');

const BASE = 'http://localhost:3000';
let token = null;
let passed = 0;
let failed = 0;

// ─── HTTP HELPER ──────────────────────────────────────────────────────────────
function request(method, path, body = null, auth = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (auth && token) opts.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (_) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── TEST RUNNER ──────────────────────────────────────────────────────────────
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

// ─── TEST SUITES ──────────────────────────────────────────────────────────────
async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║         ☁️  Cloud Cost Optimizer — API Tests          ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // ── Health ──────────────────────────────────────────────
  console.log('📋 Health Check');
  await test('GET /api/health returns 200', async () => {
    const r = await request('GET', '/api/health');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.status === 'ok', 'Expected status: ok');
    assert(r.body.dataMode, 'Missing dataMode field');
    console.log(`     → dataMode: ${r.body.dataMode} | gemini: ${r.body.geminiConfigured}`);
  });

  // ── Auth ─────────────────────────────────────────────────
  console.log('\n📋 Authentication');

  await test('POST /api/auth/login — missing fields returns 400', async () => {
    const r = await request('POST', '/api/auth/login', { username: 'admin' });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('POST /api/auth/login — wrong password returns 401', async () => {
    const r = await request('POST', '/api/auth/login', { username: 'admin', password: 'wrong', selectedClouds: ['aws'] });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('POST /api/auth/login — no cloud selected returns 400', async () => {
    const r = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123', selectedClouds: [] });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('POST /api/auth/login — admin login succeeds', async () => {
    const r = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123', selectedClouds: ['aws', 'gcp'] });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.token, 'Missing token in response');
    assert(r.body.user.connectedClouds.length >= 1, 'No connected clouds in response');
    token = r.body.token;
    console.log(`     → Token acquired | clouds: ${r.body.user.connectedClouds.join(', ')}`);
  });

  await test('GET /api/auth/profile — returns user info', async () => {
    const r = await request('GET', '/api/auth/profile', null, true);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.user.username === 'admin', 'Wrong username');
  });

  await test('GET /api/auth/profile — without token returns 401', async () => {
    const r = await request('GET', '/api/auth/profile');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('POST /api/auth/cloud-account — add azure', async () => {
    const r = await request('POST', '/api/auth/cloud-account', { cloud: 'azure', credentials: {} }, true);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.connectedClouds.includes('azure'), 'Azure not in connected clouds');
  });

  // ── Dashboard ────────────────────────────────────────────
  console.log('\n📋 Dashboard API');

  await test('GET /api/dashboard/status — data source mode', async () => {
    const r = await request('GET', '/api/dashboard/status', null, true);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(['mock', 'real'].includes(r.body.mode), 'Invalid mode value');
    console.log(`     → Mode: ${r.body.mode}`);
  });

  for (const cloud of ['aws', 'azure', 'gcp']) {
    await test(`GET /api/dashboard/${cloud} — returns summary`, async () => {
      const r = await request('GET', `/api/dashboard/${cloud}`, null, true);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.body.summary, 'Missing summary');
      assert(r.body.services_overview, 'Missing services_overview');
      assert(r.body.services_overview.length > 0, 'No services in overview');
      console.log(`     → ${cloud.toUpperCase()}: $${r.body.summary.total_monthly_cost}/mo | ${r.body.services_overview.length} services`);
    });

    await test(`GET /api/dashboard/${cloud}/alerts`, async () => {
      const r = await request('GET', `/api/dashboard/${cloud}/alerts`, null, true);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(Array.isArray(r.body.alerts), 'Alerts is not an array');
      console.log(`     → ${cloud.toUpperCase()}: ${r.body.alerts.length} alert(s)`);
    });
  }

  // ── Service Detail ───────────────────────────────────────
  console.log('\n📋 Service & Instance Detail');

  await test('GET /api/dashboard/aws/services — all AWS services', async () => {
    const r = await request('GET', '/api/dashboard/aws/services', null, true);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.services, 'Missing services object');
    console.log(`     → AWS services: ${Object.keys(r.body.services).join(', ')}`);
  });

  await test('GET /api/dashboard/aws/service/ec2', async () => {
    const r = await request('GET', '/api/dashboard/aws/service/ec2', null, true);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data.instances, 'Missing instances in EC2 service');
    console.log(`     → EC2 instances: ${r.body.data.instances.length}`);
  });

  await test('GET /api/dashboard/aws/service/ec2/instance/:id', async () => {
    const instanceId = encodeURIComponent('i-0ab12cd34ef56gh78');
    const r = await request('GET', `/api/dashboard/aws/service/ec2/instance/${instanceId}`, null, true);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.instance, 'Missing instance data');
    console.log(`     → Found: ${r.body.instance.name} (${r.body.instance.type}) — $${r.body.instance.monthly_cost}/mo`);
  });

  await test('GET /api/dashboard/gcp/service/bigquery', async () => {
    const r = await request('GET', '/api/dashboard/gcp/service/bigquery', null, true);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.data.datasets, 'Missing BigQuery datasets');
  });

  await test('GET non-existent service returns 404', async () => {
    const r = await request('GET', '/api/dashboard/aws/service/nonexistent', null, true);
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  // ── Multi-Cloud ──────────────────────────────────────────
  console.log('\n📋 Multi-Cloud');

  await test('GET /api/dashboard/multi-cloud?clouds=aws,gcp', async () => {
    const r = await request('GET', '/api/dashboard/multi-cloud?clouds=aws,gcp', null, true);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.summary.aws, 'Missing AWS in multi-cloud summary');
    assert(r.body.summary.gcp, 'Missing GCP in multi-cloud summary');
    console.log(`     → AWS: $${r.body.summary.aws.total_monthly_cost} | GCP: $${r.body.summary.gcp.total_monthly_cost}`);
  });

  // ── AI Endpoints ─────────────────────────────────────────
  console.log('\n📋 AI Agent');

  await test('GET /api/ai/overview/aws — returns analysis text', async () => {
    const r = await request('GET', '/api/ai/overview/aws', null, true);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(typeof r.body.analysis === 'string', 'Analysis must be a string');
    assert(r.body.analysis.length > 50, 'Analysis too short');
    console.log(`     → Analysis: ${r.body.analysis.substring(0, 80)}...`);
  });

  await test('POST /api/ai/chat — returns AI response', async () => {
    const r = await request('POST', '/api/ai/chat', { message: 'Which cloud service is costing the most?', cloud: 'aws' }, true);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(typeof r.body.message === 'string', 'Response message must be a string');
    console.log(`     → AI response: ${r.body.message.substring(0, 80)}...`);
  });

  await test('POST /api/ai/chat — empty message returns 400', async () => {
    const r = await request('POST', '/api/ai/chat', { message: '' }, true);
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('POST /api/ai/chat/clear — clears history', async () => {
    const r = await request('POST', '/api/ai/chat/clear', { cloud: 'aws', context: 'dashboard' }, true);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('GET /api/ai/migration/aws?targetCloud=gcp', async () => {
    const r = await request('GET', '/api/ai/migration/aws?targetCloud=gcp', null, true);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(typeof r.body.advice === 'string', 'Advice must be a string');
    console.log(`     → Migration advice: ${r.body.advice.substring(0, 80)}...`);
  });

  await test('GET /api/ai/instance/aws/ec2/:id', async () => {
    const id = encodeURIComponent('i-0ab12cd34ef56gh78');
    const r = await request('GET', `/api/ai/instance/aws/ec2/${id}`, null, true);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(typeof r.body.analysis === 'string', 'Analysis must be string');
  });

  // ── Rate Limiting ─────────────────────────────────────────
  console.log('\n📋 Security');

  await test('Unauthenticated dashboard request returns 401', async () => {
    const r = await request('GET', '/api/dashboard/aws');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('Invalid API route returns 404', async () => {
    const r = await request('GET', '/api/nonexistent', null, true);
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  // ── Summary ───────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  const total = passed + failed;
  const icon = failed === 0 ? '🎉' : '⚠️ ';
  console.log(`║  ${icon} Tests: ${passed}/${total} passed | ${failed} failed${''.padEnd(20 - String(total).length - String(failed).length)}║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('\n❌ Test runner crashed:', err.message);
  console.error('   Make sure the server is running: npm run dev\n');
  process.exit(1);
});

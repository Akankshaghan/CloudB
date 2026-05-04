/* ═══════════════════════════════════════════════════════════════
   endpoint-simulator.js — API Health Monitor & Live Data Sim
   (No AI endpoints)
   ═══════════════════════════════════════════════════════════════ */

const EndpointSimulator = (() => {

  // ── Endpoints (NO AI) ──────────────────────────────────────────
  function buildEndpoints() {
    const cloud  = window.AppState?.activeCloud || 'aws';
    const clouds = window.AppState?.connectedClouds?.length
      ? window.AppState.connectedClouds : [cloud];

    const svcs   = window.AppState?.dashboardCache?.[cloud]?.services_overview || [];
    const svcKey = svcs[0]?.key || (cloud === 'aws' ? 'ec2' : cloud === 'azure' ? 'virtual_machines' : 'compute_engine');

    return [
      { id: 'health',        group: 'System',    method: 'GET', path: '/api/health',                                            auth: false, label: 'Health Check' },
      { id: 'profile',       group: 'Auth',       method: 'GET', path: '/api/auth/profile',                                      auth: true,  label: 'Get Profile' },
      { id: 'dash_status',   group: 'Dashboard',  method: 'GET', path: '/api/dashboard/status',                                  auth: true,  label: 'Data Source Status' },
      { id: 'dash_main',     group: 'Dashboard',  method: 'GET', path: `/api/dashboard/${cloud}`,                                auth: true,  label: `Full Dashboard (${cloud.toUpperCase()})` },
      { id: 'dash_services', group: 'Dashboard',  method: 'GET', path: `/api/dashboard/${cloud}/services`,                       auth: true,  label: `Services List (${cloud.toUpperCase()})` },
      { id: 'dash_alerts',   group: 'Dashboard',  method: 'GET', path: `/api/dashboard/${cloud}/alerts`,                         auth: true,  label: `Alerts (${cloud.toUpperCase()})` },
      { id: 'dash_svc',      group: 'Dashboard',  method: 'GET', path: `/api/dashboard/${cloud}/service/${svcKey}`,              auth: true,  label: `Service Detail (${svcKey})` },
      { id: 'multi_cloud',   group: 'Dashboard',  method: 'GET', path: `/api/dashboard/multi-cloud?clouds=${clouds.join(',')}`,  auth: true,  label: 'Multi-Cloud Summary' },
    ];
  }

  // ── State ──────────────────────────────────────────────────────
  let results     = {};
  let runningAll  = false;
  let simRunning  = false;
  let simInterval = null;
  let simTick     = 0;

  // ── Fetch one endpoint ─────────────────────────────────────────
  async function pingEndpoint(ep) {
    const token = window.AppState?.token;
    const start = performance.now();
    const opts  = { method: ep.method, headers: { 'Content-Type': 'application/json' } };
    if (ep.auth && token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (ep.body) opts.body = JSON.stringify(ep.body);

    const cell = document.getElementById(`sim-row-${ep.id}`);
    if (cell) cell.innerHTML = `<span class="sim-pulse">●</span> <span style="font-size:11px;color:var(--text-muted);">Testing…</span>`;

    try {
      const resp    = await fetch(ep.path, opts);
      const latency = Math.round(performance.now() - start);
      let data;
      try { data = await resp.json(); } catch (_) { data = null; }

      results[ep.id] = { status: resp.status, ok: resp.ok, latency, data, ts: Date.now(), error: null };
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      results[ep.id] = { status: 0, ok: false, latency, data: null, ts: Date.now(), error: err.message };
    }
    renderRow(ep.id);
  }

  // ── Run all endpoints ──────────────────────────────────────────
  async function runAll() {
    if (runningAll) return;
    runningAll = true;
    const btn = document.getElementById('sim-run-all-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="sim-spin">↻</span> Testing…'; }

    const eps = buildEndpoints();
    for (let i = 0; i < eps.length; i += 3) {
      await Promise.all(eps.slice(i, i + 3).map(pingEndpoint));
      await new Promise(r => setTimeout(r, 100));
    }

    runningAll = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '▶ Run All Tests'; }
    updateSummaryBar();
  }

  // ── Toggle live simulation ─────────────────────────────────────
  function toggleSimulation() {
    simRunning = !simRunning;
    const btn = document.getElementById('sim-live-btn');
    if (simRunning) {
      if (btn) { btn.innerHTML = '⏹ Stop Simulation'; btn.style.background = 'linear-gradient(135deg,#dc2626,#b91c1c)'; }
      simInterval = setInterval(tickSimulation, 4000);
      tickSimulation();
    } else {
      clearInterval(simInterval);
      if (btn) { btn.innerHTML = '⚡ Start Live Sim'; btn.style.background = 'linear-gradient(135deg,#7c3aed,#6d28d9)'; }
      const ticker = document.getElementById('sim-ticker');
      if (ticker) ticker.textContent = '';
    }
  }

  async function tickSimulation() {
    simTick++;
    const ticker = document.getElementById('sim-ticker');
    if (ticker) ticker.textContent = `Tick #${simTick}  ·  ${new Date().toLocaleTimeString()}`;

    // Fluctuate data + update DOM values in-place
    fluctuateMockData();

    // Ping one random non-dashboard endpoint for status monitoring
    const eps    = buildEndpoints();
    const randEp = eps.filter(e => e.id !== 'dash_main').sort(() => Math.random() - 0.5)[0];
    if (randEp) await pingEndpoint(randEp);
    updateSummaryBar();
  }

  // ── In-place DOM value updater with flash highlight ───────────
  function updateValueInPlace(el, newText, direction) {
    if (!el || el.textContent === newText) return;
    el.textContent = newText;
    const color = direction === 'up' ? '#16a34a' : direction === 'down' ? '#dc2626' : '#3b82f6';
    el.style.transition = 'none';
    el.style.background = color;
    el.style.color = '#fff';
    el.style.borderRadius = '4px';
    el.style.padding = '1px 4px';
    setTimeout(() => {
      el.style.transition = 'background 0.8s, color 0.8s, padding 0.4s';
      el.style.background = '';
      el.style.color = '';
      el.style.padding = '';
    }, 600);
  }

  // ── Fluctuate cached data + update specific DOM values ─────────
  function fluctuateMockData() {
    const cloud = window.AppState?.activeCloud || 'aws';
    const cache = window.AppState?.dashboardCache?.[cloud];
    if (!cache || !cache.summary) return;

    // 1. Mutate summary with large visible swings (±10%)
    const priceDelta = (Math.random() - 0.5) * 0.20;
    cache.summary.total_monthly_cost     = +(cache.summary.total_monthly_cost * (1 + priceDelta)).toFixed(2);
    cache.summary.projected_monthly_cost = +(cache.summary.total_monthly_cost * (1.03 + Math.random() * 0.08)).toFixed(2);
    cache.summary.cost_change_percent    = +((Math.random() - 0.45) * 20).toFixed(1);
    if (Math.random() > 0.6) {
      cache.summary.cost_alerts = Math.max(0, (cache.summary.cost_alerts || 0) + (Math.random() > 0.5 ? 1 : -1));
    }

    // 2. Mutate services (±11%)
    if (cache.services_overview?.length) {
      cache.services_overview.forEach(svc => {
        const d = (Math.random() - 0.5) * 0.22;
        svc.monthly_cost  = Math.max(1, +(svc.monthly_cost * (1 + d)).toFixed(2));
        svc.trend_percent = +((Math.random() - 0.45) * 18).toFixed(1);
        svc.trend         = svc.trend_percent > 0 ? 'up' : 'down';
        if (svc.cost_history) {
          svc.cost_history.push(svc.monthly_cost);
          svc.cost_history = svc.cost_history.slice(-12);
        }
      });
      const total = cache.services_overview.reduce((a, s) => a + s.monthly_cost, 0);
      cache.services_overview.forEach(s => {
        s.cost_percentage = total > 0 ? +((s.monthly_cost / total) * 100).toFixed(1) : 0;
      });
      cache.top_cost_services = [...cache.services_overview]
        .sort((a, b) => b.monthly_cost - a.monthly_cost).slice(0, 5)
        .map(s => ({ service: s.service_name, cost: s.monthly_cost, trend: s.trend, trend_percent: s.trend_percent }));
    }

    // 3. Mutate tags (±9%)
    if (cache.cost_breakdown_by_tag) {
      Object.keys(cache.cost_breakdown_by_tag).forEach(k => {
        cache.cost_breakdown_by_tag[k] = +(cache.cost_breakdown_by_tag[k] * (1 + (Math.random() - 0.5) * 0.18)).toFixed(2);
      });
    }

    // 4. Update KPI card VALUES in-place (no full DOM re-render)
    const s   = cache.summary;
    const pct = s.cost_change_percent || 0;
    [
      { sel: '.kpi-card.blue .kpi-value',   val: '$' + s.total_monthly_cost.toLocaleString(undefined, { minimumFractionDigits: 2 }),    dir: pct > 0 ? 'up' : 'down' },
      { sel: '.kpi-card.green .kpi-value',  val: String(s.active_services || 0),                                                        dir: 'neutral' },
      { sel: '.kpi-card.orange .kpi-value', val: String(s.total_resources || 0),                                                        dir: 'neutral' },
      { sel: '.kpi-card.red .kpi-value',    val: String(s.cost_alerts || 0),                                                            dir: (s.cost_alerts || 0) > 0 ? 'up' : 'down' },
      { sel: '.kpi-card.purple .kpi-value', val: '$' + s.projected_monthly_cost.toLocaleString(undefined, { minimumFractionDigits: 2 }), dir: 'neutral' },
    ].forEach(k => updateValueInPlace(document.querySelector(k.sel), k.val, k.dir));

    // KPI sub-text
    const blueChange = document.querySelector('.kpi-card.blue .kpi-change');
    if (blueChange) {
      const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : '→';
      updateValueInPlace(blueChange, `${arrow} ${Math.abs(pct).toFixed(1)}% vs last month`, pct > 0 ? 'up' : 'down');
    }

    // 5. Update service card values in-place
    if (cache.services_overview?.length) {
      cache.services_overview.forEach(svc => {
        const card = document.getElementById(`svc-card-${svc.key}`);
        if (!card) return;
        updateValueInPlace(card.querySelector('.service-cost'), `$${svc.monthly_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, svc.trend);
        updateValueInPlace(card.querySelector('.service-cost-pct'), `${svc.cost_percentage.toFixed(1)}% of total spend`, 'neutral');
        const trendEl = card.querySelector('.service-trend');
        if (trendEl) {
          const arrow = svc.trend === 'up' ? '↑' : svc.trend === 'down' ? '↓' : '→';
          updateValueInPlace(trendEl, `${arrow} ${Math.abs(svc.trend_percent).toFixed(1)}% this period`, svc.trend);
        }
        // Re-draw mini chart with new data point
        if (window.ChartUtils) {
          const idx   = cache.services_overview.indexOf(svc);
          const color = window.ChartUtils.CHART_COLORS?.[idx % (window.ChartUtils.CHART_COLORS?.length || 8)];
          window.ChartUtils.renderMiniChart(`mini-chart-${svc.key}`, svc.cost_history, svc.months, window.AppState?.period || 'month', color);
        }
      });
    }

    // 6. Re-draw canvas charts (donut + tag bar — canvas has no flicker)
    if (cache.services_overview?.length && window.ChartUtils) {
      const labels = cache.services_overview.map(s => s.service_name);
      const vals   = cache.services_overview.map(s => s.monthly_cost);
      window.ChartUtils.renderDonutChart('home-donut-chart', labels, vals);
      if (typeof window.renderDonutLegend === 'function') window.renderDonutLegend(labels, vals);
    }
    if (cache.cost_breakdown_by_tag && window.ChartUtils) {
      window.ChartUtils.renderTagBarChart('home-tag-chart',
        Object.keys(cache.cost_breakdown_by_tag),
        Object.values(cache.cost_breakdown_by_tag));
    }

    flashLiveBadge();
    showFluctuateBanner();
    refreshSimulatorPanel();
  }

  // ── Update Live Data Snapshot panel inside the simulator ───────
  function refreshSimulatorPanel() {
    const cloud = window.AppState?.activeCloud || 'aws';
    const cache = window.AppState?.dashboardCache?.[cloud];
    if (!cache) return;

    const s = cache.summary || {};

    // KPI boxes
    const kpiMap = {
      total_cost: '$' + (s.total_monthly_cost||0).toLocaleString(undefined, {minimumFractionDigits:2}),
      projected:  '$' + (s.projected_monthly_cost||0).toLocaleString(undefined, {minimumFractionDigits:2}),
      services:   String(s.active_services || 0),
      resources:  String(s.total_resources || 0),
      alerts:     String(s.cost_alerts || 0),
    };
    const kpiColors = {
      total_cost: '#3b82f6', projected: '#7c3aed',
      services: '#16a34a', resources: '#d97706',
      alerts: (s.cost_alerts||0) > 0 ? '#dc2626' : '#6b7280',
    };
    Object.entries(kpiMap).forEach(([k, val]) => {
      const el = document.getElementById(`sim-kv-${k}`);
      if (!el) return;
      if (el.textContent !== val) {
        el.textContent = val;
        el.style.color = kpiColors[k] || 'var(--text)';
        el.style.transition = 'none';
        el.style.transform = 'scale(1.12)';
        setTimeout(() => { el.style.transition = 'transform 0.3s'; el.style.transform = ''; }, 80);
      }
    });

    // Services rows
    const svcRows = document.getElementById('sim-services-rows');
    if (!svcRows || !cache.services_overview?.length) return;

    const pct = s.cost_change_percent || 0;
    svcRows.innerHTML = cache.services_overview.slice(0, 8).map((svc, i) => {
      const trendColor = svc.trend === 'up' ? '#dc2626' : svc.trend === 'down' ? '#16a34a' : '#6b7280';
      const trendArrow = svc.trend === 'up' ? '▲' : svc.trend === 'down' ? '▼' : '→';
      return `
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;padding:9px 14px;
          border-top:1px solid var(--border);align-items:center;
          background:${i%2===0?'var(--surface,white)':'var(--surface-2,#f9fafb)'};">
          <span style="font-size:12.5px;font-weight:600;color:var(--text);">${svc.service_name}</span>
          <span style="font-size:12.5px;font-weight:700;color:#3b82f6;">$${svc.monthly_cost.toLocaleString(undefined,{minimumFractionDigits:2})}</span>
          <span style="font-size:12px;color:var(--text-muted);">${svc.cost_percentage.toFixed(1)}%</span>
          <span style="font-size:12px;font-weight:700;color:${trendColor};">${trendArrow} ${Math.abs(svc.trend_percent||0).toFixed(1)}%</span>
        </div>
      `;
    }).join('');
  }

  // ── Flash indicators ──────────────────────────────────────────
  function flashLiveBadge() {
    const badge = document.getElementById('sim-live-badge');
    if (!badge) return;
    badge.style.opacity = '1';
    badge.style.transform = 'scale(1.05)';
    clearTimeout(badge._t);
    badge._t = setTimeout(() => { badge.style.opacity = '0.4'; badge.style.transform = 'scale(1)'; }, 800);
  }

  function showFluctuateBanner() {
    const banner = document.getElementById('sim-data-banner');
    if (!banner) return;
    banner.style.opacity = '1';
    clearTimeout(banner._t);
    banner._t = setTimeout(() => { banner.style.opacity = '0'; }, 2000);
  }

  // ── Render one result row ──────────────────────────────────────
  function renderRow(id) {
    const cell = document.getElementById(`sim-row-${id}`);
    if (!cell) return;
    const r = results[id];
    if (!r) return;

    const statusColor = r.ok ? '#16a34a' : r.status === 0 ? '#6b7280' : '#dc2626';
    const latColor    = r.latency < 300 ? '#16a34a' : r.latency < 800 ? '#d97706' : '#dc2626';
    const latLabel    = r.latency < 300 ? 'Fast' : r.latency < 800 ? 'Slow' : 'Very Slow';
    const statusLabel = r.status === 0 ? 'ERR' : String(r.status);

    cell.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span class="sim-badge" style="background:${statusColor};">${statusLabel}</span>
        <span style="font-size:11px;font-weight:700;color:${latColor};">${r.latency}ms</span>
        <span style="font-size:10px;color:${latColor};opacity:0.7;">(${latLabel})</span>
        <button class="sim-retest-btn" onclick="EndpointSimulator.retestOne('${id}')">↺ Retest</button>
      </div>
      <div style="margin-top:4px;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
        ${previewData(r.data, r.error)}
      </div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${new Date(r.ts).toLocaleTimeString()}</div>
    `;
  }

  function previewData(data, error) {
    if (error) return `<span style="color:#dc2626;font-size:10.5px;">⚠ ${escapeHtml(error.slice(0, 80))}</span>`;
    if (!data)  return `<span style="color:#6b7280;font-size:11px;">—</span>`;
    const str     = JSON.stringify(data);
    const preview = str.length > 100 ? str.slice(0, 100) + '…' : str;
    return `<span style="color:#6b7280;font-size:10px;font-family:monospace;">${escapeHtml(preview)}</span>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Retest one ────────────────────────────────────────────────
  async function retestOne(id) {
    const ep = buildEndpoints().find(e => e.id === id);
    if (!ep) return;
    await pingEndpoint(ep);
    updateSummaryBar();
  }

  // ── Summary bar ───────────────────────────────────────────────
  function updateSummaryBar() {
    const all    = Object.values(results);
    const ok     = all.filter(r => r.ok).length;
    const fail   = all.filter(r => !r.ok && r.status !== 0).length;
    const err    = all.filter(r => r.status === 0).length;
    const avgLat = all.length ? Math.round(all.reduce((a, r) => a + r.latency, 0) / all.length) : 0;

    const el = document.getElementById('sim-summary');
    if (el) el.innerHTML = `
      <span style="color:#16a34a;font-weight:700;">✔ ${ok} ok</span>
      <span style="color:#dc2626;font-weight:700;">✖ ${fail} failed</span>
      <span style="color:#6b7280;">⚡ ${err} unreachable</span>
      <span style="color:#3b82f6;">⏱ avg ${avgLat}ms</span>
    `;
  }

  // ── Render the full panel HTML ─────────────────────────────────
  function renderPanel() {
    const eps         = buildEndpoints();
    const groups      = [...new Set(eps.map(e => e.group))];
    const groupColors = { System: '#3b82f6', Auth: '#7c3aed', Dashboard: '#0891b2' };

    return `
      <div id="sim-panel" style="font-family:'Inter',system-ui,sans-serif;">

        <!-- Toolbar -->
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
          <button id="sim-run-all-btn" onclick="EndpointSimulator.runAll()" style="
            padding:9px 20px;border-radius:8px;border:none;cursor:pointer;font-weight:600;font-size:13px;
            background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;
            box-shadow:0 2px 10px rgba(59,130,246,0.35);">
            ▶ Run All Tests
          </button>
          <button id="sim-live-btn" onclick="EndpointSimulator.toggleSimulation()" style="
            padding:9px 20px;border-radius:8px;border:none;cursor:pointer;font-weight:600;font-size:13px;
            background:linear-gradient(135deg,#7c3aed,#6d28d9);color:white;
            box-shadow:0 2px 10px rgba(124,58,237,0.3);">
            ⚡ Start Live Sim
          </button>
          <div id="sim-live-badge" style="
            display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;
            background:rgba(22,163,74,0.1);border:1px solid rgba(22,163,74,0.3);
            font-size:11px;font-weight:700;color:#16a34a;opacity:0.4;
            transition:opacity 0.3s,transform 0.3s;">
            <span style="width:7px;height:7px;border-radius:50%;background:#16a34a;display:inline-block;"></span>
            Charts Updated
          </div>
          <div id="sim-summary" style="display:flex;gap:16px;font-size:12.5px;margin-left:8px;"></div>
          <span id="sim-ticker" style="font-size:11px;color:var(--text-muted);margin-left:auto;font-family:monospace;"></span>
        </div>

        <!-- Data updated banner -->
        <div id="sim-data-banner" style="
          background:linear-gradient(135deg,rgba(59,130,246,0.08),rgba(124,58,237,0.08));
          border:1px solid rgba(59,130,246,0.2);border-radius:8px;
          padding:9px 16px;margin-bottom:14px;font-size:12px;font-weight:600;
          color:#3b82f6;opacity:0;transition:opacity 0.5s;pointer-events:none;
          display:flex;align-items:center;gap:8px;">
          📊 Live data fluctuated — KPI cards and charts updated in real-time
        </div>

        <!-- Info note -->
        <div style="padding:10px 14px;background:rgba(217,119,6,0.08);border:1px solid rgba(217,119,6,0.2);
          border-radius:8px;font-size:12px;color:#d97706;margin-bottom:18px;">
          <strong>ℹ Live Sim:</strong> Every 4s, service costs fluctuate ±10%,
          KPI values flash-update in place, mini charts append new data points,
          and donut/tag charts redraw — all without refreshing the page.
        </div>

        <!-- ── LIVE DATA METRICS PANEL ─────────────────────────── -->
        <div style="margin-bottom:24px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <div style="width:4px;height:20px;background:#16a34a;border-radius:3px;"></div>
            <span style="font-size:13px;font-weight:700;color:var(--text);">Live Data Snapshot</span>
            <span style="font-size:11px;color:var(--text-muted);">Updates on every simulation tick</span>
          </div>

          <!-- KPI row -->
          <div id="sim-kpi-row" style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px;">
            ${['total_cost','projected','services','resources','alerts'].map(k => `
              <div style="padding:14px;background:var(--surface-2,#f9fafb);border:1px solid var(--border);border-radius:10px;text-align:center;" id="sim-kpi-${k}">
                <div style="font-size:10px;color:var(--text-muted);font-weight:600;margin-bottom:4px;">${
                  {total_cost:'Total Monthly',projected:'Projected',services:'Services',resources:'Resources',alerts:'Alerts'}[k]
                }</div>
                <div style="font-size:16px;font-weight:800;color:var(--text);" id="sim-kv-${k}">—</div>
              </div>
            `).join('')}
          </div>

          <!-- Services mini table -->
          <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;">
            <div style="background:var(--surface-2,#f3f4f6);padding:9px 14px;font-size:11px;font-weight:700;color:var(--text-muted);
              display:grid;grid-template-columns:2fr 1fr 1fr 1fr;">
              <span>Service</span><span>Cost/mo</span><span>% Total</span><span>Trend</span>
            </div>
            <div id="sim-services-rows">
              <div style="padding:16px;text-align:center;font-size:12px;color:var(--text-muted);">
                Start simulation or run tests to see live data
              </div>
            </div>
          </div>
        </div>

        <!-- Endpoint tables grouped -->
        ${groups.map(group => {
          const groupEps = eps.filter(e => e.group === group);
          const gc = groupColors[group] || '#3b82f6';
          return `
            <div style="margin-bottom:24px;">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                <div style="width:4px;height:20px;background:${gc};border-radius:3px;flex-shrink:0;"></div>
                <span style="font-size:13px;font-weight:700;color:var(--text);">${group}</span>
                <span style="font-size:11px;color:var(--text-muted);">${groupEps.length} endpoint${groupEps.length !== 1 ? 's' : ''}</span>
              </div>
              <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;">
                  <thead>
                    <tr style="background:var(--surface-2,#f3f4f6);">
                      <th style="padding:9px 14px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:left;width:60px;">Method</th>
                      <th style="padding:9px 14px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:left;">Endpoint</th>
                      <th style="padding:9px 14px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:left;width:35%;">Status / Response</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${groupEps.map((ep, i) => `
                      <tr style="border-top:1px solid var(--border);${i % 2 !== 0 ? 'background:var(--surface-2,#f9fafb)' : ''};">
                        <td style="padding:11px 14px;">
                          <span style="font-size:10px;font-weight:700;padding:3px 7px;border-radius:4px;
                            background:${ep.method === 'GET' ? 'rgba(22,163,74,0.1)' : 'rgba(217,119,6,0.1)'};
                            color:${ep.method === 'GET' ? '#16a34a' : '#d97706'};">${ep.method}</span>
                        </td>
                        <td style="padding:11px 14px;">
                          <div style="font-weight:600;font-size:13px;color:var(--text);">${ep.label}</div>
                          <div style="font-size:10.5px;color:var(--text-muted);font-family:monospace;margin-top:2px;">${ep.path}</div>
                          <div style="margin-top:3px;">${ep.auth
                            ? '<span style="font-size:9.5px;color:#7c3aed;font-weight:700;">🔒 AUTH REQUIRED</span>'
                            : '<span style="font-size:9.5px;color:#16a34a;font-weight:700;">PUBLIC</span>'}</div>
                        </td>
                        <td style="padding:11px 14px;" id="sim-row-${ep.id}">
                          <span style="font-size:11px;color:var(--text-muted);">Awaiting test…</span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <style>
        .sim-badge { padding:3px 8px;border-radius:4px;color:white;font-size:11px;font-weight:700;flex-shrink:0; }
        .sim-retest-btn {
          padding:3px 10px;border-radius:5px;border:1px solid var(--border);
          background:transparent;cursor:pointer;font-size:11px;color:var(--text-muted);
          transition:background 0.15s,color 0.15s;
        }
        .sim-retest-btn:hover { background:var(--primary,#3b82f6);color:white;border-color:var(--primary,#3b82f6); }
        .sim-pulse { color:#3b82f6;animation:sim-blink 0.8s infinite; }
        .sim-spin  { display:inline-block;animation:sim-spin-anim 0.7s linear infinite; }
        @keyframes sim-blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes sim-spin-anim { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      </style>
    `;
  }

  return { runAll, retestOne, toggleSimulation, renderPanel };
})();

window.EndpointSimulator = EndpointSimulator;

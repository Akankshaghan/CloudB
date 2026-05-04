/* ═══════════════════════════════════════════════════════════════════
   app.js — Core application logic, state, routing, and API calls
   ═══════════════════════════════════════════════════════════════════ */

// ── CONSTANTS ─────────────────────────────────────────────────────
const API_BASE = '/api';

// ── APPLICATION STATE ─────────────────────────────────────────────
window.AppState = {
  token: localStorage.getItem('cco_token') || null,
  user: JSON.parse(localStorage.getItem('cco_user') || 'null'),
  connectedClouds: JSON.parse(localStorage.getItem('cco_clouds') || '[]'),
  activeCloud: localStorage.getItem('cco_active_cloud') || null,
  period: 'month',
  currentPage: 'home',
  dashboardCache: {},         // cloud -> data
  migrationCloud: null,
  regSelectedClouds: [],
};

// ── API HELPER ────────────────────────────────────────────────────
async function apiCall(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (AppState.token) opts.headers['Authorization'] = `Bearer ${AppState.token}`;
  if (body) opts.body = JSON.stringify(body);

  try {
    const resp = await fetch(`${API_BASE}${path}`, opts);
    const data = await resp.json();
    return { ok: resp.ok, status: resp.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { message: err.message } };
  }
}

// ── TOAST NOTIFICATIONS ───────────────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>`,
    error: `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    warning: `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`,
    info: `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  toast.innerHTML = `${icons[type] || ''} ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── AUTH FUNCTIONS ────────────────────────────────────────────────
function showLogin() {
  document.getElementById('login-view').style.display = 'block';
  document.getElementById('register-view').style.display = 'none';
}

function showRegister() {
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('register-view').style.display = 'block';
}

async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  errEl.style.display = 'none';
  if (!username || !password) { showErr2(errEl, 'Username and password are required'); return; }

  btn.disabled = true;
  btn.innerHTML = `<div class="spinner" style="width:16px;height:16px;"></div> Signing in...`;

  const r = await apiCall('POST', '/auth/login', { username, password });

  if (r.ok && r.data.token) {
    AppState.token = r.data.token;
    AppState.user = r.data.user;
    AppState.connectedClouds = r.data.user.connectedClouds || [];
    AppState.activeCloud = AppState.connectedClouds[0] || null;

    localStorage.setItem('cco_token', AppState.token);
    localStorage.setItem('cco_user', JSON.stringify(AppState.user));
    localStorage.setItem('cco_clouds', JSON.stringify(AppState.connectedClouds));
    localStorage.setItem('cco_active_cloud', AppState.activeCloud || '');

    showToast('Welcome back, ' + (AppState.user.name || AppState.user.username) + '!', 'success');
    initApp();
  } else {
    showErr2(errEl, r.data.message || 'Invalid username or password');
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Sign In`;
  }
}

async function doRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('reg-error');

  errEl.style.display = 'none';
  if (!username || !name || !email || !password) { showErr2(errEl, 'All fields are required'); return; }

  const selectedClouds = AppState.regSelectedClouds || [];
  const credentials = {};

  if (selectedClouds.includes('aws')) {
    credentials.aws = {
      accessKeyId: document.getElementById('aws-access-key').value,
      secretAccessKey: document.getElementById('aws-secret-key').value,
    };
  }
  if (selectedClouds.includes('azure')) {
    credentials.azure = {
      subscriptionId: document.getElementById('azure-sub-id').value,
      clientSecret: document.getElementById('azure-client-secret').value,
    };
  }
  if (selectedClouds.includes('gcp')) {
    credentials.gcp = {
      projectId: document.getElementById('gcp-project-id').value,
      apiKey: document.getElementById('gcp-api-key').value,
    };
  }

  const r = await apiCall('POST', '/auth/register', { username, email, password, name, selectedClouds, credentials });

  if (r.ok && r.data.token) {
    AppState.token = r.data.token;
    AppState.user = r.data.user;
    AppState.connectedClouds = r.data.user.connectedClouds || [];
    AppState.activeCloud = AppState.connectedClouds[0] || null;

    localStorage.setItem('cco_token', AppState.token);
    localStorage.setItem('cco_user', JSON.stringify(AppState.user));
    localStorage.setItem('cco_clouds', JSON.stringify(AppState.connectedClouds));
    localStorage.setItem('cco_active_cloud', AppState.activeCloud || '');

    showToast('Account created successfully!', 'success');
    initApp();
  } else {
    showErr2(errEl, r.data.message || 'Registration failed. Please try again.');
  }
}

function toggleRegCloud(cloud) {
  AppState.regSelectedClouds = AppState.regSelectedClouds || [];
  const opt = document.getElementById(`reg-${cloud}-opt`);
  const creds = document.getElementById(`cred-${cloud}-fields`);
  const idx = AppState.regSelectedClouds.indexOf(cloud);

  if (idx >= 0) {
    AppState.regSelectedClouds.splice(idx, 1);
    opt.classList.remove('selected');
    creds.classList.remove('open');
  } else {
    AppState.regSelectedClouds.push(cloud);
    opt.classList.add('selected');
    creds.classList.add('open');
  }
}

function doLogout() {
  AppState.token = null;
  AppState.user = null;
  AppState.connectedClouds = [];
  AppState.activeCloud = null;
  AppState.dashboardCache = {};

  localStorage.removeItem('cco_token');
  localStorage.removeItem('cco_user');
  localStorage.removeItem('cco_clouds');
  localStorage.removeItem('cco_active_cloud');

  // Show auth page
  document.getElementById('app-page').classList.remove('active');
  document.getElementById('auth-page').style.display = 'flex';
  showLogin();
  showToast('Signed out successfully', 'info');
}

function showErr2(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}

// ── ENTER KEY ON LOGIN ────────────────────────────────────────────
document.getElementById('login-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});
document.getElementById('login-username').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});

// ── NAVIGATION ────────────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const page = document.getElementById(`page-${name}`);
  const navBtn = document.getElementById(`nav-${name}`);
  if (page) page.classList.add('active');
  if (navBtn) navBtn.classList.add('active');

  AppState.currentPage = name;

  // Page-specific load
  if (name === 'home')       loadHomePage();
  if (name === 'dashboard')  loadDashboardPage();
  if (name === 'migration')  loadMigrationPage();
  if (name === 'admin')      { loadAdminUsers(); loadAdminConfig(); }
  if (name === 'simulator')  loadSimulatorPage();

  // Close any open menus
  document.getElementById('user-menu').classList.remove('open');
}

// ── CLOUD TABS ────────────────────────────────────────────────────
function buildCloudTabs(clouds) {
  const container = document.getElementById('cloud-tabs');
  if (!container) return;

  if (!clouds || clouds.length === 0) {
    container.innerHTML = '';
    return;
  }

  const cloudLabels = { aws: 'AWS', azure: 'Azure', gcp: 'GCP' };

  container.innerHTML = clouds.map(cloud => `
    <button
      class="cloud-tab-btn ${cloud === AppState.activeCloud ? 'active' : ''}"
      id="cloud-tab-${cloud}"
      onclick="switchCloud('${cloud}')">
      <span class="cloud-badge ${cloud}"></span>
      ${cloudLabels[cloud] || cloud.toUpperCase()}
    </button>
  `).join('');

  const removeBtn = document.getElementById('remove-cloud-btn');
  if (removeBtn) {
    removeBtn.style.display = (clouds && clouds.length > 0) ? 'inline-flex' : 'none';
  }
}

function switchCloud(cloud) {
  AppState.activeCloud = cloud;
  localStorage.setItem('cco_active_cloud', cloud);
  AppState.dashboardCache = {}; // Clear cache to reload with new cloud

  // Update tab UI
  document.querySelectorAll('.cloud-tab-btn').forEach(b => b.classList.remove('active'));
  const tab = document.getElementById(`cloud-tab-${cloud}`);
  if (tab) tab.classList.add('active');

  // Reload current page data
  if (AppState.currentPage === 'home') loadHomePage();
  else if (AppState.currentPage === 'dashboard') loadDashboardPage();
}

function updateConnectedClouds(clouds) {
  AppState.connectedClouds = clouds;
  localStorage.setItem('cco_clouds', JSON.stringify(clouds));
  if (!AppState.activeCloud && clouds.length > 0) {
    AppState.activeCloud = clouds[0];
    localStorage.setItem('cco_active_cloud', clouds[0]);
  }
  buildCloudTabs(clouds);
}

// ── REMOVE CLOUD ──────────────────────────────────────────────────
function removeActiveCloud() {
  const cloud = AppState.activeCloud;
  if (!cloud) return;
  
  const msgEl = document.getElementById('remove-cloud-msg');
  if (msgEl) msgEl.innerText = `Are you sure you want to disconnect your ${cloud.toUpperCase()} account? This action cannot be undone.`;
  
  document.getElementById('remove-cloud-modal').classList.add('open');
}

function closeRemoveCloudModal() {
  document.getElementById('remove-cloud-modal').classList.remove('open');
}

async function executeRemoveCloud() {
  const cloud = AppState.activeCloud;
  if (!cloud) return;

  const btn = document.getElementById('confirm-remove-btn');
  const ogHtml = btn.innerHTML;
  btn.innerHTML = `<div class="spinner" style="width:14px;height:14px;margin:auto;border-color:white transparent white transparent"></div>`;
  btn.disabled = true;

  try {
    const r = await apiCall('DELETE', `/auth/cloud-account/${cloud}`);
    if (r.ok) {
      closeRemoveCloudModal();
      showToast(`${cloud.toUpperCase()} account disconnected successfully`, 'success');
      
      AppState.connectedClouds = r.data.connectedClouds || [];
      AppState.activeCloud = AppState.connectedClouds[0] || null;
      
      localStorage.setItem('cco_clouds', JSON.stringify(AppState.connectedClouds));
      if (AppState.activeCloud) {
        localStorage.setItem('cco_active_cloud', AppState.activeCloud);
      } else {
        localStorage.removeItem('cco_active_cloud');
      }
      
      if (AppState.user) {
        AppState.user.connectedClouds = AppState.connectedClouds;
        localStorage.setItem('cco_user', JSON.stringify(AppState.user));
      }
      
      delete AppState.dashboardCache[cloud];
      buildCloudTabs(AppState.connectedClouds);
      
      if (AppState.currentPage === 'home') loadHomePage();
      else if (AppState.currentPage === 'dashboard') loadDashboardPage();
      else if (AppState.currentPage === 'migration') loadMigrationPage();
    } else {
      showToast(r.data.message || 'Failed to remove cloud', 'error');
    }
  } catch (err) {
    showToast('Network error — please try again', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = ogHtml;
  }
}

// ── TIME PERIOD SELECTOR ──────────────────────────────────────────
function setPeriod(period) {
  AppState.period = period;

  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`period-${period}`);
  if (btn) btn.classList.add('active');

  const infoEl = document.getElementById('period-info');
  if (infoEl) {
    const labels = { week: 'last 7 days', month: 'last 30 days', year: 'last 12 months' };
    infoEl.textContent = `Showing ${labels[period] || period}`;
  }

  // Re-render mini charts if data is cached
  const cloud = AppState.activeCloud;
  if (cloud && AppState.dashboardCache[cloud]) {
    const { services_overview } = AppState.dashboardCache[cloud];
    if (services_overview) {
      // Build services map for chart update
      renderServicesGrid(cloud, services_overview);
    }
  }
}

// ── HOME PAGE ─────────────────────────────────────────────────────
async function loadHomePage() {
  const cloud = AppState.activeCloud;

  const title = document.getElementById('home-title');
  const subtitle = document.getElementById('home-subtitle');

  if (!cloud) {
    title.textContent = 'Cloud Overview';
    subtitle.textContent = 'Connect a cloud account to get started';
    document.getElementById('kpi-grid').innerHTML = renderNoCloudMsg();
    document.getElementById('alerts-list').innerHTML = '';
    document.getElementById('top-services-list').innerHTML = '';
    return;
  }

  title.textContent = `${getCloudName(cloud)} Overview`;
  subtitle.textContent = `Account summary for ${getCloudName(cloud)}`;

  // Show skeleton
  document.getElementById('kpi-grid').innerHTML = Array(5).fill(0).map((_, i) => `
    <div class="kpi-card ${['blue','green','orange','red','purple'][i]}">
      <div class="skeleton" style="height:12px; width:80px; margin-bottom:12px;"></div>
      <div class="skeleton" style="height:26px; width:120px;"></div>
      <div class="skeleton" style="height:16px; width:60px; margin-top:10px; border-radius:20px;"></div>
    </div>
  `).join('');

  try {
    const r = await apiCall('GET', `/dashboard/${cloud}`);
    if (!r.ok) throw new Error(r.data.message);

    AppState.dashboardCache[cloud] = r.data;
    const { summary, alerts, top_cost_services, services_overview, cost_breakdown_by_tag } = r.data;

    // KPI Cards
    renderKPICards(summary);

    // Alerts
    renderAlerts(alerts || []);

    // Top services
    renderTopServices(top_cost_services || []);

    // Donut chart
    if (services_overview && services_overview.length > 0) {
      const labels = services_overview.map(s => s.service_name);
      const data = services_overview.map(s => s.monthly_cost);
      ChartUtils.renderDonutChart('home-donut-chart', labels, data);
      renderDonutLegend(labels, data);
    }

    // Tag chart
    if (cost_breakdown_by_tag && Object.keys(cost_breakdown_by_tag).length > 0) {
      ChartUtils.renderTagBarChart(
        'home-tag-chart',
        Object.keys(cost_breakdown_by_tag),
        Object.values(cost_breakdown_by_tag)
      );
    }

    // Update data mode badge
    updateDataModeBadge(r.data.dataMode);

  } catch (err) {
    showToast('Error loading dashboard: ' + err.message, 'error');
    document.getElementById('kpi-grid').innerHTML = `<div style="grid-column:span 5; padding:24px; color:var(--danger); text-align:center;">${err.message}</div>`;
  }
}

function renderKPICards(summary) {
  if (!summary) return;

  const pct = summary.cost_change_percent || 0;
  const direction = pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral';
  const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : '→';

  const cards = [
    {
      color: 'blue',
      label: 'Total Monthly Cost',
      value: '$' + (summary.total_monthly_cost || 0).toLocaleString(undefined, {minimumFractionDigits: 2}),
      change: `${arrow} ${Math.abs(pct).toFixed(1)}% vs last month`,
      changeDir: direction,
    },
    {
      color: 'green',
      label: 'Active Services',
      value: summary.active_services || 0,
      change: 'Running services',
      changeDir: 'neutral',
    },
    {
      color: 'orange',
      label: 'Total Resources',
      value: summary.total_resources || 0,
      change: 'Managed instances',
      changeDir: 'neutral',
    },
    {
      color: 'red',
      label: 'Cost Alerts',
      value: summary.cost_alerts || 0,
      change: 'Require attention',
      changeDir: (summary.cost_alerts || 0) > 0 ? 'up' : 'neutral',
    },
    {
      color: 'purple',
      label: 'Projected Monthly',
      value: '$' + (summary.projected_monthly_cost || 0).toLocaleString(undefined, {minimumFractionDigits: 2}),
      change: 'Based on current trend',
      changeDir: 'neutral',
    },
  ];

  document.getElementById('kpi-grid').innerHTML = cards.map(c => `
    <div class="kpi-card ${c.color}">
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${c.value}</div>
      <div class="kpi-change ${c.changeDir}">${c.change}</div>
    </div>
  `).join('');
}

function renderAlerts(alerts) {
  const list = document.getElementById('alerts-list');
  const badge = document.getElementById('alert-count-badge');
  if (badge) badge.textContent = alerts.length;

  if (alerts.length === 0) {
    list.innerHTML = `
      <div class="empty-state" style="padding:28px;">
        <div class="empty-state-icon">
          <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <h3>No active alerts</h3>
        <p>Your cloud resources look healthy</p>
      </div>
    `;
    return;
  }

  list.innerHTML = alerts.map(a => `
    <div class="alert-item ${a.severity}">
      <div class="alert-dot ${a.severity}"></div>
      <div style="flex:1;">
        <div class="alert-message">${escapeHtml(a.message)}</div>
        <div class="alert-service">${a.service || ''} ${a.resource ? '— ' + a.resource : ''}</div>
      </div>
      ${a.potential_savings > 0 ? `<div class="alert-savings">Save $${a.potential_savings.toFixed(2)}/mo</div>` : ''}
    </div>
  `).join('');
}

function renderTopServices(services) {
  const list = document.getElementById('top-services-list');
  if (!services || services.length === 0) {
    list.innerHTML = '<div class="text-muted text-sm">No data available</div>';
    return;
  }

  const max = services[0]?.cost || 1;

  list.innerHTML = services.slice(0, 5).map((s, i) => {
    const rankClasses = ['r1', 'r2', 'r3', '', ''];
    const pct = ((s.cost / max) * 100).toFixed(0);
    return `
      <div class="top-service-item">
        <div class="top-service-rank ${rankClasses[i]}">${i + 1}</div>
        <div class="top-service-bar-wrap">
          <div class="top-service-name">${escapeHtml(s.service)}</div>
          <div class="top-service-bar">
            <div class="top-service-bar-fill" style="width: ${pct}%"></div>
          </div>
        </div>
        <div class="top-service-cost">$${s.cost.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
      </div>
    `;
  }).join('');
}

function renderDonutLegend(labels, data) {
  const el = document.getElementById('home-donut-legend');
  if (!el) return;
  const total = data.reduce((a, b) => a + b, 0);
  const colors = ChartUtils.CHART_COLORS;

  el.innerHTML = labels.map((l, i) => {
    const pct = total > 0 ? ((data[i] / total) * 100).toFixed(1) : 0;
    return `
      <div class="flex items-center gap-2" style="margin-bottom:8px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${colors[i % colors.length]};flex-shrink:0;"></div>
        <div style="flex:1;font-size:12px;color:var(--text-2);font-weight:500;">${escapeHtml(l)}</div>
        <div style="font-size:12px;font-weight:700;color:var(--text);">$${data[i].toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div>
        <div style="font-size:11px;color:var(--text-muted);min-width:36px;text-align:right;">${pct}%</div>
      </div>
    `;
  }).join('');
}

// ── DASHBOARD PAGE ────────────────────────────────────────────────
async function loadDashboardPage() {
  const cloud = AppState.activeCloud;
  const grid = document.getElementById('services-grid');

  document.getElementById('dashboard-title').textContent = cloud ? `${getCloudName(cloud)} Dashboard` : 'Dashboard';
  document.getElementById('dashboard-subtitle').textContent = cloud ? `Service breakdown and AI analysis for ${getCloudName(cloud)}` : 'Select a cloud provider to view dashboard';

  if (!cloud) {
    grid.innerHTML = `<div style="grid-column:span 2;">${renderNoCloudMsg()}</div>`;
    return;
  }

  grid.innerHTML = `
    <div style="grid-column:span 2;">
      <div class="spinner-wrap"><div class="spinner"></div><div class="spinner-text">Loading ${getCloudName(cloud)} dashboard...</div></div>
    </div>
  `;

  try {
    let dashData;
    if (AppState.dashboardCache[cloud]) {
      dashData = AppState.dashboardCache[cloud];
    } else {
      const r = await apiCall('GET', `/dashboard/${cloud}`);
      if (!r.ok) throw new Error(r.data.message);
      dashData = r.data;
      AppState.dashboardCache[cloud] = dashData;
    }

    renderServicesGrid(cloud, dashData.services_overview || []);

    // Load AI overview
    loadDashboardOverview(cloud);

    updateDataModeBadge(dashData.dataMode);

  } catch (err) {
    showToast('Error loading dashboard: ' + err.message, 'error');
    grid.innerHTML = `<div style="grid-column:span 2; padding:32px; text-align:center; color:var(--danger);">${err.message}</div>`;
  }
}

function renderServicesGrid(cloud, services) {
  const grid = document.getElementById('services-grid');
  if (!services || services.length === 0) {
    grid.innerHTML = `<div style="grid-column:span 2;"><div class="empty-state"><h3>No services found</h3><p>No service data is available for this cloud provider.</p></div></div>`;
    return;
  }

  const period = AppState.period;
  const icons = getServiceIcons();

  grid.innerHTML = services.map((svc, i) => {
    const color = ChartUtils.CHART_COLORS[i % ChartUtils.CHART_COLORS.length];
    const trendDir = svc.trend === 'up' ? 'up' : svc.trend === 'down' ? 'down' : 'stable';
    const trendLabel = svc.trend_percent > 0 ? `+${svc.trend_percent.toFixed(1)}%` : `${(svc.trend_percent || 0).toFixed(1)}%`;
    const iconBgColor = color + '20';
    const iconData = icons[svc.key] || icons.default;
    const rCount = svc.resource_count || 0;
    
    // Calculate displayed amount based on period
    let displayCost = svc.monthly_cost || 0;
    if (period === 'week') displayCost = displayCost * 0.233; // approx weekly cost
    if (period === 'year') displayCost = displayCost * 12; // approx yearly cost

    return `
      <div class="service-card" onclick="openServiceModal('${cloud}', '${svc.key}', null)" id="svc-card-${svc.key}">
        <div class="service-card-top">
          <div class="service-info">
            <div class="service-name">${escapeHtml(svc.service_name)}</div>
            <div class="service-cost">$${displayCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            <div class="service-cost-pct">${(svc.cost_percentage || 0).toFixed(1)}% of total spend</div>
          </div>
          <div class="service-icon" style="background: ${iconBgColor};">
            <svg width="20" height="20" fill="none" stroke="${color}" stroke-width="1.8" viewBox="0 0 24 24">${iconData}</svg>
          </div>
        </div>
        <div class="service-trend ${trendDir}">
          ${trendDir === 'up' ? '↑' : trendDir === 'down' ? '↓' : '→'} ${trendLabel} this period
        </div>
        <div class="service-chart-wrap">
          <canvas id="mini-chart-${svc.key}" height="70"></canvas>
          <div class="service-chart-overlay">
            <div class="overlay-hint">Click for details</div>
            <div class="overlay-stats">
              <div class="overlay-stat">
                <div class="overlay-stat-value">${rCount}</div>
                <div class="overlay-stat-label">Resources</div>
              </div>
              <div class="overlay-stat">
                <div class="overlay-stat-value">${(svc.cost_percentage || 0).toFixed(0)}%</div>
                <div class="overlay-stat-label">of Total</div>
              </div>
            </div>
          </div>
        </div>
        <div class="service-card-footer">
          <span class="resource-count">${rCount} resource${rCount !== 1 ? 's' : ''}</span>
          <span class="click-hint">View details →</span>
        </div>
      </div>
    `;
  }).join('');

  // Render mini charts with a tiny delay for canvas to mount
  setTimeout(() => {
    services.forEach((svc, i) => {
      const color = ChartUtils.CHART_COLORS[i % ChartUtils.CHART_COLORS.length];
      ChartUtils.renderMiniChart(`mini-chart-${svc.key}`, svc.cost_history, svc.months, period, color);
    });
  }, 60);
}

// ── DARK MODE TOGGLE ──────────────────────────────────────────────
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('cco_theme', isDark ? 'dark' : 'light');
  
  const moon = document.getElementById('theme-icon-moon');
  const sun = document.getElementById('theme-icon-sun');
  if (moon && sun) {
    if (isDark) {
      moon.style.display = 'none';
      sun.style.display = 'block';
      Chart.defaults.color = '#9ca3af';
    } else {
      moon.style.display = 'block';
      sun.style.display = 'none';
      Chart.defaults.color = '#6b7280';
    }
  }

  // Refresh current charts
  if (AppState.currentPage === 'home') loadHomePage();
  else if (AppState.currentPage === 'dashboard') loadDashboardPage();
}

function initTheme() {
  const loadedTheme = localStorage.getItem('cco_theme');
  if (loadedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    const moon = document.getElementById('theme-icon-moon');
    const sun = document.getElementById('theme-icon-sun');
    if (moon) moon.style.display = 'none';
    if (sun) sun.style.display = 'block';
    Chart.defaults.color = '#9ca3af';
  }
}

function refreshDashboard() {
  const cloud = AppState.activeCloud;
  if (cloud) delete AppState.dashboardCache[cloud];
  loadDashboardPage();
}

function refreshHomeData() {
  const cloud = AppState.activeCloud;
  if (cloud) delete AppState.dashboardCache[cloud];
  loadHomePage();
}

// ── MIGRATION PAGE ────────────────────────────────────────────────
function loadMigrationPage() {
  const cloud = AppState.activeCloud;
  const clouds = AppState.connectedClouds;

  const cloudList = document.getElementById('mig-cloud-list');
  if (!cloudList) return;

  if (!clouds || clouds.length === 0) {
    cloudList.innerHTML = `<p class="text-muted text-sm">No clouds connected. Please add a cloud account first.</p>`;
    return;
  }

  const cachedData = cloud ? AppState.dashboardCache[cloud] : null;
  const costStr = cachedData?.summary?.total_monthly_cost
    ? `$${cachedData.summary.total_monthly_cost.toLocaleString(undefined, {minimumFractionDigits: 2})}/mo`
    : 'Cost data available';

  cloudList.innerHTML = clouds.map(c => `
    <div class="cloud-compare-card ${c === (AppState.migrationCloud || cloud) ? 'selected' : ''}"
         onclick="selectMigrationCloud('${c}')">
      <div class="cloud-logo ${c}">${c === 'aws' ? 'AWS' : c === 'azure' ? 'AZR' : 'GCP'}</div>
      <div class="cloud-compare-info">
        <div class="cloud-compare-name">${getCloudName(c)}</div>
        <div class="cloud-compare-cost">${c === (cloud) ? costStr : 'Click to load'}</div>
      </div>
      ${c === (AppState.migrationCloud || cloud) ? `<svg width="16" height="16" fill="none" stroke="var(--primary)" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>` : ''}
    </div>
  `).join('');

  AppState.migrationCloud = AppState.migrationCloud || cloud;
}

function selectMigrationCloud(cloud) {
  AppState.migrationCloud = cloud;
  loadMigrationPage();
}

// ── USER MENU ─────────────────────────────────────────────────────
function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  menu.classList.toggle('open');
}

document.addEventListener('click', (e) => {
  const avatar = document.getElementById('user-avatar');
  const menu = document.getElementById('user-menu');
  if (!avatar?.contains(e.target) && !menu?.contains(e.target)) {
    menu?.classList.remove('open');
  }
});

// ── DATA MODE BADGE ───────────────────────────────────────────────
async function updateDataModeBadge(mode) {
  if (!mode) {
    try {
      const r = await fetch(`${API_BASE}/health`);
      const d = await r.json();
      mode = d.dataMode;
    } catch (_) { return; }
  }

  const dot = document.getElementById('mode-dot');
  const text = document.getElementById('mode-text');
  if (!dot || !text) return;

  if (mode === 'real') {
    dot.className = 'mode-dot real';
    text.textContent = 'Live Data';
  } else {
    dot.className = 'mode-dot mock';
    text.textContent = 'Mock Data';
  }
}

// ── UTILITIES ────────────────────────────────────────────────────
function getCloudName(cloud) {
  const names = { aws: 'Amazon Web Services', azure: 'Microsoft Azure', gcp: 'Google Cloud Platform' };
  return names[cloud] || cloud?.toUpperCase() || 'Cloud';
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderNoCloudMsg() {
  return `
    <div class="no-cloud-msg">
      <div class="empty-state-icon">
        <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>
      </div>
      <h3>No Cloud Account Connected</h3>
      <p>Click "Add Cloud" in the top bar to connect your AWS, Azure, or GCP account to see your cost data.</p>
      <button class="btn btn-primary mt-3" onclick="openAddCloudModal()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Connect a Cloud
      </button>
    </div>
  `;
}

function getServiceIcons() {
  return {
    ec2: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    lambda: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    s3: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    rds: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    dynamodb: '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>',
    cloudfront: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>',
    ecs: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><path d="M8 21h8m-4-4v4"/>',
    elasticbeanstalk: '<path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/>',
    // Azure
    virtual_machines: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    app_service: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    functions: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    aks: '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>',
    blob_storage: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    sql_database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    cosmos_db: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    file_storage: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    // GCP
    compute_engine: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/>',
    gke: '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>',
    cloud_storage: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>',
    firestore: '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>',
    bigquery: '<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>',
    cloud_functions: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    app_engine: '<path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/>',
    filestore: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    default: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  };
}

// ── UPDATE USER UI ────────────────────────────────────────────────
function updateUserUI() {
  const user = AppState.user;
  if (!user) return;

  const avatar = document.getElementById('user-avatar');
  const menuName = document.getElementById('menu-name');
  const menuEmail = document.getElementById('menu-email');

  const initials = (user.name || user.username || 'U').substring(0, 2).toUpperCase();
  if (avatar) avatar.textContent = initials;
  if (menuName) menuName.textContent = user.name || user.username;
  if (menuEmail) menuEmail.textContent = user.email || '';

  const adminNav = document.getElementById('nav-admin');
  if (adminNav) {
    adminNav.style.display = (user.username === 'admin') ? 'flex' : 'none';
  }
}

// ── ADMIN PAGE ────────────────────────────────────────────────────
async function loadAdminUsers() {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" style="padding: 20px; text-align: center;"><div class="spinner"></div> <span class="spinner-text">Loading users...</span></td></tr>`;

  try {
    const r = await apiCall('GET', '/auth/admin/users');
    if (!r.ok) throw new Error(r.data.message || 'Failed to load users');

    const { users, credentials } = r.data;

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--text-muted);">No users found.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => {
      const creds = credentials[u.id] || {};
      const cloudPills = (u.connectedClouds || []).map(c => `<span class="badge" style="font-size: 10px; padding: 2px 6px; background: var(--${c}-bg, #333); color: var(--${c}, #fff); border: 1px solid var(--${c}, #fff);">${c.toUpperCase()}</span>`).join(' ');
      
      let credsHtml = '';
      if (Object.keys(creds).length === 0) {
        credsHtml = '<span style="color: var(--text-muted); font-size: 12px;">None</span>';
      } else {
        credsHtml = Object.entries(creds).map(([cName, cData]) => {
            const hasCreds = cData.credentials && Object.keys(cData.credentials).length > 0;
            let credDetails = '';
            if (hasCreds) {
              const items = Object.entries(cData.credentials).map(([k, v]) => {
                return `<div style="font-size: 10px; color: var(--text-muted);"><span style="color:var(--text);">${escapeHtml(k)}:</span> ${escapeHtml(v)}</div>`;
              }).join('');
              credDetails = `<div style="margin-left: 8px; margin-top: 2px;">${items}</div>`;
            }

            return `<div style="font-size: 11px; margin-bottom: 8px;">
              <strong>${cName.toUpperCase()}:</strong> 
              <span style="color: ${hasCreds ? 'var(--success)' : 'var(--text-muted)'}">${hasCreds ? '' : 'Empty'}</span>
              ${credDetails}
            </div>`;
        }).join('');
      }

      return `
        <tr style="border-bottom: 1px solid var(--border);">
          <td style="padding: 12px; font-size: 12px; font-family: monospace; color: var(--text-muted); vertical-align: top;">${escapeHtml(u.id)}</td>
          <td style="padding: 12px; font-weight: 500; color: var(--text); vertical-align: top;">${escapeHtml(u.username)}</td>
          <td style="padding: 12px; color: var(--text-muted); font-size: 13px; vertical-align: top;">${escapeHtml(u.email)}</td>
          <td style="padding: 12px; color: var(--text); vertical-align: top;">${escapeHtml(u.name)}</td>
          <td style="padding: 12px; vertical-align: top;">${cloudPills || '<span style="color: var(--text-muted); font-size: 12px;">None</span>'}</td>
          <td style="padding: 12px; vertical-align: top;">${credsHtml}</td>
          <td style="padding: 12px; text-align: right; vertical-align: top;">
            <button class="btn btn-xs btn-danger" onclick="deleteAdminUser('${escapeHtml(u.id)}')" ${AppState.user && AppState.user.id === u.id ? 'disabled' : ''}>Delete</button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--danger);">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function deleteAdminUser(id) {
  if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
  
  try {
    const r = await apiCall('DELETE', '/auth/admin/users/' + encodeURIComponent(id));
    if (r.ok) {
      showToast('User deleted successfully', 'success');
      loadAdminUsers();
    } else {
      showToast(r.data.message || 'Failed to delete user', 'error');
    }
  } catch (err) {
    showToast('Network error while deleting user', 'error');
  }
}

// ── SIMULATOR PAGE ────────────────────────────────────────────────
function loadSimulatorPage() {
  // Mount page if not already present
  let pg = document.getElementById('page-simulator');
  if (!pg) {
    const appContent = document.querySelector('.app-content');
    const tpl = document.getElementById('simulator-page-tpl');
    if (!appContent || !tpl) return;
    pg = document.createElement('div');
    pg.className = 'page';
    pg.id = 'page-simulator';
    pg.appendChild(tpl.content.cloneNode(true));
    appContent.appendChild(pg);
  }
  pg.classList.add('active');

  // Render the simulator panel
  const container = document.getElementById('sim-panel-container');
  if (container && window.EndpointSimulator) {
    container.innerHTML = EndpointSimulator.renderPanel();
  }

  // Update data mode pill
  const dot   = document.getElementById('sim-mode-dot');
  const label = document.getElementById('sim-mode-label');
  const mode  = AppState.dashboardCache?.[AppState.activeCloud]?.dataMode;
  if (dot && label) {
    if (mode === 'real') {
      dot.className = 'mode-dot real'; label.textContent = 'Live Data';
    } else {
      dot.className = 'mode-dot mock'; label.textContent = 'Mock Data';
    }
  }
}

// ── ADMIN CONFIG ───────────────────────────────────────────────────
async function loadAdminConfig() {
  try {
    const resp = await fetch('/api/auth/admin/config', {
      headers: { 'Authorization': `Bearer ${AppState.token}` }
    });
    const data = await resp.json();
    if (!data.success) return;

    const cfg = data.config;

    // Toggle state
    const toggle = document.getElementById('config-real-data-toggle');
    const track  = document.getElementById('cfg-track');
    const thumb  = document.getElementById('cfg-thumb');
    const status = document.getElementById('config-mode-status');
    if (toggle) {
      toggle.checked = cfg.useRealData;
      if (track) track.style.background = cfg.useRealData ? '#3b82f6' : '';
      if (thumb) thumb.style.transform  = cfg.useRealData ? 'translateX(20px)' : '';
      if (status) {
        status.textContent  = cfg.useRealData ? '🟢 Currently: LIVE DATA' : '🟡 Currently: MOCK DATA';
        status.style.color  = cfg.useRealData ? '#16a34a' : '#d97706';
      }
    }

    // Gemini badge
    const badge = document.getElementById('gemini-status-badge');
    if (badge) {
      badge.textContent       = cfg.geminiConfigured ? '✔ Configured' : '✖ Not Set';
      badge.style.background  = cfg.geminiConfigured ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.1)';
      badge.style.color       = cfg.geminiConfigured ? '#16a34a' : '#dc2626';
    }

    // Show masked key as placeholder
    const keyInput = document.getElementById('config-gemini-key');
    if (keyInput && cfg.geminiApiKey) keyInput.placeholder = cfg.geminiApiKey;

  } catch (err) {
    console.error('[Admin Config] Load error:', err);
  }
}

async function saveAdminConfig() {
  const btn       = document.getElementById('config-save-btn');
  const result    = document.getElementById('config-save-result');
  const toggle    = document.getElementById('config-real-data-toggle');
  const keyInput  = document.getElementById('config-gemini-key');

  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  const body = {};
  if (toggle)   body.useRealData  = toggle.checked;
  if (keyInput && keyInput.value.trim()) body.geminiApiKey = keyInput.value.trim();

  try {
    const resp = await fetch('/api/auth/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AppState.token}` },
      body: JSON.stringify(body),
    });
    const data = await resp.json();

    if (result) {
      result.style.display    = 'block';
      result.style.background = data.success ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)';
      result.style.color      = data.success ? '#16a34a' : '#dc2626';
      result.style.border     = `1px solid ${data.success ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`;
      result.textContent      = data.success ? `✔ ${data.message}` : `✖ ${data.message}`;
      setTimeout(() => { result.style.display = 'none'; }, 5000);
    }

    if (data.success) {
      if (keyInput) keyInput.value = '';
      loadAdminConfig(); // Refresh badge/status
      showToast(data.message, 'success');
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Failed to save config', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Save Changes'; }
  }
}

function toggleDataMode(isLive) {
  const track  = document.getElementById('cfg-track');
  const thumb  = document.getElementById('cfg-thumb');
  const status = document.getElementById('config-mode-status');
  if (track) track.style.background = isLive ? '#3b82f6' : '';
  if (thumb) thumb.style.transform  = isLive ? 'translateX(20px)' : '';
  if (status) {
    status.textContent = isLive ? '🟢 Will switch to: LIVE DATA' : '🟡 Will switch to: MOCK DATA';
    status.style.color = isLive ? '#16a34a' : '#d97706';
  }
}

// ── INIT APP ──────────────────────────────────────────────────────
function initApp() {
  // Switch from auth to app view
  document.getElementById('auth-page').style.display = 'none';
  const appPage = document.getElementById('app-page');
  appPage.classList.add('active');

  initTheme();
  updateUserUI();
  buildCloudTabs(AppState.connectedClouds);
  updateDataModeBadge();

  // Load home page
  showPage('home');
}

// ── BOOT ──────────────────────────────────────────────────────────
(function boot() {
  if (AppState.token && AppState.user) {
    // Already logged in — restore session
    // Quick verify (optional — just boot into app)
    initApp();
  } else {
    // Show auth
    document.getElementById('auth-page').style.display = 'flex';
    document.getElementById('app-page').classList.remove('active');
  }
})();

// ── Expose render helpers for the endpoint simulator ──────────────
window.renderKPICards     = renderKPICards;
window.renderAlerts       = renderAlerts;
window.renderTopServices  = renderTopServices;
window.renderDonutLegend  = renderDonutLegend;
window.renderServicesGrid = renderServicesGrid;

/* ═══════════════════════════════════════════════════════════════════
   modals.js — Service detail modal, rendering, and interactions
   ═══════════════════════════════════════════════════════════════════ */

// ── OPEN SERVICE DETAIL MODAL ────────────────────────────────────
async function openServiceModal(cloud, serviceKey, servicesData) {
  const overlay = document.getElementById('service-modal');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Set initial loading state
  document.getElementById('modal-title').textContent = serviceKey.toUpperCase();
  document.getElementById('modal-subtitle').textContent = `Loading ${serviceKey} details...`;
  document.getElementById('modal-left-content').innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;
  document.getElementById('modal-ai-content').textContent = 'Click "Ask Gemini" to get AI analysis for this service.';

  // Clear modal chat
  document.getElementById('modal-chat-messages').innerHTML = `
    <div class="chat-msg system">
      <div class="chat-bubble">Ask about this service's costs, usage, or optimization options.</div>
    </div>
  `;

  try {
    // Get service detail from API
    const r = await apiCall('GET', `/dashboard/${cloud}/service/${serviceKey}`);
    if (!r.ok) throw new Error(r.data.message || 'Failed to load service data');

    const serviceData = r.data.data;
    const svcName = serviceData.service_name || serviceKey;

    document.getElementById('modal-title').textContent = svcName;
    document.getElementById('modal-subtitle').textContent = `${cloud.toUpperCase()} — Detailed cost and resource analysis`;

    // Store context for AI chat
    window.ModalState = { cloud, service: serviceKey, serviceData };

    // Render left panel
    renderModalLeft(cloud, serviceKey, serviceData);

    // Auto-trigger AI if wanted
    // loadModalServiceAI(cloud, serviceKey, serviceData);

  } catch (err) {
    document.getElementById('modal-left-content').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h3>Error loading service</h3>
        <p>${err.message}</p>
      </div>
    `;
  }
}

// ── RENDER MODAL LEFT PANEL ──────────────────────────────────────
function renderModalLeft(cloud, serviceKey, serviceData) {
  const left = document.getElementById('modal-left-content');
  const period = window.AppState?.period || 'month';
  const idx = getServiceIndex(serviceKey);
  const color = ChartUtils.CHART_COLORS[idx % ChartUtils.CHART_COLORS.length];

  const resources = AIUtils.getResourceArray(serviceData);
  const recommendations = collectRecommendations(resources);

  // Build stats
  const monthlyCost = serviceData.monthly_cost || 0;
  const costPct = serviceData.cost_percentage || 0;
  const trendPct = serviceData.trend_percent || 0;

  let html = `
    <!-- Stats row -->
    <div class="modal-stats">
      <div class="modal-stat">
        <div class="modal-stat-label">Monthly Cost</div>
        <div class="modal-stat-value">$${monthlyCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
      </div>
      <div class="modal-stat">
        <div class="modal-stat-label">% of Total</div>
        <div class="modal-stat-value">${costPct.toFixed(1)}%</div>
      </div>
      <div class="modal-stat">
        <div class="modal-stat-label">Trend</div>
        <div class="modal-stat-value" style="color: ${trendPct > 0 ? 'var(--danger)' : trendPct < 0 ? 'var(--success)' : 'var(--text-muted)'}">
          ${trendPct > 0 ? '+' : ''}${trendPct.toFixed(1)}%
        </div>
      </div>
    </div>

    <!-- Cost History Chart -->
    <div class="mb-3">
      <div class="section-label">Cost History</div>
      <div class="chart-container" style="height: 180px;">
        <canvas id="modal-service-chart"></canvas>
      </div>
    </div>
  `;

  // Resources table
  if (resources.length > 0) {
    html += `
      <div class="mb-3">
        <div class="section-label">${resources.length} Resource${resources.length !== 1 ? 's' : ''}</div>
        <div class="resource-table-wrap">
          ${buildResourceTable(cloud, serviceKey, resources)}
        </div>
      </div>
    `;
  }

  // Recommendations
  if (recommendations.length > 0) {
    html += `
      <div>
        <div class="section-label">Optimization Recommendations</div>
        ${recommendations.map(rec => `
          <div class="rec-item">
            <div class="rec-icon">
              <svg width="14" height="14" fill="none" stroke="var(--warning)" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div>${AIUtils.escapeHtml(rec)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  left.innerHTML = html;

  // Render chart
  setTimeout(() => {
    ChartUtils.renderModalServiceChart(
      'modal-service-chart',
      serviceData.cost_history,
      serviceData.months,
      period,
      color
    );
  }, 50);

  // Attach row click handlers
  left.querySelectorAll('.resource-row').forEach(row => {
    row.addEventListener('click', () => {
      const resId = row.dataset.id;
      const resName = row.dataset.name;
      openResourceDetail(cloud, serviceKey, resId || resName, resources);
    });
  });
}

// ── BUILD RESOURCE TABLE ─────────────────────────────────────────
function buildResourceTable(cloud, serviceKey, resources) {
  if (resources.length === 0) return '<p class="text-muted text-sm">No resources found</p>';

  // Determine which columns to show based on available keys
  const sample = resources[0];
  const cols = [];

  if ('name' in sample) cols.push({ key: 'name', label: 'Name' });
  if ('id' in sample && !cols.find(c => c.key === 'id')) cols.push({ key: 'id', label: 'ID' });
  if ('type' in sample || 'instance_class' in sample || 'runtime' in sample || 'platform' in sample) {
    cols.push({ key: 'type', label: 'Type' });
  }
  if ('state' in sample || 'status' in sample || 'health' in sample) cols.push({ key: 'state', label: 'Status' });
  if ('region' in sample) cols.push({ key: 'region', label: 'Region' });
  if ('cpu_utilization' in sample) cols.push({ key: 'cpu', label: 'CPU %' });
  if ('monthly_cost' in sample) cols.push({ key: 'monthly_cost', label: 'Monthly Cost' });

  const rows = resources.map(r => {
    const id = r.id || r.name || '';
    const name = r.name || r.id || '';
    const state = r.state || r.status || r.health || '';
    const stateClass = getStateClass(state);
    const type = r.type || r.instance_class || r.runtime || r.platform || r.storage_class || r.engine || r.launch_type || '-';
    const cpu = r.cpu_utilization != null ? `${r.cpu_utilization.toFixed(1)}%` : '-';
    const cost = r.monthly_cost != null ? `$${r.monthly_cost.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-';

    let cells = '';
    cols.forEach(col => {
      if (col.key === 'name') cells += `<td class="font-semibold" style="max-width:160px; overflow:hidden; text-overflow:ellipsis;">${AIUtils.escapeHtml(name)}</td>`;
      else if (col.key === 'id') cells += `<td style="font-family:var(--mono);font-size:11px;color:var(--text-muted);">${AIUtils.escapeHtml(id)}</td>`;
      else if (col.key === 'type') cells += `<td>${AIUtils.escapeHtml(type)}</td>`;
      else if (col.key === 'state') cells += `<td><span class="state-badge ${stateClass}">${AIUtils.escapeHtml(state)}</span></td>`;
      else if (col.key === 'region') cells += `<td class="text-muted" style="font-size:11px;">${AIUtils.escapeHtml(r.region || '-')}</td>`;
      else if (col.key === 'cpu') cells += `<td>${cpu}</td>`;
      else if (col.key === 'monthly_cost') cells += `<td class="font-semibold" style="color:var(--text)">${cost}</td>`;
    });

    return `<tr class="resource-row" data-id="${AIUtils.escapeHtml(id)}" data-name="${AIUtils.escapeHtml(name)}" style="cursor:pointer;" title="Click for details">${cells}</tr>`;
  });

  return `
    <table class="resource-table">
      <thead>
        <tr>${cols.map(c => `<th>${c.label}</th>`).join('')}</tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  `;
}

// ── OPEN INDIVIDUAL RESOURCE DETAIL ─────────────────────────────
async function openResourceDetail(cloud, serviceKey, resourceId, allResources) {
  const resource = allResources.find(r => r.id === resourceId || r.name === resourceId);
  if (!resource) return;

  const left = document.getElementById('modal-left-content');
  const name = resource.name || resource.id;
  const cost = resource.monthly_cost != null ? `$${resource.monthly_cost.toLocaleString(undefined, {minimumFractionDigits: 2})}` : 'N/A';

  document.getElementById('modal-title').textContent = name;
  document.getElementById('modal-subtitle').textContent = `${cloud.toUpperCase()} / ${serviceKey} — Instance Detail`;

  // Build detail view
  const fields = buildDetailFields(resource);

  left.innerHTML = `
    <button class="btn btn-ghost btn-sm mb-3" onclick="openServiceModal('${cloud}', '${serviceKey}', null)">
      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
      Back to ${serviceKey}
    </button>

    <div class="modal-stats" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 20px;">
      ${buildInstanceStats(resource)}
    </div>

    <div class="section-label" style="margin-bottom: 10px;">Resource Details</div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
      ${fields}
    </div>

    ${resource.recommendations && resource.recommendations.length > 0 ? `
      <div class="section-label">Recommendations</div>
      ${resource.recommendations.map(rec => `
        <div class="rec-item">
          <div class="rec-icon">
            <svg width="14" height="14" fill="none" stroke="var(--warning)" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>${AIUtils.escapeHtml(rec)}</div>
        </div>
      `).join('')}
    ` : ''}
  `;

  // Re-attach back button
  const backBtn = left.querySelector('button');
  backBtn.onclick = () => openServiceModal(cloud, serviceKey, null);

  // Update modal chat context
  window.ModalState = { cloud, service: serviceKey, serviceData: resource, resourceId };

  // Load instance AI
  const aiContent = document.getElementById('modal-ai-content');
  aiContent.innerHTML = `
    <div class="ai-loading" style="padding:0;">
      <div class="pulse-dot"></div>
      <span>Analyzing ${name}...</span>
    </div>
  `;

  try {
    const r = await apiCall('GET', `/ai/instance/${cloud}/${serviceKey}/${encodeURIComponent(resourceId)}`);
    if (r.ok && r.data.analysis) {
      aiContent.innerHTML = `<div class="ai-overview-content" style="font-size:12px; max-height:220px; overflow-y:auto;">${AIUtils.renderMarkdown(r.data.analysis)}</div>`;
    } else {
      aiContent.innerHTML = `<p style="font-size:12px; color:var(--text-muted);">Use the chat to ask about this instance.</p>`;
    }
  } catch (_) {
    aiContent.innerHTML = `<p style="font-size:12px; color:var(--text-muted);">Use the chat to ask about this instance.</p>`;
  }
}

// ── BUILD INSTANCE STATS MINI CARDS ─────────────────────────────
function buildInstanceStats(r) {
  const stats = [];
  if (r.monthly_cost != null) stats.push({ label: 'Monthly Cost', value: `$${r.monthly_cost.toLocaleString(undefined, {minimumFractionDigits: 2})}` });
  if (r.cpu_utilization != null) stats.push({ label: 'CPU Usage', value: `${r.cpu_utilization.toFixed(1)}%` });
  if (r.memory_utilization != null) stats.push({ label: 'Memory Usage', value: `${r.memory_utilization.toFixed(1)}%` });
  if (r.uptime_hours != null) stats.push({ label: 'Uptime Hours', value: r.uptime_hours.toLocaleString() });
  if (r.invocations_monthly != null) stats.push({ label: 'Monthly Invocations', value: r.invocations_monthly.toLocaleString() });
  if (r.size_gb != null) stats.push({ label: 'Storage (GB)', value: r.size_gb.toLocaleString() });
  if (r.connections != null) stats.push({ label: 'Connections', value: r.connections });
  if (r.cache_hit_rate != null) stats.push({ label: 'Cache Hit Rate', value: `${r.cache_hit_rate}%` });

  return stats.slice(0, 3).map(s => `
    <div class="modal-stat">
      <div class="modal-stat-label">${s.label}</div>
      <div class="modal-stat-value" style="font-size:18px;">${s.value}</div>
    </div>
  `).join('');
}

// ── BUILD FIELD TILES ────────────────────────────────────────────
function buildDetailFields(r) {
  const exclude = ['id', 'name', 'monthly_cost', 'recommendations', 'cpu_utilization', 'memory_utilization', 'uptime_hours', 'tags'];
  return Object.entries(r)
    .filter(([k, v]) => !exclude.includes(k) && v != null && typeof v !== 'object')
    .map(([k, v]) => {
      const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return `
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:10px 12px;">
          <div class="text-xs text-muted font-semibold" style="text-transform:uppercase;letter-spacing:0.4px;">${AIUtils.escapeHtml(label)}</div>
          <div style="font-size:13px;font-weight:600;color:var(--text);margin-top:3px;">${AIUtils.escapeHtml(String(v))}</div>
        </div>
      `;
    }).join('');
}

// ── HELPERS ──────────────────────────────────────────────────────
function getStateClass(state) {
  if (!state) return '';
  const s = state.toLowerCase();
  if (s === 'running' || s === 'active') return 'running';
  if (s === 'stopped' || s === 'deallocated') return 'stopped';
  if (s === 'available') return 'available';
  if (s === 'pending') return 'pending';
  if (s === 'green') return 'green';
  if (s === 'deployed') return 'deployed';
  return '';
}

function collectRecommendations(resources) {
  const recs = [];
  resources.forEach(r => {
    if (r.recommendations) recs.push(...r.recommendations);
  });
  return [...new Set(recs)].slice(0, 5);
}

function getServiceIndex(key) {
  const keys = ['ec2', 'lambda', 's3', 'rds', 'dynamodb', 'cloudfront', 'ecs', 'elasticbeanstalk',
    'virtual_machines', 'app_service', 'functions', 'aks', 'blob_storage', 'sql_database', 'cosmos_db',
    'compute_engine', 'gke', 'cloud_storage', 'firestore', 'bigquery', 'cloud_functions', 'app_engine'];
  return keys.indexOf(key) >= 0 ? keys.indexOf(key) : Math.abs(key.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 10;
}

// ── CLOSE MODAL ───────────────────────────────────────────────────
function closeServiceModal() {
  const overlay = document.getElementById('service-modal');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  window.ModalState = null;
}

// ── ADD CLOUD MODAL ───────────────────────────────────────────────
let selectedAddCloud = null;

function openAddCloudModal() {
  selectedAddCloud = null;
  document.getElementById('add-cloud-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('add-cloud-error').style.display = 'none';
  ['aws', 'azure', 'gcp'].forEach(c => {
    document.getElementById(`add-${c}-opt`).classList.remove('selected');
    document.getElementById(`add-${c}-creds`).classList.remove('open');
    // Clear inputs
    const inputs = document.getElementById(`add-${c}-creds`).querySelectorAll('input');
    inputs.forEach(i => i.value = '');
  });
}

function closeAddCloudModal() {
  document.getElementById('add-cloud-modal').classList.remove('open');
  document.body.style.overflow = '';
}

function selectAddCloud(cloud) {
  selectedAddCloud = cloud;
  ['aws', 'azure', 'gcp'].forEach(c => {
    document.getElementById(`add-${c}-opt`).classList.toggle('selected', c === cloud);
    document.getElementById(`add-${c}-creds`).classList.toggle('open', c === cloud);
  });
}

async function doAddCloud() {
  if (!selectedAddCloud) {
    showErr('add-cloud-error', 'Please select a cloud provider');
    return;
  }

  const btn = document.getElementById('add-cloud-btn');
  btn.disabled = true;
  btn.textContent = 'Connecting...';

  let credentials = {};
  if (selectedAddCloud === 'aws') {
    credentials = {
      accessKeyId: document.getElementById('add-aws-access').value,
      secretAccessKey: document.getElementById('add-aws-secret').value,
    };
  } else if (selectedAddCloud === 'azure') {
    credentials = {
      subscriptionId: document.getElementById('add-azure-sub').value,
      clientSecret: document.getElementById('add-azure-secret').value,
    };
  } else if (selectedAddCloud === 'gcp') {
    credentials = {
      projectId: document.getElementById('add-gcp-proj').value,
      apiKey: document.getElementById('add-gcp-key').value,
    };
  }

  try {
    const r = await apiCall('POST', '/auth/cloud-account', { cloud: selectedAddCloud, credentials });
    if (r.ok && r.data.connectedClouds) {
      closeAddCloudModal();
      showToast(`${selectedAddCloud.toUpperCase()} account connected successfully`, 'success');
      updateConnectedClouds(r.data.connectedClouds);
    } else {
      showErr('add-cloud-error', r.data.message || 'Failed to connect cloud');
    }
  } catch (err) {
    showErr('add-cloud-error', 'Network error — please try again');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Connect Cloud`;
  }
}

function showErr(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

// Close modals on overlay click
document.getElementById('service-modal').addEventListener('click', function(e) {
  if (e.target === this) closeServiceModal();
});
document.getElementById('add-cloud-modal').addEventListener('click', function(e) {
  if (e.target === this) closeAddCloudModal();
});

// Close on ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeServiceModal();
    closeAddCloudModal();
    document.getElementById('user-menu')?.classList.remove('open');
  }
});

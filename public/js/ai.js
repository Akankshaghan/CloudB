/* ═══════════════════════════════════════════════════════════════════
   ai.js — All AI/Gemini chat and overview logic
   ═══════════════════════════════════════════════════════════════════ */

// ── RENDER MARKDOWN (Gemini responses) ───────────────────────────
function renderMarkdown(text) {
  if (typeof marked !== 'undefined') {
    // Configure marked for safety
    marked.setOptions({
      breaks: true,
      gfm: true,
    });
    return marked.parse(text || '');
  }
  // Fallback: simple formatting
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

// ── DASHBOARD AI OVERVIEW ─────────────────────────────────────────
async function loadDashboardOverview(cloud) {
  const body = document.getElementById('ai-overview-body');
  if (!body) return;

  body.innerHTML = `
    <div class="ai-loading">
      <div class="pulse-dot"></div>
      <span>Analyzing your ${cloud.toUpperCase()} costs...</span>
    </div>
  `;

  try {
    const r = await apiCall('GET', `/ai/overview/${cloud}`);
    if (r.ok && r.data.analysis) {
      body.innerHTML = `
        <div class="ai-overview-content">${renderMarkdown(r.data.analysis)}</div>
      `;
    } else {
      body.innerHTML = `<div class="ai-overview-content"><p style="color:var(--danger)">Could not load AI overview: ${r.data.message || 'Unknown error'}</p></div>`;
    }
  } catch (err) {
    body.innerHTML = `<div class="ai-overview-content"><p style="color:var(--danger)">Error loading AI overview</p></div>`;
  }
}

// ── DASHBOARD CHAT ────────────────────────────────────────────────
async function sendDashChat() {
  const input = document.getElementById('dash-chat-input');
  const message = (input.value || '').trim();
  if (!message) return;

  const cloud = window.AppState?.activeCloud || '';
  input.value = '';
  input.style.height = 'auto';

  appendChatMsg('dash-chat-messages', 'user', message);
  const loadingEl = appendChatMsg('dash-chat-messages', 'loading', '✦ Thinking...');

  try {
    const r = await apiCall('POST', '/ai/chat', { message, cloud: cloud || undefined, context: 'dashboard' });
    loadingEl.remove();
    if (r.ok) {
      appendChatMsg('dash-chat-messages', 'ai', r.data.message, true);
    } else {
      appendChatMsg('dash-chat-messages', 'system', `Error: ${r.data.message || 'Could not get response'}`);
    }
  } catch (err) {
    loadingEl.remove();
    appendChatMsg('dash-chat-messages', 'system', 'Network error — please try again');
  }
}

async function clearDashChat() {
  const cloud = window.AppState?.activeCloud || '';
  await apiCall('POST', '/ai/chat/clear', { cloud, context: 'dashboard' });
  const box = document.getElementById('dash-chat-messages');
  box.innerHTML = `
    <div class="chat-msg system">
      <div class="chat-bubble">Chat cleared. Ask me anything about your cloud costs.</div>
    </div>
  `;
}

// ── MIGRATION ANALYSIS ───────────────────────────────────────────
async function getMigrationAnalysis() {
  const currentCloud = window.AppState?.migrationCloud || window.AppState?.activeCloud || 'aws';
  const targetCloud = document.getElementById('mig-target').value;
  const body = document.getElementById('mig-analysis-body');

  body.innerHTML = `
    <div class="ai-loading">
      <div class="pulse-dot"></div>
      <span>Analyzing migration from ${currentCloud.toUpperCase()}${targetCloud ? ' to ' + targetCloud.toUpperCase() : ''}...</span>
    </div>
  `;

  try {
    const query = targetCloud ? `?targetCloud=${targetCloud}` : '';
    const r = await apiCall('GET', `/ai/migration/${currentCloud}${query}`);
    if (r.ok && r.data.advice) {
      body.innerHTML = `
        <div class="ai-overview-content" style="padding: 16px;">${renderMarkdown(r.data.advice)}</div>
      `;
    } else {
      body.innerHTML = `<div style="padding:16px; color:var(--danger);">Error: ${r.data.message || 'Could not generate analysis'}</div>`;
    }
  } catch (err) {
    body.innerHTML = `<div style="padding:16px; color:var(--danger);">Network error — please try again</div>`;
  }
}

// ── MIGRATION CHAT ───────────────────────────────────────────────
async function sendMigChat() {
  const input = document.getElementById('mig-chat-input');
  const message = (input.value || '').trim();
  if (!message) return;

  const cloud = window.AppState?.migrationCloud || window.AppState?.activeCloud || '';
  input.value = '';
  input.style.height = 'auto';

  appendChatMsg('mig-chat-messages', 'user', message);
  const loadingEl = appendChatMsg('mig-chat-messages', 'loading', '✦ Thinking...');

  try {
    const r = await apiCall('POST', '/ai/chat', { message, cloud: cloud || undefined, context: 'migration' });
    loadingEl.remove();
    if (r.ok) {
      appendChatMsg('mig-chat-messages', 'ai', r.data.message, true);
    } else {
      appendChatMsg('mig-chat-messages', 'system', `Error: ${r.data.message || 'Could not get response'}`);
    }
  } catch (err) {
    loadingEl.remove();
    appendChatMsg('mig-chat-messages', 'system', 'Network error — please try again');
  }
}

async function clearMigChat() {
  const cloud = window.AppState?.migrationCloud || window.AppState?.activeCloud || '';
  await apiCall('POST', '/ai/chat/clear', { cloud, context: 'migration' });
  const box = document.getElementById('mig-chat-messages');
  box.innerHTML = `
    <div class="chat-msg system">
      <div class="chat-bubble">Chat cleared. Ask about migration costs, risks, or timelines.</div>
    </div>
  `;
}

// ── MODAL AI ANALYSIS ─────────────────────────────────────────────
async function loadModalServiceAI(cloud, service, serviceData) {
  const content = document.getElementById('modal-ai-content');
  content.innerHTML = `
    <div class="ai-loading" style="padding:0;">
      <div class="pulse-dot"></div>
      <span>Analyzing ${service} costs...</span>
    </div>
  `;

  try {
    // Try to get instance-level AI analysis
    const resources = getResourceArray(serviceData);
    if (resources.length > 0) {
      const firstId = resources[0].id || resources[0].name;
      const r = await apiCall('GET', `/ai/instance/${cloud}/${service}/${encodeURIComponent(firstId)}`);
      if (r.ok && r.data.analysis) {
        content.innerHTML = `<div class="ai-overview-content" style="font-size:12px; max-height: 200px; overflow-y: auto;">${renderMarkdown(r.data.analysis)}</div>`;
        // Pre-fill modal chat with context
        primeModalChat(cloud, service, serviceData);
        return;
      }
    }

    // Fall back to generating overview
    content.innerHTML = `<p style="font-size:12px; color:var(--text-muted);">Use the chat below to ask Gemini about this service.</p>`;
  } catch (err) {
    content.innerHTML = `<p style="font-size:12px; color:var(--danger);">Error loading AI analysis</p>`;
  }
}

function primeModalChat(cloud, service, serviceData) {
  window.ModalState = window.ModalState || {};
  window.ModalState.cloud = cloud;
  window.ModalState.service = service;
  window.ModalState.serviceData = serviceData;
}

// ── MODAL CHAT ────────────────────────────────────────────────────
async function sendModalChat() {
  const input = document.getElementById('modal-chat-input');
  const message = (input.value || '').trim();
  if (!message) return;

  const cloud = window.ModalState?.cloud || window.AppState?.activeCloud || '';
  const service = window.ModalState?.service || '';
  input.value = '';
  input.style.height = 'auto';

  appendChatMsg('modal-chat-messages', 'user', message);
  const loadingEl = appendChatMsg('modal-chat-messages', 'loading', '✦ Thinking...');

  // Inject service context into message
  const contextMsg = service
    ? `[Context: analyzing ${service} on ${cloud.toUpperCase()}] ${message}`
    : message;

  try {
    const r = await apiCall('POST', '/ai/chat', { message: contextMsg, cloud: cloud || undefined, context: 'instance' });
    loadingEl.remove();
    if (r.ok) {
      appendChatMsg('modal-chat-messages', 'ai', r.data.message, true);
    } else {
      appendChatMsg('modal-chat-messages', 'system', `Error: ${r.data.message || 'Could not get response'}`);
    }
  } catch (err) {
    loadingEl.remove();
    appendChatMsg('modal-chat-messages', 'system', 'Network error — please try again');
  }
}

async function clearModalChat() {
  const cloud = window.ModalState?.cloud || '';
  await apiCall('POST', '/ai/chat/clear', { cloud, context: 'instance' });
  const box = document.getElementById('modal-chat-messages');
  box.innerHTML = `
    <div class="chat-msg system">
      <div class="chat-bubble">Chat cleared.</div>
    </div>
  `;
}

// "Ask Gemini" button pressed — load AI for current modal service
async function askGeminiForService() {
  const { cloud, service, serviceData } = window.ModalState || {};
  if (!cloud || !service) return;
  await loadModalServiceAI(cloud, service, serviceData);
}

// ── CHAT HELPER: append message to a chat box ─────────────────────
function appendChatMsg(boxId, role, text, isMarkdown = false) {
  const box = document.getElementById(boxId);
  if (!box) return null;

  const wrap = document.createElement('div');
  wrap.className = `chat-msg ${role}`;

  let avatarHtml = '';
  if (role === 'ai' || role === 'loading') {
    avatarHtml = `<div class="msg-avatar ai-av">✦</div>`;
  } else if (role === 'user') {
    const initials = (window.AppState?.user?.name || 'U').substring(0, 1).toUpperCase();
    avatarHtml = `<div class="msg-avatar user-av">${initials}</div>`;
  }

  const bubbleContent = isMarkdown ? renderMarkdown(text) : escapeHtml(text);

  wrap.innerHTML = role !== 'system'
    ? `${avatarHtml}<div class="chat-bubble">${isMarkdown ? bubbleContent : escapeHtml(text)}</div>`
    : `<div class="chat-bubble">${escapeHtml(text)}</div>`;

  box.appendChild(wrap);
  box.scrollTop = box.scrollHeight;
  return wrap;
}

// ── UTILITY ──────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
}

function getResourceArray(serviceData) {
  if (!serviceData) return [];
  const keys = ['instances', 'functions', 'buckets', 'tables', 'distributions', 'clusters', 'databases', 'accounts', 'plans', 'environments', 'applications', 'shares'];
  for (const k of keys) {
    if (serviceData[k] && serviceData[k].length > 0) return serviceData[k];
  }
  return [];
}

// Expose globally
window.AIUtils = {
  renderMarkdown,
  appendChatMsg,
  escapeHtml,
  autoResize,
  getResourceArray,
  loadDashboardOverview,
  loadModalServiceAI,
  primeModalChat,
  getMigrationAnalysis,
};

/* ═══════════════════════════════════════════════════════
   pdf.js — Landscape PDF Report: Preview + Download
   ═══════════════════════════════════════════════════════ */

// Cached blob URL so preview and download share one generation
let _pdfBlobUrl = null;
let _pdfFilename = null;

// ── Core PDF builder — returns jsPDF doc ─────────────────
function _buildPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const PW = 841.89, PH = 595.28;
  const ML = 40, MR = 40;
  const CW = PW - ML - MR;

  const C = {
    brand: [59, 130, 246], brandDk: [37, 99, 235],
    dark: [17, 24, 39], mid: [55, 65, 81], muted: [107, 114, 128],
    light: [249, 250, 251], border: [229, 231, 235], white: [255, 255, 255],
    success: [22, 163, 74], danger: [220, 38, 38], warn: [217, 119, 6],
    purple: [124, 58, 237], row1: [255, 255, 255], row2: [248, 250, 252],
  };
  const ACCENT = ['#3b82f6', '#7c3aed', '#0891b2', '#d97706', '#16a34a', '#dc2626', '#db2777', '#059669'];

  const cloud = window.AppState?.activeCloud || 'cloud';
  const dash = window.AppState?.dashboardCache?.[cloud] || {};
  const summary = dash.summary || {};
  const alerts = dash.alerts || [];
  const topSvcs = dash.top_cost_services || [];
  const services = dash.services_overview || [];
  const tagData = dash.cost_breakdown_by_tag || {};
  const now = new Date();
  const CNAMES = { aws: 'Amazon Web Services', azure: 'Microsoft Azure', gcp: 'Google Cloud Platform' };
  const cloudName = CNAMES[cloud] || cloud.toUpperCase();
  const isLive = dash.dataMode === 'real';

  let y = 40, pageNum = 1;

  function hexRGB(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function cImg(id) { const e = document.getElementById(id); return e ? e.toDataURL('image/png') : null; }
  function font(s, sz, col) { doc.setFont('helvetica', s); doc.setFontSize(sz); if (col) doc.setTextColor(col[0], col[1], col[2]); }
  function txt(s, x, ty, o) { doc.text(String(s || ''), x, ty, o || {}); }
  function fillR(x, ry, w, h, col, r) { doc.setFillColor(col[0], col[1], col[2]); r ? doc.roundedRect(x, ry, w, h, r, r, 'F') : doc.rect(x, ry, w, h, 'F'); }
  function strokeR(x, ry, w, h, col, lw, r) { doc.setDrawColor(col[0], col[1], col[2]); doc.setLineWidth(lw || 0.5); r ? doc.roundedRect(x, ry, w, h, r, r, 'S') : doc.rect(x, ry, w, h, 'S'); }
  function hline(x1, y1, x2, col, lw) { doc.setDrawColor(col[0], col[1], col[2]); doc.setLineWidth(lw || 0.5); doc.line(x1, y1, x2, y1); }
  function sec(title, ry) { font('bold', 11, C.brand); txt(title, ML, ry); hline(ML, ry + 6, PW - MR, C.brand, 1); return ry + 20; }
  function footer() { hline(ML, PH - 30, PW - MR, C.border, 0.5); font('normal', 8, C.muted); txt('CloudOpt — Cloud Cost Optimization Platform', ML, PH - 16); txt(`${now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}  |  Page ${pageNum}`, PW - MR, PH - 16, { align: 'right' }); }
  function newPage() { footer(); doc.addPage(); pageNum++; y = 40; }
  function need(h) { if (y + h > PH - 50) newPage(); }

  // ── PAGE 1: HEADER + KPIs + CHARTS ──────────────────────

  // Header
  fillR(0, 0, PW, 100, C.brand);
  fillR(0, 85, PW, 18, C.brandDk);
  doc.setFillColor(255, 255, 255);
  doc.setGState(new doc.GState({ opacity: 0.07 }));
  doc.circle(760, 20, 75, 'F'); doc.circle(100, 90, 45, 'F');
  doc.setGState(new doc.GState({ opacity: 1 }));
  font('bold', 22, C.white); txt('CloudOpt', ML, 42);
  font('normal', 9, [200, 220, 255]); txt('Cloud Cost Optimization Platform', ML, 56);
  font('bold', 16, C.white); txt('Cost & Performance Report', ML, 78);
  font('normal', 8.5, [200, 220, 255]);
  txt(`${cloudName}  ·  ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`, ML, 91);
  fillR(PW - MR - 82, 10, 80, 20, isLive ? C.success : C.warn, 5);
  font('bold', 8, C.white); txt(isLive ? '● LIVE DATA' : 'MOCK DATA', PW - MR - 42, 24, { align: 'center' });

  y = 118;

  // KPI Cards
  y = sec('EXECUTIVE SUMMARY', y);
  const kpis = [
    { label: 'Total Monthly Cost', value: '$' + (summary.total_monthly_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }), color: C.brand, sub: `${(summary.cost_change_percent || 0) >= 0 ? '▲' : '▼'} ${Math.abs(summary.cost_change_percent || 0).toFixed(1)}% vs last month`, subC: (summary.cost_change_percent || 0) > 0 ? C.danger : C.success },
    { label: 'Projected Monthly', value: '$' + (summary.projected_monthly_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }), color: C.purple, sub: 'Based on current trend', subC: C.muted },
    { label: 'Active Services', value: String(summary.active_services || 0), color: C.success, sub: 'Running services', subC: C.muted },
    { label: 'Total Resources', value: String(summary.total_resources || 0), color: C.warn, sub: 'Managed instances', subC: C.muted },
    { label: 'Cost Alerts', value: String(summary.cost_alerts || 0), color: (summary.cost_alerts || 0) > 0 ? C.danger : C.muted, sub: (summary.cost_alerts || 0) > 0 ? 'Require attention' : 'All clear', subC: (summary.cost_alerts || 0) > 0 ? C.danger : C.success },
  ];
  const kW = (CW - 16) / 5, kH = 72;
  kpis.forEach((k, i) => {
    const kx = ML + i * (kW + 4);
    fillR(kx, y, kW, kH, C.light, 5); strokeR(kx, y, kW, kH, C.border, 0.4, 5); fillR(kx, y, kW, 4, k.color, 5);
    font('normal', 8, C.muted); txt(k.label, kx + 10, y + 20);
    font('bold', 14, k.color); txt(k.value, kx + 10, y + 40);
    font('normal', 7.5, k.subC); txt(k.sub, kx + 10, y + 58);
  });
  y += kH + 18;

  // Charts row
  y = sec('COST BREAKDOWN', y);
  const chartH = 170, donutW = CW * 0.52 - 6, tagW = CW * 0.48 - 6;
  const donutImg = cImg('home-donut-chart'), tagImg = cImg('home-tag-chart');

  fillR(ML, y, donutW, chartH, C.light, 5); strokeR(ML, y, donutW, chartH, C.border, 0.4, 5);
  font('bold', 9, C.dark); txt('Service Distribution (Monthly)', ML + 10, y + 16);
  if (donutImg) {
    doc.addImage(donutImg, 'PNG', ML + 10, y + 22, 130, 130);
    if (services.length > 0) {
      const total = services.reduce((a, s) => a + s.monthly_cost, 0);
      let ly = y + 28;
      services.slice(0, 8).forEach((s, i) => {
        const [r, g, b] = hexRGB(ACCENT[i % ACCENT.length]);
        doc.setFillColor(r, g, b); doc.roundedRect(ML + 152, ly - 5, 8, 8, 2, 2, 'F');
        font('normal', 7.5, C.dark); txt(s.service_name.slice(0, 22), ML + 164, ly);
        const pv = total > 0 ? ((s.monthly_cost / total) * 100).toFixed(1) : '0.0';
        font('bold', 7.5, C.dark); txt(`${pv}%`, ML + donutW - 8, ly, { align: 'right' });
        ly += 14;
      });
    }
  } else { font('italic', 9, C.muted); txt('Chart not available', ML + donutW / 2, y + chartH / 2, { align: 'center' }); }

  const tx = ML + donutW + 12;
  fillR(tx, y, tagW, chartH, C.light, 5); strokeR(tx, y, tagW, chartH, C.border, 0.4, 5);
  font('bold', 9, C.dark); txt('Spend by Environment / Tag', tx + 10, y + 16);
  if (tagImg) { doc.addImage(tagImg, 'PNG', tx + 10, y + 22, tagW - 20, chartH - 32); }
  else if (Object.keys(tagData).length > 0) {
    const tags = Object.entries(tagData), maxT = Math.max(...tags.map(t => t[1]));
    let ty2 = y + 32;
    tags.forEach(([label, val], i) => {
      const [r, g, b] = hexRGB(ACCENT[i % ACCENT.length]);
      font('normal', 8, C.dark); txt(label, tx + 10, ty2);
      const bw = (val / maxT) * (tagW - 110);
      fillR(tx + 90, ty2 - 9, tagW - 110, 10, C.border, 2); fillR(tx + 90, ty2 - 9, bw, 10, [r, g, b], 2);
      font('bold', 8, C.dark); txt(`$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, tx + tagW - 8, ty2, { align: 'right' });
      ty2 += 22;
    });
  }

  y += chartH + 10; footer();

  // ── PAGE 2: SERVICES TABLE + SERVICE CARDS ───────────────
  newPage();
  y = sec('TOP COST SERVICES', y);

  if (topSvcs.length > 0) {
    const ROW_H = 26, HDR_H = 28;
    fillR(ML, y, CW, HDR_H, C.dark, 4); font('bold', 9, C.white);
    txt('#', ML + 12, y + 19); txt('Service', ML + 50, y + 19);
    txt('Monthly Cost', ML + 270, y + 19); txt('% of Total', ML + 400, y + 19);
    txt('Spend Bar', ML + 480, y + 19); txt('Trend', ML + 680, y + 19);
    y += HDR_H;
    const maxC = topSvcs[0]?.cost || 1, totalC = summary.total_monthly_cost || maxC;
    const rCols = [C.brand, C.purple, C.warn];
    topSvcs.slice(0, 10).forEach((svc, i) => {
      need(ROW_H);
      fillR(ML, y, CW, ROW_H, i % 2 === 0 ? C.row1 : C.row2); strokeR(ML, y, CW, ROW_H, C.border, 0.3);
      const rC = i < 3 ? rCols[i] : C.muted;
      fillR(ML + 6, y + 7, 26, 12, rC, 6); font('bold', 8, C.white); txt(String(i + 1), ML + 19, y + 17, { align: 'center' });
      font('normal', 9, C.dark); txt(svc.service || '-', ML + 50, y + 17);
      font('bold', 9, C.dark); txt(`$${svc.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, ML + 270, y + 17);
      const pctV = totalC > 0 ? ((svc.cost / totalC) * 100).toFixed(1) : '0.0';
      font('normal', 8.5, C.muted); txt(`${pctV}%`, ML + 400, y + 17);
      const bx = ML + 480, bw = (svc.cost / maxC) * 180;
      fillR(bx, y + 8, 180, 10, C.border, 3); fillR(bx, y + 8, bw, 10, rC, 3);
      const td = (svc.trend || 'stable') === 'up' ? '▲' : (svc.trend || 'stable') === 'down' ? '▼' : '→';
      const tc = (svc.trend || 'stable') === 'up' ? C.danger : (svc.trend || 'stable') === 'down' ? C.success : C.muted;
      font('bold', 8.5, tc); txt(`${td} ${(svc.trend_percent || 0).toFixed(1)}%`, ML + 680, y + 17);
      y += ROW_H;
    });
    strokeR(ML, y - topSvcs.slice(0, 10).length * ROW_H - HDR_H, CW, topSvcs.slice(0, 10).length * ROW_H + HDR_H, C.border, 0.5, 4);
    y += 18;
  }

  if (services.length > 0) {
    need(50); y = sec('SERVICE DETAILS', y);
    const sW = (CW - 18) / 4, sH = 100;
    for (let i = 0; i < services.length; i += 4) {
      const row = services.slice(i, i + 4); need(sH + 10);
      row.forEach((svc, j) => {
        const sx = ML + j * (sW + 6); const [r, g, b] = hexRGB(ACCENT[(i + j) % ACCENT.length]);
        fillR(sx, y, sW, sH, C.light, 5); strokeR(sx, y, sW, sH, C.border, 0.4, 5); fillR(sx, y, sW, 4, [r, g, b], 5);
        font('bold', 9, C.dark); txt(svc.service_name.slice(0, 22), sx + 8, y + 22);
        font('bold', 13, [r, g, b]); txt(`$${(svc.monthly_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, sx + 8, y + 40);
        font('normal', 7.5, C.muted); txt(`${(svc.cost_percentage || 0).toFixed(1)}% of total`, sx + 8, y + 52);
        const td2 = svc.trend === 'up' ? '▲' : svc.trend === 'down' ? '▼' : '→';
        const tc2 = svc.trend === 'up' ? C.danger : svc.trend === 'down' ? C.success : C.muted;
        font('bold', 8, tc2); txt(`${td2} ${(svc.trend_percent || 0).toFixed(1)}%`, sx + 8, y + 64);
        font('normal', 7.5, C.muted); txt(`${svc.resource_count || 0} resources`, sx + sW - 8, y + 64, { align: 'right' });
        const img = cImg(`mini-chart-${svc.key}`);
        if (img) doc.addImage(img, 'PNG', sx + 8, y + 68, sW - 16, 26);
      });
      y += sH + 10;
    }
  }

  // ── PAGE 3: ALERTS + TAG ─────────────────────────────────
  if (alerts.length > 0) {
    newPage(); y = sec('ACTIVE ALERTS', y);
    fillR(ML + 105, y - 36, 54, 18, C.danger, 5); font('bold', 8, C.white);
    txt(`${alerts.length} Alert${alerts.length !== 1 ? 's' : ''}`, ML + 132, y - 24, { align: 'center' });
    const AH = 26, AHDH = 28;
    fillR(ML, y, CW, AHDH, C.dark, 4); font('bold', 9, C.white);
    txt('Severity', ML + 10, y + 19); txt('Message', ML + 100, y + 19);
    txt('Service', ML + 440, y + 19); txt('Resource', ML + 580, y + 19);
    txt('Savings/mo', PW - MR - 10, y + 19, { align: 'right' });
    y += AHDH;
    alerts.slice(0, 14).forEach((a, i) => {
      need(AH);
      fillR(ML, y, CW, AH, i % 2 === 0 ? C.row1 : C.row2); strokeR(ML, y, CW, AH, C.border, 0.3);
      const sc = a.severity === 'high' ? C.danger : a.severity === 'medium' ? C.warn : C.success;
      fillR(ML, y, 4, AH, sc); fillR(ML + 8, y + 7, 70, 12, sc, 3);
      font('bold', 7.5, C.white); txt((a.severity || 'info').toUpperCase(), ML + 43, y + 16, { align: 'center' });
      font('normal', 8, C.dark);
      const ml = doc.splitTextToSize(a.message || '', 325);
      txt(ml[0] || '', ML + 90, y + 12);
      if (ml[1]) { font('normal', 7, C.muted); txt(ml[1], ML + 90, y + 21); }
      font('normal', 8, C.muted); txt(a.service || '—', ML + 440, y + 16); txt(a.resource || '—', ML + 580, y + 16);
      if (a.potential_savings > 0) { font('bold', 8.5, C.success); txt(`$${a.potential_savings.toFixed(2)}`, PW - MR - 10, y + 16, { align: 'right' }); }
      y += AH;
    });
    strokeR(ML, y - alerts.slice(0, 14).length * AH - AHDH, CW, alerts.slice(0, 14).length * AH + AHDH, C.border, 0.5, 4);
    y += 22;
  }

  if (Object.keys(tagData).length > 0) {
    need(50); y = sec('COST BY TAG / ENVIRONMENT', y);
    const tags = Object.entries(tagData), maxT = Math.max(...tags.map(t => t[1])), total = Object.values(tagData).reduce((a, b) => a + b, 0);
    fillR(ML, y, CW, 26, C.dark, 4); font('bold', 9, C.white);
    txt('Environment / Tag', ML + 14, y + 18); txt('Monthly Cost', ML + 300, y + 18);
    txt('% of Total', ML + 460, y + 18); txt('Spend Distribution', ML + 560, y + 18);
    y += 26;
    tags.forEach(([label, val], i) => {
      need(26);
      fillR(ML, y, CW, 26, i % 2 === 0 ? C.row1 : C.row2); strokeR(ML, y, CW, 26, C.border, 0.3);
      const [r, g, b] = hexRGB(ACCENT[i % ACCENT.length]);
      doc.setFillColor(r, g, b); doc.circle(ML + 14, y + 13, 5, 'F');
      font('bold', 9, C.dark); txt(label, ML + 26, y + 17);
      font('bold', 9, C.dark); txt(`$${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, ML + 300, y + 17);
      const pv = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
      font('normal', 9, C.muted); txt(`${pv}%`, ML + 460, y + 17);
      const bw = (val / maxT) * 200;
      fillR(ML + 560, y + 8, 200, 10, C.border, 3); fillR(ML + 560, y + 8, bw, 10, [r, g, b], 3);
      y += 26;
    });
    strokeR(ML, y - tags.length * 26 - 26, CW, tags.length * 26 + 26, C.border, 0.5, 4);
  }

  // Footer every page
  const tp = doc.internal.getNumberOfPages();
  for (let p = 1; p <= tp; p++) { doc.setPage(p); footer(); }

  return doc;
}

// ── PREVIEW ───────────────────────────────────────────────
async function previewReportPDF() {
  const modal = document.getElementById('pdf-preview-modal');
  const loading = document.getElementById('pdf-preview-loading');
  const iframe = document.getElementById('pdf-preview-iframe');
  const meta = document.getElementById('pdf-preview-meta');
  const cloud = window.AppState?.activeCloud || 'cloud';
  const now = new Date();

  // Show modal with spinner
  modal.style.display = 'flex';
  loading.style.display = 'flex';
  iframe.style.display = 'none';
  document.body.style.overflow = 'hidden';

  // Let repaint happen before heavy PDF work
  await new Promise(r => setTimeout(r, 60));

  try {
    const doc = _buildPDF();
    const blob = doc.output('blob');

    // Revoke old URL
    if (_pdfBlobUrl) URL.revokeObjectURL(_pdfBlobUrl);
    _pdfBlobUrl = URL.createObjectURL(blob);
    _pdfFilename = `cloudopt-report-${cloud}-${now.toISOString().slice(0, 10)}.pdf`;

    const pages = doc.internal.getNumberOfPages();
    meta.textContent = `${pages} page${pages !== 1 ? 's' : ''} · Landscape A4 · ${(blob.size / 1024).toFixed(1)} KB`;

    iframe.src = _pdfBlobUrl;
    iframe.onload = () => {
      loading.style.display = 'none';
      iframe.style.display = 'block';
    };
  } catch (err) {
    console.error('Preview error:', err);
    modal.style.display = 'none';
    document.body.style.overflow = '';
    showToast('Failed to generate preview: ' + err.message, 'error');
  }
}

// ── CLOSE PREVIEW ─────────────────────────────────────────
function closePDFPreview() {
  const modal = document.getElementById('pdf-preview-modal');
  const iframe = document.getElementById('pdf-preview-iframe');
  modal.style.display = 'none';
  iframe.src = '';
  document.body.style.overflow = '';
}

// ── DOWNLOAD ─────────────────────────────────────────────
async function downloadReportPDF() {
  const btn = document.getElementById('pdf-confirm-download');
  const origHTML = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = `<div class="spinner" style="width:13px;height:13px;display:inline-block;margin-right:5px;border-color:white transparent white transparent"></div> Saving...`; }

  try {
    const cloud = window.AppState?.activeCloud || 'cloud';
    const now = new Date();

    // Re-use cached blob if available, else rebuild
    if (_pdfBlobUrl && _pdfFilename) {
      const a = document.createElement('a');
      a.href = _pdfBlobUrl;
      a.download = _pdfFilename;
      a.click();
    } else {
      const doc = _buildPDF();
      const fname = `cloudopt-report-${cloud}-${now.toISOString().slice(0, 10)}.pdf`;
      doc.save(fname);
    }
    showToast('PDF downloaded successfully!', 'success');
  } catch (err) {
    console.error('Download error:', err);
    showToast('Download failed: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = origHTML; }
  }
}

// Close on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('pdf-preview-modal');
    if (modal && modal.style.display === 'flex') closePDFPreview();
  }
});

window.previewReportPDF = previewReportPDF;
window.closePDFPreview = closePDFPreview;
window.downloadReportPDF = downloadReportPDF;

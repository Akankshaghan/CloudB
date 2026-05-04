/* ═══════════════════════════════════════════════════════════════════
   charts.js — All Chart.js initialization and rendering logic
   ═══════════════════════════════════════════════════════════════════ */

// Chart registry — track all active chart instances
const ChartRegistry = {};

// ── PALETTE ────────────────────────────────────────────────────────
const CHART_COLORS = [
  '#4a80f0', '#7c3aed', '#0891b2', '#d97706', '#16a34a',
  '#dc2626', '#db2777', '#059669', '#7729a8', '#ea580c',
];

const CHART_COLORS_ALPHA = (i, a = 0.15) => {
  const hex = CHART_COLORS[i % CHART_COLORS.length];
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

// ── GLOBAL DEFAULTS ───────────────────────────────────────────────
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#6b7280';
Chart.defaults.plugins.legend.display = false;
Chart.defaults.plugins.tooltip.backgroundColor = '#1a1d23';
Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
Chart.defaults.plugins.tooltip.bodyColor = '#d1d5db';
Chart.defaults.plugins.tooltip.borderColor = '#374151';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.titleFont = { weight: '600', size: 12 };

// ── HELPER: Destroy & re-create chart ────────────────────────────
function createChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  if (ChartRegistry[canvasId]) {
    ChartRegistry[canvasId].destroy();
    delete ChartRegistry[canvasId];
  }
  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, config);
  ChartRegistry[canvasId] = chart;
  return chart;
}

// ── PERIOD DATA HELPER ────────────────────────────────────────────
// Given monthly data array and period, return sliced/interpolated data
function getPeriodData(costHistory, months, period) {
  if (!costHistory || costHistory.length === 0) return { data: [0], labels: ['N/A'] };

  if (period === 'month') {
    // Return last 5 months as-is
    return { data: costHistory.slice(-5), labels: months ? months.slice(-5) : costHistory.slice(-5).map((_, i) => `M${i+1}`) };
  }

  if (period === 'week') {
    // Simulate 7 days from the last month's value with minor variance
    const last = costHistory[costHistory.length - 1] || 0;
    const weekData = Array.from({ length: 7 }, (_, i) => {
      const variance = (Math.random() - 0.5) * 0.1 * last;
      return Math.max(0, +(last / 30 + variance / 30).toFixed(2));
    });
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return { data: weekData, labels };
  }

  if (period === 'year') {
    // Project 12 months: use existing + extrapolate trend
    const arr = [...costHistory];
    const trend = arr.length >= 2 ? (arr[arr.length-1] - arr[0]) / arr.length : 0;
    while (arr.length < 12) {
      const next = arr[arr.length - 1] + trend + (Math.random() - 0.4) * trend * 0.5;
      arr.push(Math.max(0, +next.toFixed(2)));
    }
    const mLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return { data: arr.slice(-12), labels: mLabels };
  }

  return { data: costHistory, labels: months || [] };
}

// ── MINI LINE CHART (Service cards) ──────────────────────────────
function renderMiniChart(canvasId, costHistory, months, period, color) {
  const pd = getPeriodData(costHistory, months, period);
  const col = color || CHART_COLORS[0];
  const r = parseInt(col.slice(1,3), 16);
  const g = parseInt(col.slice(3,5), 16);
  const b = parseInt(col.slice(5,7), 16);

  return createChart(canvasId, {
    type: 'line',
    data: {
      labels: pd.labels,
      datasets: [{
        data: pd.data,
        borderColor: col,
        borderWidth: 2,
        fill: true,
        backgroundColor: (ctx) => {
          const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 70);
          gradient.addColorStop(0, `rgba(${r},${g},${b},0.2)`);
          gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
          return gradient;
        },
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: col,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      layout: { padding: { top: 2, bottom: 2 } },
      scales: {
        x: { display: false },
        y: { display: false }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => ` $${ctx.parsed.y.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
          }
        }
      }
    }
  });
}

// ── HOME DONUT CHART ─────────────────────────────────────────────
function renderDonutChart(canvasId, labels, data) {
  return createChart(canvasId, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CHART_COLORS.slice(0, data.length),
        borderColor: document.body.classList.contains('dark-mode') ? '#1f2937' : '#ffffff',
        borderWidth: 3,
        hoverBorderWidth: 4,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      animation: { animateRotate: true, duration: 800 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` $${ctx.parsed.toLocaleString()} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// ── HOME TAG BAR CHART ───────────────────────────────────────────
function renderTagBarChart(canvasId, labels, data) {
  return createChart(canvasId, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CHART_COLORS.slice(0, data.length).map((c, i) => CHART_COLORS_ALPHA(i, 0.8)),
        borderColor: CHART_COLORS.slice(0, data.length),
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700 },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#f0f2f5', drawBorder: false },
          ticks: {
            callback: (v) => '$' + (v >= 1000 ? (v/1000).toFixed(1)+'k' : v),
          }
        },
        x: {
          grid: { display: false, drawBorder: false },
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => ` $${ctx.parsed.y.toLocaleString()}`
          }
        }
      }
    }
  });
}

// ── SERVICE DETAIL MODAL CHART (Line with full data) ─────────────
function renderModalServiceChart(canvasId, costHistory, months, period, color) {
  const pd = getPeriodData(costHistory, months, period);
  const col = color || CHART_COLORS[0];

  return createChart(canvasId, {
    type: 'line',
    data: {
      labels: pd.labels,
      datasets: [{
        label: 'Monthly Cost ($)',
        data: pd.data,
        borderColor: col,
        borderWidth: 2.5,
        fill: true,
        backgroundColor: (ctx) => {
          const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 180);
          const r = parseInt(col.slice(1,3),16);
          const g = parseInt(col.slice(3,5),16);
          const b = parseInt(col.slice(5,7),16);
          gradient.addColorStop(0, `rgba(${r},${g},${b},0.15)`);
          gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
          return gradient;
        },
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: col,
        pointBorderColor: document.body.classList.contains('dark-mode') ? '#1f2937' : '#ffffff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      scales: {
        y: {
          beginAtZero: false,
          grid: { color: '#f0f2f5', drawBorder: false },
          ticks: {
            callback: (v) => '$' + (v >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(0))
          }
        },
        x: {
          grid: { display: false, drawBorder: false },
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => ` $${ctx.parsed.y.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
          }
        }
      }
    }
  });
}

// ── BEST CLOUD SCORE CHART ───────────────────────────────────────
function renderScoreChart(canvasId, labels, scores) {
  return createChart(canvasId, {
    type: 'radar',
    data: {
      labels: ['Cost', 'Performance', 'Flexibility', 'Support', 'Services'],
      datasets: labels.map((label, i) => ({
        label,
        data: scores[i] || [70, 65, 75, 70, 68],
        borderColor: CHART_COLORS[i],
        backgroundColor: CHART_COLORS_ALPHA(i, 0.12),
        borderWidth: 2,
        pointBackgroundColor: CHART_COLORS[i],
        pointRadius: 4,
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700 },
      plugins: { legend: { display: true, position: 'bottom' } },
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: { display: false },
          grid: { color: '#e2e5ea' },
          pointLabels: { font: { size: 12, weight: '600' } }
        }
      }
    }
  });
}

// ── UPDATE MINI CHARTS (when period changes) ──────────────────────
function updateAllMiniCharts(servicesData, period) {
  Object.entries(servicesData).forEach(([key, svc], i) => {
    const canvasId = `mini-chart-${key}`;
    const color = CHART_COLORS[i % CHART_COLORS.length];
    renderMiniChart(canvasId, svc.cost_history, svc.months, period, color);
  });
}

// Export for use in other scripts
window.ChartUtils = {
  renderMiniChart,
  renderDonutChart,
  renderTagBarChart,
  renderModalServiceChart,
  renderScoreChart,
  updateAllMiniCharts,
  getPeriodData,
  CHART_COLORS,
};

import { Chart, ScatterController, PointElement, LinearScale, LogarithmicScale, Tooltip, Legend } from 'chart.js';
import { colorFor } from '../lib/filters.js';
import { classify, QUADRANT_INFO } from '../lib/quadrants.js';

Chart.register(ScatterController, PointElement, LinearScale, LogarithmicScale, Tooltip, Legend);

const TONE_BG = {
  good:  'rgba(46, 204, 113, 0.18)',
  warn:  'rgba(241, 196, 15, 0.16)',
  cheap: 'rgba(230, 126, 34, 0.16)',
  bad:   'rgba(231, 76, 60, 0.18)',
  unknown: 'rgba(120, 120, 120, 0.06)',
};

const TONE_BORDER = {
  good:  'rgba(46, 204, 113, 0.55)',
  warn:  'rgba(241, 196, 15, 0.55)',
  cheap: 'rgba(230, 126, 34, 0.55)',
  bad:   'rgba(231, 76, 60, 0.55)',
  unknown: 'rgba(255,255,255,0.06)',
};

export function createScatterChart(canvas) {
  const ctx = canvas.getContext('2d');
  return new Chart(ctx, {
    type: 'scatter',
    data: { datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      onClick: (_evt, items) => {
        const dsIndex = items?.[0]?.datasetIndex;
        const i = items?.[0]?.index;
        if (dsIndex == null || i == null) return;
        const ds = chart.data.datasets[dsIndex];
        const m = ds.__models?.[i];
        if (m && chart.__onPointClick) chart.__onPointClick(m);
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const m = ctx.raw?.__m;
              if (!m) return '';
              const lines = [
                `${m.name}`,
                `Intelligence: ${m.intelligence?.toFixed(2) ?? '—'}`,
              ];
              if (m.intelligence_source) lines.push('Intelligence source: Artificial Analysis');
              if (m.intelligence_scope === 'effort-median') {
                lines.push('Intelligence: effort-variant median');
              }
              if (m.intelligence_scope === 'variant-inherited') {
                lines.push(`Intelligence: inherited from ${m.inherit_from ?? 'base'}`);
              }
              if (m.intelligence_source === 'manual') {
                lines.push('Intelligence: manual override (cited)');
              }
              if (m.cost_per_1m_avg != null) lines.push(`Cost: $${m.cost_per_1m_avg.toFixed(4)} / 1M (avg)`);
              if (m.cheapest_provider?.name) lines.push(`Cheapest: ${m.cheapest_provider.name}`);
              lines.push(`Context: ${m.context_length?.toLocaleString() ?? '—'} tokens  ·  Family: ${m.family}`);
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'logarithmic',
          grid: { color: 'rgba(255,255,255,0.06)' },
          afterBuildTicks: (axis) => {
            axis.ticks = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100]
              .filter((v) => v >= axis.min && v <= axis.max)
              .map((v) => ({ value: v }));
          },
          ticks: { color: '#9aa6bd', callback: (v) => `$${v}` },
          title: { display: true, text: 'Cost per 1M tokens (USD, log) — lower is cheaper', color: '#9aa6bd' },
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: '#9aa6bd' },
          title: { display: true, text: 'Artificial Analysis intelligence (0–100) — higher is smarter', color: '#9aa6bd' },
        },
      },
    },
    plugins: [quadrantPlugin],
  });
}

const quadrantPlugin = {
  id: 'quadrantShading',
  beforeDatasetsDraw(chart, _args, opts) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales.x || !scales.y) return;
    const { left, right, top, bottom } = chartArea;
    const x = scales.x;
    const y = scales.y;
    const medCost = opts.medCost;
    const medIntel = opts.medIntel;
    if (medCost == null || medIntel == null) return;

    // Screen Y grows downward: low pixel = high intelligence, high pixel = low
    // intelligence. Top band (top..yMed) = high intel, bottom band = low intel.
    const xMed = x.getPixelForValue(medCost);
    const yMed = y.getPixelForValue(medIntel);

    const regions = [
      { tone: 'good',  x: left, y: top,    w: xMed - left,  h: yMed - top      },
      { tone: 'warn',  x: xMed, y: top,    w: right - xMed, h: yMed - top      },
      { tone: 'cheap', x: left, y: yMed,   w: xMed - left,  h: bottom - yMed   },
      { tone: 'bad',   x: xMed, y: yMed,   w: right - xMed, h: bottom - yMed   },
    ];

    ctx.save();
    for (const r of regions) {
      ctx.fillStyle = TONE_BG[r.tone];
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xMed, top);
    ctx.lineTo(xMed, bottom);
    ctx.moveTo(left, yMed);
    ctx.lineTo(right, yMed);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`median intel ${medIntel.toFixed(1)}`, right - 6, yMed + 4);
    ctx.textAlign = 'left';
    ctx.fillText(`median $${medCost.toFixed(2)}/1M`, xMed + 4, bottom - 16);

    const labels = [
      { tone: 'good',  text: 'Sweet spot', sub: 'high intel · low cost',  x: left + 8,  y: top + 8 },
      { tone: 'warn',  text: 'Premium',    sub: 'high intel · high cost', x: right - 8, y: top + 8,    align: 'right' },
      { tone: 'cheap', text: 'Budget',     sub: 'low intel · low cost',   x: left + 8,  y: bottom - 28 },
      { tone: 'bad',   text: 'Avoid',      sub: 'low intel · high cost',  x: right - 8, y: bottom - 28, align: 'right' },
    ];
    for (const l of labels) {
      ctx.fillStyle = TONE_BORDER[l.tone];
      ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = l.align || 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(l.text, l.x, l.y);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(l.sub, l.x, l.y + 14);
    }
    ctx.restore();
  },
};

export function updateScatterChart(chart, models, medians) {
  const plottable = models.filter((m) => m.intelligence != null && m.cost_per_1m_avg != null);
  const groups = { good: [], warn: [], cheap: [], bad: [] };
  for (const m of plottable) {
    groups[classify(m, medians.medCost, medians.medIntel)].push(m);
  }

  chart.options.plugins.quadrantShading = {
    medCost: medians.medCost,
    medIntel: medians.medIntel,
  };

  // Dynamic x bounds: decades spanning the data, padded one decade each side.
  const costs = plottable.map((m) => m.cost_per_1m_avg);
  const lo = Math.pow(10, Math.floor(Math.log10(Math.min(...costs)))) / 10;
  const hi = Math.pow(10, Math.ceil(Math.log10(Math.max(...costs)))) * 10;
  chart.options.scales.x.min = lo;
  chart.options.scales.x.max = hi;

  chart.data.datasets = Object.entries(groups).map(([tone, ms]) => ({
    label: `${QUADRANT_INFO[tone]?.label || tone} (${ms.length})`,
    data: ms.map((m) => ({
      x: m.cost_per_1m_avg,
      y: m.intelligence,
      r: 8,
      __m: m,
    })),
    backgroundColor: ms.map((m) => hexWithAlpha(colorFor(m.family), 0.85)),
    borderColor: ms.map((m) => hexWithAlpha(colorFor(m.family), 1)),
    borderWidth: 1.5,
    __models: ms,
  }));

  chart.update();
}

function hexWithAlpha(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

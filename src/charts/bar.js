import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { colorFor } from '../lib/filters.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export function createBarChart(canvas) {
  const ctx = canvas.getContext('2d');
  return new Chart(ctx, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Intelligence score', data: [], backgroundColor: [], borderRadius: 4 }] },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      onClick: (_evt, items) => {
        const i = items?.[0]?.index;
        if (i == null) return;
        const id = canvas.__onClickModel?.(i);
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const m = ctx.chart.__models?.[ctx.dataIndex];
              if (!m) return ctx.formattedValue;
              const lines = [
                `Intelligence: ${m.intelligence?.toFixed(2) ?? '—'}`,
              ];
              if (m.intelligence_source) lines.push('Intelligence source: Artificial Analysis');
              if (m.intelligence_scope === 'effort-median') {
                lines.push('Intelligence: effort-variant median');
              }
              if (m.cost_per_1m_avg != null) lines.push(`Cost: $${m.cost_per_1m_avg.toFixed(4)} / 1M (avg)`);
              if (m.cheapest_provider?.name) lines.push(`Cheapest: ${m.cheapest_provider.name}`);
              return lines;
            },
          },
        },
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#9aa6bd' }, title: { display: true, text: 'Artificial Analysis intelligence (0–100)', color: '#9aa6bd' } },
        y: { grid: { display: false }, ticks: { color: '#e7ecf3' } },
      },
    },
  });
}

export function updateBarChart(chart, models) {
  const sorted = models
    .filter((m) => m.intelligence != null)
    .slice()
    .sort((a, b) => b.intelligence - a.intelligence);
  chart.data.labels = sorted.map((m) => `${m.name}${m.intelligence == null ? '  (—)' : ''}`);
  chart.data.datasets[0].data = sorted.map((m) => m.intelligence ?? 0);
  chart.data.datasets[0].backgroundColor = sorted.map((m) => colorFor(m.family));
  chart.__models = sorted;
  chart.update();
}

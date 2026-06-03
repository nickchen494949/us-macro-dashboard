/* US Macro Dashboard Charting Logic using Chart.js */

// Global registry to keep track of active chart instances
const activeCharts = {};

// Helper to filter history data based on selected range
export function filterDataByRange(history, range) {
  if (!history || history.length === 0) return [];
  
  const latestDate = new Date(history[history.length - 1].date);
  let cutoffDate;
  
  if (range === '1Y') {
    cutoffDate = new Date(latestDate);
    cutoffDate.setFullYear(latestDate.getFullYear() - 1);
  } else if (range === '5Y') {
    cutoffDate = new Date(latestDate);
    cutoffDate.setFullYear(latestDate.getFullYear() - 5);
  } else {
    // Max range: return all
    return history;
  }
  
  return history.filter(item => new Date(item.date) >= cutoffDate);
}

// Map card status to theme colors for chart lines and fills
function getStatusColors(status) {
  // Check the document style custom properties or fallback
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  
  const themeColors = {
    improving: {
      border: isDark ? '#34d399' : '#10b981',
      bg: isDark ? 'rgba(52, 211, 153, 0.15)' : 'rgba(16, 185, 129, 0.1)'
    },
    worsening: {
      border: isDark ? '#fbbf24' : '#f59e0b',
      bg: isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(245, 158, 11, 0.1)'
    },
    neutral: {
      border: isDark ? '#9ca3af' : '#64748b',
      bg: isDark ? 'rgba(156, 163, 175, 0.15)' : 'rgba(100, 116, 139, 0.1)'
    },
    danger: {
      border: isDark ? '#f87171' : '#ef4444',
      bg: isDark ? 'rgba(248, 113, 113, 0.15)' : 'rgba(239, 68, 68, 0.1)'
    }
  };
  
  return themeColors[status] || themeColors.neutral;
}

/**
 * Renders or updates a chart for a macro card.
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {Array} history - The processed historical data array [{date, value}]
 * @param {string} status - Card status ('improving', 'worsening', 'neutral', 'danger')
 * @param {string} range - Chart range ('1Y', '5Y', 'Max')
 * @param {string} unit - Display unit (e.g. '%', '$T', 'k')
 */
export function renderCardChart(canvas, history, status, range, unit) {
  if (!canvas) return;
  
  const chartId = canvas.id;
  const filteredData = filterDataByRange(history, range);
  const colors = getStatusColors(status);
  
  const labels = filteredData.map(d => d.date);
  const dataPoints = filteredData.map(d => d.value);
  
  // If chart already exists, update it
  if (activeCharts[chartId]) {
    const chartObj = activeCharts[chartId];
    chartObj.data.labels = labels;
    chartObj.data.datasets[0].data = dataPoints;
    chartObj.data.datasets[0].borderColor = colors.border;
    chartObj.data.datasets[0].backgroundColor = ctx => {
      const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
      gradient.addColorStop(0, colors.bg);
      gradient.addColorStop(1, 'transparent');
      return gradient;
    };
    chartObj.options.plugins.tooltip.callbacks.label = (context) => {
      return ` ${context.parsed.y.toFixed(2)}${unit}`;
    };
    chartObj.update();
    return;
  }
  
  // Otherwise, create a new Chart instance
  const ctx = canvas.getContext('2d');
  
  activeCharts[chartId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        data: dataPoints,
        borderColor: colors.border,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: colors.border,
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 1.5,
        fill: true,
        backgroundColor: context => {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, colors.bg);
          gradient.addColorStop(1, 'transparent');
          return gradient;
        },
        tension: 0.15
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          position: 'nearest',
          backgroundColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#1f2937' : '#ffffff',
          titleColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#f3f4f6' : '#1f2937',
          bodyColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#9ca3af' : '#4b5563',
          borderColor: varColor('--border-color'),
          borderWidth: 1,
          padding: 8,
          titleFont: {
            family: 'Plus Jakarta Sans',
            size: 11,
            weight: '700'
          },
          bodyFont: {
            family: 'Plus Jakarta Sans',
            size: 12,
            weight: '600'
          },
          displayColors: false,
          callbacks: {
            title: (tooltipItems) => {
              const dateStr = tooltipItems[0].label;
              const date = new Date(dateStr);
              return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            },
            label: (context) => {
              return ` ${context.parsed.y.toFixed(2)}${unit}`;
            }
          }
        }
      },
      scales: {
        x: {
          display: false
        },
        y: {
          display: true,
          grid: {
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(55, 65, 81, 0.2)' : 'rgba(226, 232, 240, 0.5)',
            drawTicks: false
          },
          ticks: {
            color: '#9ca3af',
            font: {
              size: 9,
              family: 'Plus Jakarta Sans',
              weight: '500'
            },
            maxTicksLimit: 4,
            callback: function(value) {
              return value + unit;
            }
          },
          border: {
            display: false
          }
        }
      }
    }
  });
}

// Utility to retrieve a CSS custom property value dynamically
function varColor(cssVarName) {
  return getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
}

/**
 * Re-renders all charts on theme switch to update colors.
 * @param {Object} datasets - The dictionary of series datasets
 * @param {string} range - Selected range ('1Y', '5Y', 'Max')
 */
export function refreshAllChartColors(datasets, range) {
  Object.keys(activeCharts).forEach(chartId => {
    const seriesId = chartId.replace('chart-', '');
    const data = datasets[seriesId];
    if (data) {
      const colors = getStatusColors(data.status);
      const chartObj = activeCharts[chartId];
      if (chartObj) {
        chartObj.options.plugins.tooltip.backgroundColor = document.documentElement.getAttribute('data-theme') === 'dark' ? '#1f2937' : '#ffffff';
        chartObj.options.plugins.tooltip.titleColor = document.documentElement.getAttribute('data-theme') === 'dark' ? '#f3f4f6' : '#1f2937';
        chartObj.options.plugins.tooltip.bodyColor = document.documentElement.getAttribute('data-theme') === 'dark' ? '#9ca3af' : '#4b5563';
        chartObj.options.scales.y.grid.color = document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(55, 65, 81, 0.2)' : 'rgba(226, 232, 240, 0.5)';
        
        chartObj.data.datasets[0].borderColor = colors.border;
        chartObj.data.datasets[0].pointHoverBackgroundColor = colors.border;
        
        chartObj.update();
      }
    }
  };
}

/**
 * Destroy a specific chart instance.
 */
export function destroyChart(chartId) {
  if (activeCharts[chartId]) {
    activeCharts[chartId].destroy();
    delete activeCharts[chartId];
  }
}

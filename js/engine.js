// engine.js —— 概率曲线引擎

/**
 * 计算衰减速率常数 k
 * 使在 totalDays 时，(P0 - Ptarget) 衰减至初始值的 5%
 * 即 e^{-k * totalDays} = 0.05
 */
export function calcDecayRate(totalDays) {
  return -Math.log(0.05) / totalDays;
}

/**
 * 构建曲线数据点（每天的概率值）
 * 返回 { days: number[], probs: number[] }
 */
export function generateCurvePoints(P0, Ptarget, totalDays, k) {
  const days = [];
  const probs = [];
  for (let t = 0; t <= totalDays; t++) {
    days.push(t);
    const prob = P0 * Math.exp(-k * t) + Ptarget;
    probs.push(prob);
  }
  return { days, probs };
}

/**
 * 初始化或更新概率曲线图表
 * @param {string} canvasId - canvas 元素 id
 * @param {object} params - { P0, Ptarget, totalDays, k, currentDay }
 * @returns {Chart} Chart.js 实例
 */
export function renderProbabilityChart(canvasId, params) {
  const { P0, Ptarget, totalDays, k, currentDay } = params;
  const { days, probs } = generateCurvePoints(P0, Ptarget, totalDays, k);

  const ctx = document.getElementById(canvasId).getContext('2d');

  // 如果已有图表实例则销毁
  if (window.probChartInstance) {
    window.probChartInstance.destroy();
  }

  // 找到当前天对应的数据点索引
  const markerIndex = days.indexOf(currentDay);

  window.probChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days,
      datasets: [
        {
          label: '习惯发生概率',
          data: probs,
          borderColor: '#68b984',
          backgroundColor: 'rgba(104,185,132,0.1)',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.3,
        },
        {
          // 仅用于标记当前位置点
          label: '你今天的位置',
          data: days.map((_, i) => (i === markerIndex ? probs[i] : null)),
          borderColor: 'transparent',
          backgroundColor: '#fc8181',
          pointRadius: 8,
          pointBorderColor: '#fc8181',
          pointBackgroundColor: '#fc8181',
          showLine: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.label === '你今天的位置') {
                return `第 ${currentDay} 天: ${(ctx.raw * 100).toFixed(1)}%`;
              }
              return `概率: ${(ctx.raw * 100).toFixed(1)}%`;
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: '天数' },
        },
        y: {
          title: { display: true, text: '概率' },
          min: 0,
          max: 1,
        },
      },
    },
  });

  return window.probChartInstance;
}

/**
 * 使用外部提供的自定义数据点绘制曲线（Phase 6 AI 曲线）
 * @param {string} canvasId
 * @param {object} customCurve - { days: number[], probs: number[] }
 * @param {number} currentDay - 当前天数，用于标记
 */
export function renderCustomCurveChart(canvasId, customCurve, currentDay) {
  const { days, probs } = customCurve;
  const ctx = document.getElementById(canvasId).getContext('2d');

  if (window.probChartInstance) {
    window.probChartInstance.destroy();
  }

  const markerIndex = days.indexOf(currentDay);

  window.probChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days,
      datasets: [
        {
          label: '习惯发生概率',
          data: probs,
          borderColor: '#68b984',
          backgroundColor: 'rgba(104,185,132,0.1)',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.3,
        },
        {
          label: '你今天的位置',
          data: days.map((_, i) => (i === markerIndex ? probs[i] : null)),
          borderColor: 'transparent',
          backgroundColor: '#fc8181',
          pointRadius: 8,
          pointBorderColor: '#fc8181',
          pointBackgroundColor: '#fc8181',
          showLine: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          title: { display: true, text: '天数' },
        },
        y: {
          title: { display: true, text: '概率' },
          min: 0,
          max: 1,
        },
      },
    },
  });
}
// engine.js —— 概率曲线引擎（Y轴显示“次/天”）

/**
 * 计算衰减速率常数 k
 */
export function calcDecayRate(totalDays) {
  return -Math.log(0.05) / totalDays;
}

/**
 * 构建曲线数据点（每天的概率值）
 */
export function generateCurvePoints(P0, Ptarget, totalDays, k) {
  const days = [];
  const probs = [];
  for (let t = 0; t <= totalDays; t++) {
    days.push(t);
    probs.push(P0 * Math.exp(-k * t) + Ptarget);
  }
  return { days, probs };
}

/**
 * 绘制概率曲线，Y轴显示“次/天”（概率 × 初始每日频率）
 * @param {string} canvasId
 * @param {object} params - { P0, Ptarget, totalDays, k, currentDay, currentFreq }
 */
export function renderProbabilityChart(canvasId, params) {
  const { P0, Ptarget, totalDays, k, currentDay, currentFreq } = params;
  const { days, probs } = generateCurvePoints(P0, Ptarget, totalDays, k);

  // 频率 = 概率 × 初始每日频率
  const freqs = probs.map(p => +(p * currentFreq).toFixed(1));

  const ctx = document.getElementById(canvasId).getContext('2d');
  if (window.probChartInstance) window.probChartInstance.destroy();

  const markerIndex = days.indexOf(currentDay);

  window.probChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days,
      datasets: [
        {
          label: '预测每日次数',
          data: freqs,
          borderColor: '#68b984',
          backgroundColor: 'rgba(104,185,132,0.1)',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.3,
        },
        {
          label: '你今天的位置',
          data: days.map((_, i) => (i === markerIndex ? freqs[i] : null)),
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
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.label === '你今天的位置') {
                return `第 ${currentDay} 天: ${ctx.raw} 次/天`;
              }
              return `预计 ${ctx.raw} 次/天`;
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: '天数' },
        },
        y: {
          title: { display: true, text: '次/天' },
          min: 0,
          suggestedMax: Math.max(...freqs) + 1,
        },
      },
    },
  });

  return window.probChartInstance;
}

/**
 * 使用外部自定义数据点绘制曲线（频率版）
 * @param {string} canvasId
 * @param {object} customCurve - { days: number[], probs: number[] }
 * @param {number} currentDay
 * @param {number} currentFreq 初始每日频率
 */
export function renderCustomCurveChart(canvasId, customCurve, currentDay, currentFreq) {
  const { days, probs } = customCurve;
  const freqs = probs.map(p => +(p * currentFreq).toFixed(1));

  const ctx = document.getElementById(canvasId).getContext('2d');
  if (window.probChartInstance) window.probChartInstance.destroy();

  const markerIndex = days.indexOf(currentDay);

  window.probChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days,
      datasets: [
        {
          label: '预测每日次数',
          data: freqs,
          borderColor: '#68b984',
          backgroundColor: 'rgba(104,185,132,0.1)',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.3,
        },
        {
          label: '你今天的位置',
          data: days.map((_, i) => (i === markerIndex ? freqs[i] : null)),
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
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: '天数' } },
        y: {
          title: { display: true, text: '次/天' },
          min: 0,
          suggestedMax: Math.max(...freqs) + 1,
        },
      },
    },
  });
}
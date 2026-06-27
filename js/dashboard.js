// dashboard.js —— 数据看板：习惯日历 + 替代行为分布（无破戒）

import { loadData, getToday } from './utils.js';

export function renderDashboard() {
  const data = loadData();
  if (!data || !data.settings) return;

  renderHabitCalendar(data);
  renderSubstitutePieChart(data);
}

function renderHabitCalendar(data) {
  const container = document.getElementById('habitCalendar');
  if (!container) return;

  const todayStr = getToday();
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const today = new Date(ty, tm - 1, td);

  const cells = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateKey = formatLocal(d);
    const logs = data.dailyLogs[dateKey] || [];

    let resultIcon = '';
    let subText = '';
    let moodEmoji = logs.length > 0 ? logs[logs.length - 1].mood || '' : '';
    let expText = '';

    const avoidCount = logs.filter(l => l.decision === 'avoid').length;
    const habitCount = logs.filter(l => l.decision === 'do_habit').length;

    if (avoidCount + habitCount > 0) {
      resultIcon = habitCount > 0 ? '❌' : '✅';
      if (avoidCount > 0 && habitCount > 0) resultIcon = '⚠️';
      subText = `避${avoidCount}/允${habitCount}`;
      const dayExp = avoidCount * 10 + habitCount * 3;
      expText = `${dayExp > 0 ? '+' : ''}${dayExp}`;
    } else {
      resultIcon = '·';
      subText = '无记录';
    }

    cells.push({
      day: d.getDate(),
      resultIcon,
      subText,
      moodEmoji,
      expText,
    });
  }

  let html = '<div class="habit-calendar-grid">';
  cells.forEach(cell => {
    html += `
      <div class="cal-cell">
        <div class="cal-date">${cell.day}</div>
        <div class="cal-mood">${cell.moodEmoji || ''}</div>
        <div class="cal-result">${cell.resultIcon}</div>
        <div class="cal-sub">${cell.subText}</div>
        <div class="cal-exp">${cell.expText}</div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderSubstitutePieChart(data) {
  const canvas = document.getElementById('subsPieChart');
  if (!canvas || !data.substitutes?.items) return;
  const ctx = canvas.getContext('2d');

  const usage = {};
  Object.values(data.dailyLogs).forEach(logs => {
    logs.forEach(log => {
      if (log.substituteName) {
        usage[log.substituteName] = (usage[log.substituteName] || 0) + 1;
      }
    });
  });

  const labels = Object.keys(usage);
  const counts = Object.values(usage);
  const backgroundColors = ['#68b984', '#f6ad55', '#63b3ed', '#fc8181', '#b794f4', '#f6e05e'];

  if (window.pieChart) window.pieChart.destroy();
  if (labels.length === 0) {
    canvas.style.display = 'none';
    return;
  }
  canvas.style.display = 'block';

  window.pieChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: backgroundColors.slice(0, labels.length),
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function formatLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
// app.js —— 应用入口，路由与全局初始化（动态发生次数上限）

import {
  loadData, saveData, loadConfig, saveConfig,
  getSuggestions, normalizeDailyFreq, getToday, isDebug, advanceVirtualDate,
  getTodayDrawCount, freqToProb, getTodayBaseProbability
} from './utils.js';
import { calcDecayRate, renderProbabilityChart, renderCustomCurveChart } from './engine.js';
import { createDefaultSubstitutePool, redistributeWeights, createCustomSubstitute } from './weight.js';
import { initInteraction } from './interaction.js';
import { updateCompanion } from './companion.js';
import { renderDashboard } from './dashboard.js';
import { generatePrompt } from './prompt.js';

let currentView = 'viewWelcome';

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  console.log('[initApp] 初始化开始, debug=', isDebug());
  const data = loadData();

  setupThemeToggle();
  setupBottomNav();
  setupDebugPanel();

  if (data && data.settings && data.substitutes) {
    switchView('viewMain');
    renderMainView(data);
  } else {
    switchView('viewWelcome');
  }

  document.getElementById('welcomeStartBtn')?.addEventListener('click', () => {
    switchView('viewSetup');
  });

  document.getElementById('setupForm')?.addEventListener('submit', handleSetupSubmit);
  document.getElementById('confirmSubsBtn')?.addEventListener('click', handleConfirmSubs);
  document.getElementById('addSubBtn')?.addEventListener('click', handleAddCustomSub);
  document.getElementById('settingsBtn')?.addEventListener('click', showSettingsModal);
  document.getElementById('expHelpIcon')?.addEventListener('click', showExpHelp);

  document.getElementById('aiCurveSetupBtn')?.addEventListener('click', () => {
    generatePrompt();
  });

  // 实时智能建议
  const form = document.getElementById('setupForm');
  if (form) {
    const fields = ['currentFreq', 'freqUnit', 'targetFreq', 'targetFreqUnit', 'targetDays'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updateSetupSuggestions);
    });
    const selectors = ['freqUnit', 'targetFreqUnit'];
    selectors.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', updateSetupSuggestions);
    });
    updateSetupSuggestions();
  }

  window.addEventListener('refreshUI', () => {
    const currentData = loadData();
    if (currentData && currentView === 'viewMain') renderMainView(currentData);
  });
}

function updateSetupSuggestions() {
  const currentFreq = parseInt(document.getElementById('currentFreq').value);
  const freqUnit = document.getElementById('freqUnit').value;
  const targetFreq = parseInt(document.getElementById('targetFreq').value);
  const targetFreqUnit = document.getElementById('targetFreqUnit').value;
  const targetDays = parseInt(document.getElementById('targetDays').value);
  const bubble = document.getElementById('suggestionBubble');
  const targetDaysInput = document.getElementById('targetDays');

  if (isNaN(currentFreq) || isNaN(targetFreq) || isNaN(targetDays)) {
    if (bubble) bubble.hidden = true;
    if (targetDaysInput) targetDaysInput.classList.remove('input-warning');
    return;
  }

  const suggestions = getSuggestions(currentFreq, targetFreq, targetDays, freqUnit, targetFreqUnit);
  if (suggestions.length && bubble) {
    bubble.innerHTML = suggestions.join('<br>');
    bubble.hidden = false;
    if (targetDaysInput) targetDaysInput.classList.add('input-warning');
  } else if (bubble) {
    bubble.hidden = true;
    if (targetDaysInput) targetDaysInput.classList.remove('input-warning');
  }
}

// ---------- 调试面板 ----------
function setupDebugPanel() {
  const panel = document.getElementById('debugPanel');
  if (!panel) return;
  if (!isDebug()) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  updateDebugDateDisplay();

  const btnAdvance = document.getElementById('debugAdvanceDay');
  const btnReset = document.getElementById('debugResetToday');
  const btnResetAll = document.getElementById('debugResetAll');
  if (!btnAdvance || !btnReset || !btnResetAll) return;

  const newAdvance = btnAdvance.cloneNode(true);
  btnAdvance.parentNode.replaceChild(newAdvance, btnAdvance);
  const newReset = btnReset.cloneNode(true);
  btnReset.parentNode.replaceChild(newReset, btnReset);
  const newResetAll = btnResetAll.cloneNode(true);
  btnResetAll.parentNode.replaceChild(newResetAll, btnResetAll);

  newAdvance.addEventListener('click', () => {
    const newDate = advanceVirtualDate(1);
    updateDebugDateDisplay();
    refreshMainView();
    alert(`已前进到 ${newDate}，页面已刷新。`);
  });
  newReset.addEventListener('click', () => {
    const data = loadData();
    const today = getToday();
    if (data?.dailyLogs[today]) {
      delete data.dailyLogs[today];
      saveData(data);
      alert('今日日志已清除，可重新抽签。');
    } else alert('今天还没有抽签记录。');
    refreshMainView();
  });
  newResetAll.addEventListener('click', () => {
    if (confirm('确定要清除所有数据并重新开始吗？')) {
      localStorage.clear();
      location.reload();
    }
  });
}

function updateDebugDateDisplay() {
  const el = document.getElementById('debugCurrentDate');
  if (el) el.textContent = '📅 虚拟日期：' + getToday();
}

function refreshMainView() {
  const data = loadData();
  if (data && currentView === 'viewMain') renderMainView(data);
  else if (data) { switchView('viewMain'); renderMainView(data); }
}

// ---------- 视图切换 ----------
function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId)?.classList.add('active');
  currentView = viewId;
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewId);
  });

  // 动态推荐抽签次数
  if (viewId === 'viewSetup') {
    const freqInput = document.getElementById('currentFreq');
    const maxDrawsInput = document.getElementById('maxDraws');
    const updateDefaults = () => {
      const val = parseInt(freqInput.value) || 10;
      if (maxDrawsInput) maxDrawsInput.value = Math.min(50, Math.max(4, Math.round(val * 1.5)));
    };
    freqInput?.addEventListener('input', updateDefaults);
    updateDefaults();
  }
}

function setupBottomNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.currentTarget.dataset.view;
      switchView(view);
      if (view === 'viewMain') {
        const data = loadData();
        if (data) renderMainView(data);
      } else if (view === 'viewDashboard') renderDashboard();
      else if (view === 'viewSubstitutes') renderSubstitutesView();
    });
  });
}

// ---------- 设置向导提交 ----------
function handleSetupSubmit(e) {
  e.preventDefault();
  const habitName = document.getElementById('habitName').value.trim();
  const currentFreq = parseInt(document.getElementById('currentFreq').value);
  const freqUnit = document.getElementById('freqUnit').value;
  const targetFreq = parseInt(document.getElementById('targetFreq').value);
  const targetFreqUnit = document.getElementById('targetFreqUnit').value;
  const targetDays = parseInt(document.getElementById('targetDays').value);
  const drawInterval = parseInt(document.getElementById('drawInterval').value) || 15;
  const maxDraws = parseInt(document.getElementById('maxDraws').value) || 10;

  if (!habitName || isNaN(currentFreq) || isNaN(targetFreq) || isNaN(targetDays)) {
    alert('请完整填写所有字段');
    return;
  }

  const dailyCurrent = normalizeDailyFreq(currentFreq, freqUnit);
  const dailyTarget = normalizeDailyFreq(targetFreq, targetFreqUnit);
  const P0 = freqToProb(dailyCurrent);
  const Ptarget = Math.min(0.8, dailyTarget / (dailyCurrent || 1));
  const totalDays = targetDays;
  const k = calcDecayRate(totalDays);

  const settings = {
    habitName,
    currentFrequency: dailyCurrent,
    targetFrequency: dailyTarget,
    targetDays,
    startDate: getToday(),
    probCurve: { P0, Ptarget, k, totalDays },
    drawIntervalMinutes: drawInterval,
    maxDrawsPerDay: maxDraws,
    suggestionShown: true,
  };

  let data = loadData() || {};
  data.settings = settings;
  if (!data.substitutes) data.substitutes = { items: createDefaultSubstitutePool(), totalWeight: 100 };
  data.dailyLogs = data.dailyLogs || {};
  data.achievements = data.achievements || {};
  data.companion = data.companion || {
    experience: 0, level: 1, levelThresholds: [0, 51, 151, 301, 501],
    stage: 'seed', dialogueHistory: [],
  };
  saveData(data);

  switchView('viewSubstitutes');
  renderSubstitutesView();
}

// ---------- 替代行为视图 ----------
function renderSubstitutesView() {
  const data = loadData();
  if (!data?.substitutes) return;
  const container = document.getElementById('weightSliders');
  if (!container) return;

  container.innerHTML = data.substitutes.items.map(item => `
    <div class="slider-item">
      <label>${item.name}</label>
      <input type="range" min="0" max="100" value="${item.weight}" data-id="${item.id}" class="weight-slider" />
      <span class="weight-value">${item.weight.toFixed(1)}%</span>
    </div>
  `).join('');

  container.addEventListener('input', (e) => {
    if (!e.target.classList.contains('weight-slider')) return;
    const span = e.target.parentElement.querySelector('.weight-value');
    if (span) span.textContent = parseFloat(e.target.value).toFixed(1) + '%';
  });
  container.addEventListener('change', (e) => {
    if (!e.target.classList.contains('weight-slider')) return;
    const id = e.target.dataset.id;
    const newWeight = parseFloat(e.target.value);
    const currentData = loadData();
    currentData.substitutes.items = redistributeWeights(currentData.substitutes.items, id, newWeight);
    saveData(currentData);
    const allSliders = container.querySelectorAll('.weight-slider');
    allSliders.forEach(s => {
      const item = currentData.substitutes.items.find(i => i.id === s.dataset.id);
      if (item) {
        s.value = item.weight;
        const span = s.parentElement.querySelector('.weight-value');
        if (span) span.textContent = item.weight.toFixed(1) + '%';
      }
    });
  });
}

function handleAddCustomSub() {
  const input = document.getElementById('customSub');
  const name = input?.value.trim();
  if (!name) return;
  const data = loadData();
  const newItem = createCustomSubstitute(name);
  newItem.weight = 0;
  data.substitutes.items.push(newItem);
  const avg = 100 / data.substitutes.items.length;
  data.substitutes.items.forEach(item => item.weight = avg);
  saveData(data);
  renderSubstitutesView();
  input.value = '';
}

function handleConfirmSubs() {
  const data = loadData();
  if (!data) return;
  const total = data.substitutes.items.reduce((s, i) => s + i.weight, 0);
  if (Math.abs(total - 100) > 0.01) return alert('权重之和必须为100%');
  saveData(data);
  switchView('viewMain');
  renderMainView(data);
}

// ---------- 主视图渲染 ----------
function renderMainView(data) {
  if (!data?.settings) return;
  const { settings } = data;
  const [sy, sm, sd] = settings.startDate.split('-').map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  const [ty, tm, td] = getToday().split('-').map(Number);
  const today = new Date(ty, tm - 1, td);
  let dayNumber = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
  if (dayNumber > settings.targetDays) dayNumber = settings.targetDays;

  document.getElementById('dayCounter').textContent = `Day ${dayNumber} / ${settings.targetDays}`;
  document.getElementById('progressFill').style.width = `${(dayNumber / settings.targetDays) * 100}%`;
  const progressRate = ((dayNumber / settings.targetDays) * 100).toFixed(1);
  document.getElementById('successRate').textContent = `完成度: ${progressRate}%`;

  const count = getTodayDrawCount(data);
  const max = settings.maxDrawsPerDay || 10;
  const counterEl = document.getElementById('drawCountDisplay');
  // 简要显示，具体发生次数上限由 interaction 实时更新
  if (counterEl) counterEl.textContent = `今日已决策 ${count}/${max} 次`;

  if (data.customCurve) {
    renderCustomCurveChart('probChart', data.customCurve, dayNumber, settings.currentFrequency);
  } else {
    const { P0, Ptarget, k, totalDays } = settings.probCurve;
    renderProbabilityChart('probChart', {
      P0, Ptarget, totalDays, k,
      currentDay: dayNumber,
      currentFreq: settings.currentFrequency
    });
  }

  initInteraction();
  updateCompanion(data);
}

// ---------- 主题 ----------
function setupThemeToggle() {
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const html = document.documentElement;
    html.classList.toggle('dark');
    saveConfig({ theme: html.classList.contains('dark') ? 'dark' : 'light' });
  });
}

// ---------- 设置与数据管理 ----------
function showSettingsModal() {
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');
  const data = loadData();
  const interval = data?.settings?.drawIntervalMinutes || 15;
  const maxDraws = data?.settings?.maxDrawsPerDay || 10;

  content.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <h3 style="margin:0;">数据管理</h3>
      <button id="closeSettingsModal" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">✕</button>
    </div>
    <div class="form-group" style="margin-bottom:12px;">
      <label>抽签间隔（分钟）</label>
      <input type="number" id="intervalInput" value="${interval}" min="5" max="120" step="5" />
    </div>
    <div class="form-group" style="margin-bottom:12px;">
      <label>每日最大抽签次数</label>
      <input type="number" id="maxDrawsInput" value="${maxDraws}" min="1" max="50" />
    </div>
    <button id="saveConfigBtn" class="btn primary" style="width:100%; margin-bottom:12px;">保存抽签配置</button>
    <hr style="margin:12px 0" />
    <button id="exportBtn" class="btn secondary">导出数据</button>
    <button id="importBtn" class="btn secondary">导入数据</button>
    <input type="file" id="importFile" accept=".json" hidden />
  `;
  overlay.hidden = false;

  document.getElementById('closeSettingsModal').addEventListener('click', () => overlay.hidden = true);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.hidden = true; };

  document.getElementById('saveConfigBtn').addEventListener('click', () => {
    const intervalVal = parseInt(document.getElementById('intervalInput').value);
    const maxVal = parseInt(document.getElementById('maxDrawsInput').value);
    if (isNaN(intervalVal) || isNaN(maxVal) || intervalVal < 1 || maxVal < 1) {
      return alert('请输入有效数值');
    }
    const currentData = loadData();
    currentData.settings.drawIntervalMinutes = intervalVal;
    currentData.settings.maxDrawsPerDay = maxVal;
    saveData(currentData);
    overlay.hidden = true;
    refreshMainView();
  });

  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', importData);
}

function exportData() {
  const data = loadData();
  if (!data) return alert('无数据');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `habit-backup-${getToday()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      saveData(data);
      alert('导入成功，刷新中');
      location.reload();
    } catch { alert('文件格式错误'); }
  };
  reader.readAsText(file);
}

// ---------- 好感度帮助弹窗 ----------
function showExpHelp() {
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');

  content.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <h3 style="margin:0;">🌱 好感度系统说明</h3>
      <button id="closeHelpModal" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">✕</button>
    </div>
    <div style="line-height:1.8;">
      <p><strong>基础经验：</strong></p>
      <ul>
        <li>🎉 每次成功避免 <strong>+10 经验</strong></li>
        <li>🍃 每次允许发生 <strong>+3 经验</strong></li>
        <li>🔥 连续成功天数 × 2 额外加成</li>
      </ul>
      <p><strong>植物阶段：</strong></p>
      <ul>
        <li>🌱 种子 (0-50)</li>
        <li>🌿 发芽 (51-150)</li>
        <li>🪴 幼苗 (151-300)</li>
        <li>🌸 开花 (301-500)</li>
        <li>🍎 结果 (500+)</li>
      </ul>
      <p style="font-size:0.9rem; color:var(--color-text-muted);">每天可多次决策，达到动态发生次数上限后将自动避免。</p>
    </div>
  `;
  overlay.hidden = false;

  document.getElementById('closeHelpModal').addEventListener('click', () => overlay.hidden = true);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.hidden = true; };
}
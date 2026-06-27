// interaction.js —— 每日多次抽签、心情记录（含最大发生次数限制）

import {
  loadData, saveData, getToday,
  canDrawNow, getTodayDrawCount,
  getTodayBaseProbability, getNextDrawProbability,
  canOccurNow, getTodayOccurrenceCount
} from './utils.js';
import { rouletteWheelSelect } from './weight.js';
import { updateCompanion } from './companion.js';

export function initInteraction() {
  console.log('[interaction] 绑定事件');

  const drawBtn = document.getElementById('drawBtn');
  if (drawBtn) {
    const newDrawBtn = drawBtn.cloneNode(true);
    drawBtn.parentNode.replaceChild(newDrawBtn, drawBtn);
    newDrawBtn.addEventListener('click', handleDraw);
  }

  updateDrawStatus();
  setInterval(updateDrawStatus, 1000);
}

function updateDrawStatus() {
  const data = loadData();
  if (!data?.settings) return;
  const canDraw = canDrawNow(data);
  const el = document.getElementById('drawCountDisplay');
  if (!el) return;

  const count = getTodayDrawCount(data);
  const max = data.settings.maxDrawsPerDay;
  const occurCount = getTodayOccurrenceCount(data);
  const occurMax = data.settings.maxOccurrencesPerDay ?? 3;

  if (canDraw.allowed) {
    el.textContent = `今日已决策 ${count}/${max} 次 · 已发生 ${occurCount}/${occurMax} 次 · 可抽签`;
  } else {
    el.textContent = canDraw.reason;
  }
}

async function handleDraw() {
  const data = loadData();
  if (!data?.settings) return alert('请先完成设置');

  const canDraw = canDrawNow(data);
  if (!canDraw.allowed) {
    alert(canDraw.reason);
    return;
  }

  const today = getToday();
  const startDate = parseLocal(data.settings.startDate);
  const current = parseLocal(today);
  let dayNumber = Math.floor((current - startDate) / (1000 * 60 * 60 * 24)) + 1;
  if (dayNumber > data.settings.targetDays) {
    alert('恭喜！已完成目标天数！');
    return;
  }

  // ---------- 检查是否已达到每日最大发生次数 ----------
  if (!canOccurNow(data)) {
    const decision = 'avoid';
    const logEntry = {
      dayNumber,
      probability: 0,
      randomValue: null,
      decision,
      substituteChosen: null,
      substituteName: null,
      mood: null,
      note: '',
      timestamp: new Date().toISOString(),
      forcedLimit: true,
    };

    if (!data.dailyLogs[today]) data.dailyLogs[today] = [];
    data.dailyLogs[today].push(logEntry);

    let subName = null;
    if (data.substitutes?.items?.length) {
      const chosen = rouletteWheelSelect(data.substitutes.items);
      subName = chosen ? chosen.name : null;
      logEntry.substituteName = subName;
      logEntry.substituteChosen = chosen ? chosen.id : null;
    }
    saveData(data);

    updateCompanion(data);
    displayResult(decision, subName, today);
    updateDrawStatus();
    return;
  }

  // ---------- 正常抽签 ----------
  const P_base = getTodayBaseProbability(data.settings, dayNumber);
  const todayLogs = data.dailyLogs[today] || [];
  const P_actual = getNextDrawProbability(P_base, todayLogs);

  await playSlotAnimation();

  const rand = Math.random();
  const decision = rand < P_actual ? 'do_habit' : 'avoid';

  let substituteId = null, substituteName = null;
  if (decision === 'avoid' && data.substitutes?.items?.length) {
    const chosen = rouletteWheelSelect(data.substitutes.items);
    if (chosen) {
      substituteId = chosen.id;
      substituteName = chosen.name;
    }
  }

  const logEntry = {
    dayNumber,
    probability: P_actual,
    randomValue: rand,
    decision,
    substituteChosen: substituteId,
    substituteName,
    mood: null,
    note: '',
    timestamp: new Date().toISOString(),
  };

  if (!data.dailyLogs[today]) data.dailyLogs[today] = [];
  data.dailyLogs[today].push(logEntry);
  saveData(data);

  updateCompanion(data);
  displayResult(decision, substituteName, today);
  updateDrawStatus();
}

function parseLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0);
}

function playSlotAnimation() {
  const animDiv = document.getElementById('drawAnimation');
  if (!animDiv) return;
  animDiv.hidden = false;
  const symbols = ['🍎', '🍋', '🍇', '🔔', '⭐', '7️⃣'];
  let cycles = 0;
  return new Promise(resolve => {
    const interval = setInterval(() => {
      animDiv.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      cycles++;
      if (cycles > 12) {
        clearInterval(interval);
        animDiv.hidden = true;
        resolve();
      }
    }, 150);
  });
}

function displayResult(decision, subName, dateKey) {
  const area = document.getElementById('resultArea');
  const text = document.getElementById('resultText');
  const subDisplay = document.getElementById('substituteDisplay');
  if (!area) return;
  area.hidden = false;

  if (decision === 'do_habit') {
    text.innerHTML = `
      <div style="font-size:3rem; margin-bottom:0.3rem;">🍃</div>
      <div>今天可以接受</div>
      <div style="font-size:0.8rem; color:var(--color-text-muted);">下次加油~</div>
    `;
    subDisplay.innerHTML = '';
    subDisplay.hidden = true;
  } else {
    text.innerHTML = `
      <div style="font-size:3rem; margin-bottom:0.3rem;">🎉</div>
      <div>成功避免！</div>
    `;
    subDisplay.innerHTML = subName
      ? `<div style="font-weight:600; color:var(--color-primary);">✨ ${subName}</div>`
      : '';
    subDisplay.hidden = !subName;
  }

  appendMoodBar(dateKey);
}

function appendMoodBar(dateKey) {
  const area = document.getElementById('resultArea');
  const oldBar = document.getElementById('moodQuickBar');
  if (oldBar) oldBar.remove();

  const bar = document.createElement('div');
  bar.id = 'moodQuickBar';
  bar.style.cssText = 'margin-top:0.8rem; display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap; justify-content:center;';
  bar.innerHTML = `
    <span style="font-size:0.8rem; color:var(--color-text-muted);">本次心情：</span>
    ${['😊','😐','😢','😤','😴'].map(e => `<span class="mood-quick-option" data-mood="${e}" style="font-size:1.5rem; cursor:pointer; opacity:0.6; transition:0.2s;">${e}</span>`).join('')}
    <input id="quickMoodNote" maxlength="50" placeholder="一句话（选填）" style="width:120px; padding:0.25rem 0.5rem; font-size:0.8rem;" />
  `;
  area.appendChild(bar);

  const options = bar.querySelectorAll('.mood-quick-option');
  options.forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      options.forEach(o => o.style.opacity = '0.6');
      opt.style.opacity = '1';
      saveQuickMood(dateKey, opt.dataset.mood);
      opt.style.transform = 'scale(1.3)';
      setTimeout(() => opt.style.transform = '', 150);
    });
  });

  const noteInput = document.getElementById('quickMoodNote');
  if (noteInput) {
    noteInput.addEventListener('blur', () => {
      const note = noteInput.value.trim();
      const data = loadData();
      const logs = data.dailyLogs[dateKey];
      if (logs && logs.length > 0) {
        logs[logs.length - 1].note = note;
        saveData(data);
      }
    });
  }
}

function saveQuickMood(dateKey, mood) {
  const data = loadData();
  const logs = data.dailyLogs[dateKey];
  if (logs && logs.length > 0) {
    logs[logs.length - 1].mood = mood;
    saveData(data);
  }
}
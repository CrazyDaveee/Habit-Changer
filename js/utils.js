// utils.js —— 通用工具函数（含每日最大发生次数限制）

// ==================== 本地日期工具 ====================
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0);
}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ==================== 数据读写 ====================
export function loadData() {
  const raw = localStorage.getItem('habitChangerData');
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data.dailyLogs) {
      for (const [date, val] of Object.entries(data.dailyLogs)) {
        if (!Array.isArray(val)) data.dailyLogs[date] = [val];
      }
    }
    if (data.settings) {
      data.settings.drawIntervalMinutes = data.settings.drawIntervalMinutes ?? 15;
      data.settings.maxDrawsPerDay = data.settings.maxDrawsPerDay ?? calcDefaultMaxDraws(data.settings.currentFrequency);
      // 新增：确保 maxOccurrencesPerDay 有默认值
      data.settings.maxOccurrencesPerDay = data.settings.maxOccurrencesPerDay ??
        calcDefaultMaxOccurrences(data.settings.currentFrequency, data.settings.targetFrequency);
    }
    return data;
  } catch (e) { return null; }
}

export function saveData(data) {
  localStorage.setItem('habitChangerData', JSON.stringify(data));
}

export function loadConfig() {
  const raw = localStorage.getItem('habitChangerConfig');
  if (!raw) return { theme: 'auto' };
  try { return JSON.parse(raw); } catch { return { theme: 'auto' }; }
}

export function saveConfig(config) {
  localStorage.setItem('habitChangerConfig', JSON.stringify(config));
}

// ==================== 调试模式 ====================
export function isDebug() {
  const params = new URLSearchParams(window.location.search);
  return params.get('debug') === 'true';
}

export function getToday() {
  if (isDebug()) {
    const stored = localStorage.getItem('debugVirtualDate');
    if (stored) return stored;
    const real = formatLocalDate(new Date());
    localStorage.setItem('debugVirtualDate', real);
    return real;
  }
  return formatLocalDate(new Date());
}

export function setVirtualDate(dateStr) {
  if (!isDebug()) return;
  localStorage.setItem('debugVirtualDate', dateStr);
}

export function advanceVirtualDate(days) {
  if (!isDebug()) return getToday();
  const current = parseLocalDate(getToday());
  current.setDate(current.getDate() + days);
  const newDate = formatLocalDate(current);
  setVirtualDate(newDate);
  return newDate;
}

// ==================== 日内抽签辅助 ====================
export function getTodayDrawCount(data) {
  const today = getToday();
  return (data.dailyLogs[today] || []).length;
}

export function getLastDrawTime(data) {
  const today = getToday();
  const logs = data.dailyLogs[today];
  if (!logs || logs.length === 0) return null;
  const last = logs[logs.length - 1];
  return last.timestamp ? new Date(last.timestamp) : null;
}

export function canDrawNow(data) {
  const today = getToday();
  const draws = (data.dailyLogs[today] || []).length;
  const max = data.settings.maxDrawsPerDay || 10;
  if (draws >= max) return { allowed: false, reason: `今日抽签次数已达上限（${max}次）` };

  const interval = data.settings.drawIntervalMinutes || 15;
  const lastTime = getLastDrawTime(data);
  if (lastTime) {
    const now = isDebug() ? new Date(getToday() + 'T' + new Date().toTimeString().slice(0,8)) : new Date();
    const diffMin = (now - lastTime) / 60000;
    if (diffMin < interval) {
      const remain = Math.ceil(interval - diffMin);
      return { allowed: false, reason: `请等待 ${remain} 分钟后再抽签（间隔 ${interval} 分钟）` };
    }
  }
  return { allowed: true };
}

function calcDefaultMaxDraws(freq) {
  return Math.max(4, Math.round(freq * 2));
}

/** 计算每日最大发生次数的默认值（取当前与目标之间的中间值上取整） */
function calcDefaultMaxOccurrences(currentFreq, targetFreq) {
  if (!currentFreq) return 3;
  const mid = Math.ceil((currentFreq + targetFreq) / 2);
  return Math.min(currentFreq, Math.max(targetFreq, mid));
}

/** 获取今日已发生次数（决策为 do_habit） */
export function getTodayOccurrenceCount(data) {
  const today = getToday();
  const logs = data.dailyLogs[today] || [];
  return logs.filter(l => l.decision === 'do_habit').length;
}

/** 检查是否还可以发生（未达到每日最大发生次数） */
export function canOccurNow(data) {
  const count = getTodayOccurrenceCount(data);
  const max = data.settings.maxOccurrencesPerDay ?? 3;
  return count < max;
}

// ==================== 概率与频率的映射 ====================
export function freqToProb(freqPerDay) {
  if (freqPerDay <= 0) return 0;
  return Math.min(0.95, 1 - 1 / (freqPerDay + 1));
}

// ==================== 日内动态概率 ====================
export function getTodayBaseProbability(settings, dayNumber) {
  const { P0, Ptarget, k } = settings.probCurve;
  return P0 * Math.exp(-k * dayNumber) + Ptarget;
}

export function getNextDrawProbability(P_base, todayLogs) {
  if (!todayLogs || todayLogs.length === 0) return P_base;
  const lastDecision = todayLogs[todayLogs.length - 1].decision;
  const factor = lastDecision === 'avoid' ? 0.85 : 0.95;
  const lastProb = todayLogs[todayLogs.length - 1].probability || P_base;
  let nextProb = lastProb * factor;
  const minProb = P_base * 0.3;
  if (nextProb < minProb) nextProb = minProb;
  return nextProb;
}

// ==================== 业务工具 ====================
export function normalizeDailyFreq(freq, unit) {
  if (unit === 'week') return freq / 7;
  return freq;
}

export function getSuggestions(currentFreq, targetFreq, targetDays, currentUnit, targetUnit) {
  const dailyCurrent = normalizeDailyFreq(currentFreq, currentUnit);
  const dailyTarget = normalizeDailyFreq(targetFreq, targetUnit);
  const suggestions = [];
  if (targetDays < 21) suggestions.push('研究表明习惯改变至少需要18-21天，过于激进易失败，建议延长。');
  if (dailyCurrent > 0) {
    const reductionRatio = (dailyCurrent - dailyTarget) / dailyCurrent;
    if (reductionRatio > 0.8) suggestions.push('降幅过大（>80%），建议拆分为多个阶段性目标。');
  }
  const freqDiff = dailyCurrent - dailyTarget;
  const recommendedDays = Math.max(21, Math.round(freqDiff * 10));
  if (targetDays < recommendedDays) suggestions.push(`根据降幅建议至少 ${recommendedDays} 天，当前天数可能偏短。`);
  return suggestions.map(s => `· ${s}`);
}
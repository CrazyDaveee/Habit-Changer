// companion.js —— 成就系统 & 虚拟植物好感度（无破戒惩罚）

import { loadData, saveData } from './utils.js';

export function getCurrentStreak(data) {
  const allDates = Object.keys(data.dailyLogs || {}).sort();
  let streak = 0;
  for (let i = allDates.length - 1; i >= 0; i--) {
    const logs = data.dailyLogs[allDates[i]];
    if (!logs || logs.length === 0) continue;
    const hasHabit = logs.some(l => l.decision === 'do_habit');
    const hasAvoid = logs.some(l => l.decision === 'avoid');
    if (hasHabit) break;
    if (hasAvoid) streak++;
  }
  return streak;
}

export function checkAchievements(data) {
  if (!data.achievements) data.achievements = {};
  const allDates = Object.keys(data.dailyLogs || {}).sort();
  const today = new Date().toISOString().split('T')[0];

  const streak = getCurrentStreak(data);

  if (streak >= 3 && !data.achievements.consecutive3?.unlocked) {
    data.achievements.consecutive3 = { unlocked: true, date: today };
    showAchievementToast('🥉 连续3天成功！');
  }
  if (streak >= 7 && !data.achievements.consecutive7?.unlocked) {
    data.achievements.consecutive7 = { unlocked: true, date: today };
    showAchievementToast('🥈 连续7天成功！');
  }

  const anySubUsed = Object.values(data.dailyLogs || {}).some(logs =>
    logs.some(l => l.substituteChosen)
  );
  if (anySubUsed && !data.achievements.firstSubstitute?.unlocked) {
    data.achievements.firstSubstitute = { unlocked: true, date: today };
    showAchievementToast('🌟 首次使用替代行为！');
  }

  // 不屈之心成就因破戒系统移除不再触发，但保留代码结构
  saveData(data);
}

function showAchievementToast(msg) {
  const toast = document.getElementById('achievementToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.hidden = false;
  setTimeout(() => toast.hidden = true, 3000);
}

export function updateCompanion(data) {
  if (!data.companion) {
    data.companion = {
      experience: 0, level: 1, levelThresholds: [0, 51, 151, 301, 501],
      stage: 'seed', dialogueHistory: [],
    };
  }
  const comp = data.companion;
  comp.experience = recalculateExperience(data);
  updatePlantStage(comp);
  updateDialogue(data, comp);
  saveData(data);
  renderPlantUI(comp);
}

function recalculateExperience(data) {
  let total = 0;
  const allDates = Object.keys(data.dailyLogs || {}).sort();
  let currentStreak = 0;

  allDates.forEach(date => {
    const logs = data.dailyLogs[date];
    if (!logs || logs.length === 0) return;
    const avoidCount = logs.filter(l => l.decision === 'avoid').length;
    const habitCount = logs.filter(l => l.decision === 'do_habit').length;

    total += avoidCount * 10 + habitCount * 3;

    if (habitCount === 0 && avoidCount > 0) {
      currentStreak++;
      total += currentStreak * 2;
    } else if (habitCount > 0) {
      currentStreak = 0;
    }
  });

  return Math.max(0, total);
}

function updatePlantStage(comp) {
  const thresholds = comp.levelThresholds;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (comp.experience >= thresholds[i]) {
      comp.level = i + 1;
      comp.stage = ['seed', 'sprout', 'seedling', 'bloom', 'fruit'][i];
      return;
    }
  }
}

function updateDialogue(data, comp) {
  const stageTexts = {
    seed: ['我是一颗小种子，需要你的坚持来发芽~', '每天的努力都会让我长大一点点。'],
    sprout: ['嫩芽破土啦！加油，我可以感受到阳光。', '坚持到今天真不容易！'],
    seedling: ['我已经是一株小苗了，继续保护我哟~', '看着你一天天变好，我好开心。'],
    bloom: ['开花啦！你的努力绽放了美丽。', '和你一起成长是最幸福的事。'],
    fruit: ['结果了！你已经养成了新习惯，棒极了！', '我们做到了，谢谢你。'],
  };

  const streak = getCurrentStreak(data);
  let dialogue = '';
  if (streak >= 7) {
    dialogue = `已经${streak}天没碰它了呢，你好厉害！`;
  } else {
    const arr = stageTexts[comp.stage] || stageTexts.seed;
    dialogue = arr[Math.floor(Math.random() * arr.length)];
  }

  comp.dialogueHistory = comp.dialogueHistory || [];
  comp.dialogueHistory.push({ date: new Date().toISOString(), text: dialogue });
  comp.currentDialogue = dialogue;
}

function renderPlantUI(comp) {
  const plantVisual = document.getElementById('plantVisual');
  const plantDialogue = document.getElementById('plantDialogue');
  const expValue = document.getElementById('expValue');

  const stageEmoji = { seed: '🌱', sprout: '🌿', seedling: '🪴', bloom: '🌸', fruit: '🍎' };

  if (plantVisual) plantVisual.textContent = stageEmoji[comp.stage] || '🌱';
  if (plantDialogue && comp.currentDialogue) plantDialogue.textContent = comp.currentDialogue;
  if (expValue) expValue.textContent = comp.experience;
}
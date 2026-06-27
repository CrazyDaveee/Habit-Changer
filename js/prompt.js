// prompt.js —— AI 曲线生成 Prompt 与 JSON 解析（支持从表单读取）

import { loadData, saveData, normalizeDailyFreq } from './utils.js';

/**
 * 生成 AI 提示词
 * 优先使用已保存的 settings，否则从设置向导表单中读取
 */
export function generatePrompt() {
  // 尝试从 localStorage 获取已有设置
  const data = loadData();
  let freqCurrent, freqTarget, targetDays, P0, Ptarget;

  if (data?.settings) {
    // 已有完整设置，直接使用
    const s = data.settings;
    freqCurrent = s.currentFrequency;
    freqTarget = s.targetFrequency;
    targetDays = s.targetDays;
    P0 = s.probCurve.P0;
    Ptarget = s.probCurve.Ptarget;
  } else {
    // 从表单读取（用户正在设置向导中）
    const currentFreq = parseInt(document.getElementById('currentFreq')?.value);
    const freqUnit = document.getElementById('freqUnit')?.value || 'day';
    const targetFreq = parseInt(document.getElementById('targetFreq')?.value);
    const targetFreqUnit = document.getElementById('targetFreqUnit')?.value || 'day';
    const days = parseInt(document.getElementById('targetDays')?.value);

    if (isNaN(currentFreq) || isNaN(targetFreq) || isNaN(days)) {
      return alert('请先在表单中填写当前频率、目标频率和目标天数。');
    }

    freqCurrent = normalizeDailyFreq(currentFreq, freqUnit);
    freqTarget = normalizeDailyFreq(targetFreq, targetFreqUnit);
    targetDays = days;

    // 根据用户输入近似计算 P0 和 Ptarget（与设置提交时算法一致）
    P0 = Math.min(0.95, 1 - 1 / (freqCurrent + 1));
    Ptarget = Math.min(0.8, freqTarget / (freqCurrent || 1));
  }

  const prompt = `
请根据以下参数生成一条习惯形成概率曲线（负指数衰减模型）：
- 当前习惯频率：${freqCurrent} 次/天
- 目标频率：${freqTarget} 次/天
- 总天数：${targetDays}
- 初始概率 P0: ${P0}
- 目标概率 Ptarget: ${Ptarget}

请输出一个 JSON 对象，格式为：
{
  "days": [0, 1, 2, ... ${targetDays}],
  "probs": [概率值数组，范围0-1]
}
要求概率值精确到小数点后4位，并按天数递增排列。
`;

  // 显示在模态框中
  const modalOverlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  modalContent.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <h3 style="margin:0;">AI 个性化曲线生成</h3>
      <button id="closeAIModal" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">✕</button>
    </div>
    <p>将以下提示词复制到 ChatGPT / Claude 等 AI 工具，获取 JSON 数据后粘贴回下方输入框。</p>
    <textarea readonly rows="12" id="promptText" style="width:100%">${prompt}</textarea>
    <button id="copyPromptBtn" class="btn secondary" style="margin-top:8px">📋 复制 Prompt</button>
    <hr style="margin: 16px 0" />
    <label>粘贴 AI 返回的 JSON：</label>
    <textarea id="pasteJson" rows="6" placeholder='{"days":[...],"probs":[...]}'></textarea>
    <button id="applyJsonBtn" class="btn primary" style="margin-top:8px">✅ 应用自定义曲线</button>
  `;
  modalOverlay.hidden = false;

  document.getElementById('closeAIModal').addEventListener('click', () => {
    modalOverlay.hidden = true;
  });
  modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) modalOverlay.hidden = true;
  };

  document.getElementById('copyPromptBtn').addEventListener('click', () => {
    const textarea = document.getElementById('promptText');
    textarea.select();
    document.execCommand('copy');
    alert('Prompt 已复制到剪贴板');
  });

  document.getElementById('applyJsonBtn').addEventListener('click', () => {
    const jsonStr = document.getElementById('pasteJson').value.trim();
    applyCustomCurve(jsonStr);
  });
}

/**
 * 解析用户粘贴的 JSON 并覆盖概率曲线参数
 */
function applyCustomCurve(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.days || !parsed.probs || parsed.days.length !== parsed.probs.length) {
      throw new Error('JSON 格式不正确，需要包含 days 和 probs 数组且长度相等。');
    }

    const data = loadData();
    if (!data?.settings) {
      // 如果还没有 settings，提示用户先保存基本设置
      alert('请先完成基本设置（提交表单生成曲线），然后再应用自定义数据。');
      return;
    }

    data.customCurve = {
      days: parsed.days,
      probs: parsed.probs,
    };

    data.settings.probCurve.custom = true;
    saveData(data);
    alert('自定义曲线已应用！刷新主界面即可查看。');
    document.getElementById('modalOverlay').hidden = true;
  } catch (err) {
    alert('解析失败：' + err.message);
  }
}
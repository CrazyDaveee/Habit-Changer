// prompt.js —— AI 曲线生成 Prompt 与 JSON 解析

import { loadData, saveData, freqToProb } from './utils.js';

/**
 * 生成 AI 提示词
 */
export function generatePrompt() {
  const data = loadData();
  if (!data?.settings) return alert('请先完成初始设置');

  const s = data.settings;
  const prompt = `
请根据以下参数生成一条习惯形成概率曲线（负指数衰减模型）：
- 当前习惯频率：${s.currentFrequency} 次/天
- 目标频率：${s.targetFrequency} 次/天
- 总天数：${s.targetDays}
- 初始概率 P0: ${s.probCurve.P0}
- 目标概率 Ptarget: ${s.probCurve.Ptarget}

请输出一个 JSON 对象，格式为：
{
  "days": [0, 1, 2, ... ${s.targetDays}],
  "probs": [概率值数组，范围0-1]
}
要求概率值精确到小数点后4位，并按天数递增排列。
`;

  // 显示在模态框中
  const modalOverlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  modalContent.innerHTML = `
    <h3>AI 个性化曲线生成</h3>
    <p>将以下提示词复制到 ChatGPT / Claude 等 AI 工具，获取 JSON 数据后粘贴回下方输入框。</p>
    <textarea readonly rows="12" id="promptText" style="width:100%">${prompt}</textarea>
    <button id="copyPromptBtn" class="btn secondary" style="margin-top:8px">📋 复制 Prompt</button>
    <hr style="margin: 16px 0" />
    <label>粘贴 AI 返回的 JSON：</label>
    <textarea id="pasteJson" rows="6" placeholder='{"days":[...],"probs":[...]}'></textarea>
    <button id="applyJsonBtn" class="btn primary" style="margin-top:8px">✅ 应用自定义曲线</button>
  `;
  modalOverlay.hidden = false;

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
    if (!data?.settings) return;

    // 保留原来的 P0、Ptarget，但更新天数和实际曲线点存储
    // 同时重新拟合 k 值（可选），这里简化：使用 AI 提供的 probs 直接渲染，但原始引擎仍可用。
    // 我们存储自定义曲线点，在渲染时优先使用自定义数据
    data.customCurve = {
      days: parsed.days,
      probs: parsed.probs,
    };

    // 可选：基于第一个点和最后一个点重新估算 P0 和 Ptarget，以便引擎计算今日概率
    const firstProb = parsed.probs[0];
    const lastProb = parsed.probs[parsed.probs.length - 1];
    // 简单假设仍然是负指数衰减，重新计算 k
    // 但不强制，避免混乱。我们保留原 probCurve 但标记有自定义曲线
    data.settings.probCurve.custom = true;

    saveData(data);
    alert('自定义曲线已应用！刷新主界面即可查看。');
    document.getElementById('modalOverlay').hidden = true;
  } catch (err) {
    alert('解析失败：' + err.message);
  }
}
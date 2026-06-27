// weight.js —— 替代行为池与动态权重管理

/**
 * 预设替代行为分类与默认项
 */
export const presetSubstitutes = [
  { name: '深蹲10次', category: '身体类' },
  { name: '拉伸一分钟', category: '身体类' },
  { name: '嚼口香糖', category: '感官类' },
  { name: '闻薄荷精油', category: '感官类' },
  { name: '背5个单词', category: '认知类' },
  { name: '做一道算术题', category: '认知类' },
  { name: '看一张风景图', category: '奖赏类' },
  { name: '吃一块黑巧克力', category: '奖赏类' },
];

/**
 * 初始化替代行为池（当用户第一次进入设置时）
 * @returns {Array} items
 */
export function createDefaultSubstitutePool() {
  return presetSubstitutes.map((item, index) => ({
    id: `sub_${Date.now()}_${index}`,
    name: item.name,
    category: item.category,
    weight: 100 / presetSubstitutes.length, // 初始均分
    custom: false,
  }));
}

/**
 * 计算所有权重总和
 */
export function calcTotalWeight(items) {
  return items.reduce((sum, item) => sum + item.weight, 0);
}

/**
 * 等比例再分配：当某个行为权重变为 newWeight 时，
 * 其余行为按原比例分配剩余权重 (100 - newWeight)
 * 确保总和严格等于 100
 */
export function redistributeWeights(items, changedId, newWeight) {
  const clampedWeight = Math.min(100, Math.max(0, newWeight));
  const remaining = 100 - clampedWeight;

  const changedIndex = items.findIndex((item) => item.id === changedId);
  if (changedIndex === -1) return items;

  // 除被改变项外的其他项
  const others = items.filter((item) => item.id !== changedId);
  const oldSumOthers = others.reduce((sum, item) => sum + item.weight, 0);

  // 若旧的总和为0，则平均分配剩余权重
  if (oldSumOthers <= 0) {
    const avg = remaining / others.length;
    others.forEach((item) => (item.weight = avg));
  } else {
    // 按原比例分配
    others.forEach((item) => {
      item.weight = (remaining * item.weight) / oldSumOthers;
    });
  }

  // 更新被改变项权重
  items[changedIndex].weight = clampedWeight;

  // 小数舍入调整，确保总和精确为100（修正浮点误差）
  const total = calcTotalWeight(items);
  if (total !== 100 && items.length > 0) {
    // 将误差加到最后一个其他项（或第一项）
    const diff = 100 - total;
    const lastOther = others[others.length - 1];
    if (lastOther) {
      lastOther.weight += diff;
    } else {
      items[changedIndex].weight += diff;
    }
  }

  return items;
}

/**
 * 轮盘赌选择算法
 * @param {Array} items - [{ id, weight, ... }]
 * @returns {object|null} 选中的 item
 */
export function rouletteWheelSelect(items) {
  const totalWeight = calcTotalWeight(items);
  if (totalWeight <= 0) return null;

  let rand = Math.random() * totalWeight;
  for (const item of items) {
    rand -= item.weight;
    if (rand <= 0) {
      return item;
    }
  }
  // 浮点误差兜底，返回最后一个
  return items[items.length - 1];
}

/**
 * 创建新替代行为（自定义）
 */
export function createCustomSubstitute(name) {
  return {
    id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    name,
    category: '自定义',
    weight: 0, // 添加后需手动调整权重
    custom: true,
  };
}
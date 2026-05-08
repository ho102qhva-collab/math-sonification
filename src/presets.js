// 预置函数库：普通函数 + 参数方程 + 极坐标

export const PRESETS = [
  // === 显式函数 y=f(x) ===
  { category: '一次函数', name: 'y = x', expr: 'x', xMin: -10, xMax: 10 },
  { category: '一次函数', name: 'y = -x', expr: '-x', xMin: -10, xMax: 10 },
  { category: '一次函数', name: 'y = 2x + 1', expr: '2*x + 1', xMin: -10, xMax: 10 },
  { category: '一次函数', name: 'y = -0.5x + 3', expr: '-0.5*x + 3', xMin: -10, xMax: 10 },

  { category: '二次函数', name: 'y = x²', expr: 'x^2', xMin: -5, xMax: 5 },
  { category: '二次函数', name: 'y = -x²', expr: '-x^2', xMin: -5, xMax: 5 },
  { category: '二次函数', name: 'y = x² - 4', expr: 'x^2 - 4', xMin: -5, xMax: 5 },
  { category: '二次函数', name: 'y = (x-1)²', expr: '(x-1)^2', xMin: -4, xMax: 6 },
  { category: '二次函数', name: 'y = 2x² - 3x + 1', expr: '2*x^2 - 3*x + 1', xMin: -5, xMax: 5 },

  { category: '三次函数', name: 'y = x³', expr: 'x^3', xMin: -3, xMax: 3 },
  { category: '三次函数', name: 'y = x³ - 3x', expr: 'x^3 - 3*x', xMin: -3, xMax: 3 },
  { category: '三次函数', name: 'y = x³ - 3x + 1', expr: 'x^3 - 3*x + 1', xMin: -3, xMax: 3 },

  { category: '幂函数', name: 'y = √x', expr: 'sqrt(x)', xMin: 0, xMax: 10 },
  { category: '幂函数', name: 'y = 1/x', expr: '1/x', xMin: -10, xMax: 10 },
  { category: '幂函数', name: 'y = |x|', expr: 'abs(x)', xMin: -5, xMax: 5 },

  { category: '指数与对数', name: 'y = eˣ', expr: 'exp(x)', xMin: -3, xMax: 3 },
  { category: '指数与对数', name: 'y = 2ˣ', expr: '2^x', xMin: -4, xMax: 4 },
  { category: '指数与对数', name: 'y = ln(x)', expr: 'log(x)', xMin: 0.01, xMax: 10 },
  { category: '指数与对数', name: 'y = e⁻ˣ', expr: 'exp(-x)', xMin: -3, xMax: 3 },

  { category: '三角函数', name: 'y = sin(x)', expr: 'sin(x)', xMin: -7, xMax: 7 },
  { category: '三角函数', name: 'y = cos(x)', expr: 'cos(x)', xMin: -7, xMax: 7 },
  { category: '三角函数', name: 'y = tan(x)', expr: 'tan(x)', xMin: -6, xMax: 6 },
  { category: '三角函数', name: 'y = 2sin(x)', expr: '2*sin(x)', xMin: -7, xMax: 7 },
  { category: '三角函数', name: 'y = sin(2x)', expr: 'sin(2*x)', xMin: -7, xMax: 7 },
  { category: '三角函数', name: 'y = sin(x-π/2)', expr: 'sin(x - pi/2)', xMin: -7, xMax: 7 },
  { category: '三角函数', name: 'y = sin(x) + cos(x)', expr: 'sin(x) + cos(x)', xMin: -7, xMax: 7 },

  { category: '反三角函数', name: 'y = arcsin(x)', expr: 'asin(x)', xMin: -1, xMax: 1 },
  { category: '反三角函数', name: 'y = arccos(x)', expr: 'acos(x)', xMin: -1, xMax: 1 },
  { category: '反三角函数', name: 'y = arctan(x)', expr: 'atan(x)', xMin: -10, xMax: 10 },

  { category: '特殊函数', name: 'y = x·sin(1/x)', expr: 'x * sin(1/x)', xMin: -1, xMax: 1 },
  { category: '特殊函数', name: 'y = sin(x)/x', expr: 'sin(x)/x', xMin: -10, xMax: 10 },
  { category: '特殊函数', name: 'y = floor(x)', expr: 'floor(x)', xMin: -5, xMax: 5 },
  { category: '特殊函数', name: 'y = sign(x)', expr: 'sign(x)', xMin: -5, xMax: 5 },

  // === 参数方程 ===
  { category: '圆与椭圆', name: '圆 (r=2)', type: 'parametric',
    xFn: t => 2 * Math.cos(t), yFn: t => 2 * Math.sin(t), tMin: 0, tMax: 2 * Math.PI },
  { category: '圆与椭圆', name: '椭圆 (a=3, b=2)', type: 'parametric',
    xFn: t => 3 * Math.cos(t), yFn: t => 2 * Math.sin(t), tMin: 0, tMax: 2 * Math.PI },
  { category: '圆与椭圆', name: '椭圆 (a=4, b=1)', type: 'parametric',
    xFn: t => 4 * Math.cos(t), yFn: t => 1 * Math.sin(t), tMin: 0, tMax: 2 * Math.PI },

  { category: '双曲线', name: '双曲线 (a=2, b=1) 右支', type: 'parametric',
    xFn: t => 2 * Math.cosh(t), yFn: t => 1 * Math.sinh(t), tMin: -2, tMax: 2 },
  { category: '双曲线', name: '双曲线 (a=2, b=1) 左支', type: 'parametric',
    xFn: t => -2 * Math.cosh(t), yFn: t => 1 * Math.sinh(t), tMin: -2, tMax: 2 },
  { category: '双曲线', name: '双曲线 (a=1, b=1) 右支', type: 'parametric',
    xFn: t => Math.cosh(t), yFn: t => Math.sinh(t), tMin: -2, tMax: 2 },

  { category: '抛物线', name: '抛物线 x=y²/4', type: 'parametric',
    xFn: t => t * t / 4, yFn: t => t, tMin: -4, tMax: 4 },
  { category: '抛物线', name: '抛物线 x=-y²/4', type: 'parametric',
    xFn: t => -t * t / 4, yFn: t => t, tMin: -4, tMax: 4 },

  { category: '极坐标曲线', name: '心形线', type: 'parametric',
    xFn: t => (1 - Math.cos(t)) * Math.cos(t), yFn: t => (1 - Math.cos(t)) * Math.sin(t),
    tMin: 0, tMax: 2 * Math.PI },
  { category: '极坐标曲线', name: '玫瑰线 (3瓣)', type: 'parametric',
    xFn: t => Math.cos(3 * t) * Math.cos(t), yFn: t => Math.cos(3 * t) * Math.sin(t),
    tMin: 0, tMax: Math.PI },
  { category: '极坐标曲线', name: '玫瑰线 (4瓣)', type: 'parametric',
    xFn: t => Math.cos(2 * t) * Math.cos(t), yFn: t => Math.cos(2 * t) * Math.sin(t),
    tMin: 0, tMax: 2 * Math.PI },
  { category: '极坐标曲线', name: '螺旋线', type: 'parametric',
    xFn: t => t / (2 * Math.PI) * Math.cos(t), yFn: t => t / (2 * Math.PI) * Math.sin(t),
    tMin: 0, tMax: 6 * Math.PI },

  { category: '利萨如图形', name: '利萨如 (1:2)', type: 'parametric',
    xFn: t => Math.sin(t), yFn: t => Math.sin(2 * t), tMin: 0, tMax: 2 * Math.PI },
  { category: '利萨如图形', name: '利萨如 (3:2)', type: 'parametric',
    xFn: t => Math.sin(3 * t), yFn: t => Math.sin(2 * t), tMin: 0, tMax: 2 * Math.PI },
  { category: '利萨如图形', name: '利萨如 (3:4)', type: 'parametric',
    xFn: t => Math.sin(3 * t), yFn: t => Math.sin(4 * t), tMin: 0, tMax: 2 * Math.PI },

  { category: '摆线', name: '摆线', type: 'parametric',
    xFn: t => t - Math.sin(t), yFn: t => 1 - Math.cos(t),
    tMin: 0, tMax: 6 * Math.PI },
];

// 渲染为 <select> 下拉菜单
export function renderPresets(selectEl, onSelect) {
  let currentCategory = '';

  for (const preset of PRESETS) {
    if (preset.category !== currentCategory) {
      currentCategory = preset.category;
      const group = document.createElement('optgroup');
      group.label = currentCategory;
      selectEl.appendChild(group);
    }

    const option = document.createElement('option');
    option.value = preset.expr || preset.name;
    option.textContent = preset.name;
    if (preset.xMin !== undefined) option.dataset.xMin = preset.xMin;
    if (preset.xMax !== undefined) option.dataset.xMax = preset.xMax;
    if (preset.type) option.dataset.type = preset.type;
    selectEl.lastElementChild.appendChild(option);
  }

  selectEl.addEventListener('change', () => {
    const opt = selectEl.selectedOptions[0];
    if (!opt || !opt.value) return;
    onSelect({
      type: opt.dataset.type || 'explicit',
      expr: opt.value,
      name: opt.textContent,
      xMin: opt.dataset.xMin ? parseFloat(opt.dataset.xMin) : undefined,
      xMax: opt.dataset.xMax ? parseFloat(opt.dataset.xMax) : undefined,
      // 参数方程的函数需要重新查找
      preset: findPresetByName(opt.textContent),
    });
    selectEl.selectedIndex = 0;
  });
}

function findPresetByName(name) {
  return PRESETS.find(p => p.name === name);
}

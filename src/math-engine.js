// 数学引擎：表达式解析、求值、分析
// 使用 math.js 进行安全的数学表达式计算

import { create, all } from 'https://cdn.jsdelivr.net/npm/mathjs@13.2.2/+esm';
import { exprToChinese } from './expr-speech.js';

const { importFactory, parse, evaluate: evalFn, ...safeFns } = all;
const math = create(safeFns);

export class MathEngine {
  constructor() {
    this._compiled = null;
    this._expression = '';
    this._scope = {};
    this._compiledList = [];
  }

  // 编译多个表达式（分号分隔）
  compileMulti(exprStr) {
    const parts = exprStr.split(';').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return { success: false, error: '请输入至少一个函数表达式' };
    if (parts.length === 1) return this.compile(parts[0]);

    this._compiled = null;
    this._expression = exprStr;
    this._compiledList = [];

    for (const part of parts) {
      try {
        const compiled = math.compile(part);
        // 验证至少有一个有效点
        let valid = false;
        for (const x of [0, 1, -1]) {
          try {
            const r = compiled.evaluate({ x });
            if (typeof r === 'number' && isFinite(r)) { valid = true; break; }
          } catch {}
        }
        if (!valid) {
          this._compiledList = [];
          return { success: false, error: `表达式 "${part}" 无法计算` };
        }
        this._compiledList.push({ compiled, expr: part });
      } catch (e) {
        this._compiledList = [];
        return { success: false, error: `表达式 "${part}" 有误：${e.message}` };
      }
    }
    return { success: true, count: this._compiledList.length };
  }

  get isMulti() { return this._compiledList.length > 1; }
  get multiCount() { return this._compiledList.length || (this._compiled ? 1 : 0); }

  // 在 x 处对第 i 个表达式求值
  evaluateAt(x, index = 0) {
    const compiled = this._compiledList[index]?.compiled || (index === 0 ? this._compiled : null);
    if (!compiled) return { value: NaN, defined: false };
    try {
      const result = compiled.evaluate({ x });
      if (typeof result !== 'number' || !isFinite(result)) return { value: NaN, defined: false };
      return { value: result, defined: true };
    } catch { return { value: NaN, defined: false }; }
  }

  // 编译表达式
  compile(expr) {
    this._compiledList = [];
    this._compiled = null;
    try {
      this._expression = expr;
      this._compiled = math.compile(expr);
      // 测试求值：用多个 x 值确认表达式有效（排除单个点无定义的误判）
      const testPoints = [0, 1, -1, 0.5, 2];
      let anyValid = false;
      for (const x of testPoints) {
        const result = this.evaluate(x);
        if (result.defined) {
          anyValid = true;
          break;
        }
      }
      if (!anyValid) {
        this._compiled = null;
        return { success: false, error: `无法计算表达式 "${expr}"，请检查函数名和变量是否正确` };
      }
      return { success: true };
    } catch (e) {
      this._compiled = null;
      return { success: false, error: e.message };
    }
  }

  // 在 x 处求值，返回 { value, defined }
  evaluate(x) {
    if (!this._compiled) return { value: NaN, defined: false };
    try {
      const result = this._compiled.evaluate({ x });
      if (typeof result !== 'number' || !isFinite(result)) {
        return { value: NaN, defined: false };
      }
      return { value: result, defined: true };
    } catch {
      return { value: NaN, defined: false };
    }
  }

  // 数值导数
  derivative(x, h = 1e-6) {
    const y1 = this.evaluate(x - h);
    const y2 = this.evaluate(x + h);
    if (!y1.defined || !y2.defined) return { value: NaN, defined: false };
    return { value: (y2.value - y1.value) / (2 * h), defined: true };
  }

  // 二阶数值导数
  secondDerivative(x, h = 1e-5) {
    const y0 = this.evaluate(x - h);
    const y1 = this.evaluate(x);
    const y2 = this.evaluate(x + h);
    if (!y0.defined || !y1.defined || !y2.defined) return { value: NaN, defined: false };
    return { value: (y2.value - 2 * y1.value + y0.value) / (h * h), defined: true };
  }

  // 采样函数在 [xMin, xMax] 区间内的值
  // 返回 { points: [{x, y, defined}], yMin, yMax }
  sample(xMin, xMax, numPoints = 500) {
    const points = [];
    const step = (xMax - xMin) / (numPoints - 1);
    const yValues = [];

    for (let i = 0; i < numPoints; i++) {
      const x = xMin + i * step;
      const { value, defined } = this.evaluate(x);
      if (defined) {
        yValues.push(value);
      }
      points.push({ x, y: defined ? value : NaN, defined });
    }

    // 用第5/95百分位数裁剪极端值，避免渐近线拉伸整个范围
    let yMin, yMax;
    if (yValues.length === 0) {
      yMin = -5;
      yMax = 5;
    } else if (yValues.length > 10) {
      const sorted = [...yValues].sort((a, b) => a - b);
      const lo = Math.floor(sorted.length * 0.05);
      const hi = Math.ceil(sorted.length * 0.95) - 1;
      yMin = sorted[lo];
      yMax = sorted[hi];
    } else {
      yMin = yValues.length > 0 ? Math.min(...yValues) : -5;
      yMax = yValues.length > 0 ? Math.max(...yValues) : 5;
    }

    // 安全边界：防止 y 范围过大或过小
    if (yMin === Infinity) yMin = -5;
    if (yMax === -Infinity) yMax = 5;

    return { points, yMin, yMax };
  }

  // 检测特殊点
  // 返回 { zeros, extrema, asymptotes, discontinuities, inflections }
  analyze(xMin, xMax, numPoints = 1000) {
    const step = (xMax - xMin) / (numPoints - 1);
    const zeros = [];
    const extrema = [];
    const asymptotes = [];
    const discontinuities = [];
    const inflections = [];

    let prevY = null, prevDefined = false;
    let prevDeriv = null, prevDerivDefined = false;
    let prevX = null;
    let prevSecondDeriv = null, prevSecondDerivDefined = false;

    for (let i = 0; i < numPoints; i++) {
      const x = xMin + i * step;
      const { value: y, defined } = this.evaluate(x);
      const { value: d, defined: dDefined } = this.derivative(x);
      const { value: dd, defined: ddDefined } = this.secondDerivative(x);

      if (prevX !== null) {
        // 零点检测：y 值穿越 x 轴（排除渐近线误判）
        if (defined && prevDefined) {
          const prevVal = prevY;
          const maxMagnitude = Math.max(Math.abs(prevVal), Math.abs(y));
          if (prevVal * y < 0 && maxMagnitude < 1000) {
            // 二分法精确定位
            const zeroX = this._bisectZero(prevX, x);
            if (zeroX !== null) {
              // 验证零点处函数值确实接近 0
              const { value: zeroY } = this.evaluate(zeroX);
              if (Math.abs(zeroY) < 1) {
                zeros.push({ x: zeroX, y: 0 });
              }
            }
          }
          if (Math.abs(y) < 1e-10 && Math.abs(prevVal) >= 1e-10) {
            zeros.push({ x, y: 0 });
          }
        }

        // 极值检测：导数符号变化
        if (dDefined && prevDerivDefined) {
          if (prevDeriv * d < 0) {
            const midX = (prevX + x) / 2;
            const { value: midY, defined: midDef } = this.evaluate(midX);
            if (midDef) {
              extrema.push({
                x: midX,
                y: midY,
                type: prevDeriv > 0 ? 'max' : 'min'
              });
            }
          }
        }

        // 不连续点/渐近线检测
        if (defined && prevDefined) {
          const midX = (prevX + x) / 2;
          const { value: midY, defined: midDef } = this.evaluate(midX);
          const bothLarge = Math.abs(prevY) > 50 && Math.abs(y) > 50;
          const oppositeSigns = prevY * y < 0;

          // 两侧值大且符号相反 → 垂直渐近线（如 tan(x) 在 π/2 处）
          // 或中点无定义/极大 → 渐近线（如 1/x 在 0 处）
          if ((bothLarge && oppositeSigns) || !midDef ||
              (midDef && Math.abs(midY) > Math.max((Math.abs(prevY) + Math.abs(y)) / 2 * 3, 100))) {
            asymptotes.push({
              x: midX,
              direction: y > prevY ? 'positive' : 'negative'
            });
          } else {
            // 正常的跳跃不连续
            const jumpSize = Math.abs(y - prevY);
            const expectedChange = Math.abs(d) * step * 2;
            if (jumpSize > Math.max(expectedChange * 10, 5)) {
              discontinuities.push({
                x: midX,
                type: 'jump',
                yBefore: prevY,
                yAfter: y
              });
            }
          }
        }

        // 渐近线/无定义检测
        if (defined && !prevDefined) {
          // 刚从无定义变回有定义
          if (Math.abs(y) > 100) {
            asymptotes.push({
              x: (prevX + x) / 2,
              direction: y > 0 ? 'positive' : 'negative'
            });
          }
        }
        if (!defined && prevDefined) {
          // 从有定义变为无定义
          if (Math.abs(prevY) > 100) {
            asymptotes.push({
              x: (prevX + x) / 2,
              direction: prevY > 0 ? 'positive' : 'negative'
            });
          } else {
            discontinuities.push({
              x: (prevX + x) / 2,
              type: 'undefined_point',
              yBefore: prevY
            });
          }
        }
      }

      // 拐点检测：二阶导数符号变化
      if (ddDefined && prevSecondDerivDefined && prevSecondDeriv * dd < 0) {
        const midX = (prevX + x) / 2;
        const { defined: midDef } = this.evaluate(midX);
        if (midDef) {
          inflections.push({ x: midX });
        }
      }

      prevX = x;
      prevY = y;
      prevDefined = defined;
      prevDeriv = d;
      prevDerivDefined = dDefined;
      prevSecondDeriv = dd;
      prevSecondDerivDefined = ddDefined;
    }

    // 去重（相邻检测到的同一点）
    return {
      zeros: this._dedup(zeros),
      extrema: this._dedup(extrema),
      asymptotes: this._dedup(asymptotes),
      discontinuities: this._dedup(discontinuities),
      inflections: this._dedup(inflections)
    };
  }

  // 二分法精确定位零点
  _bisectZero(a, b, maxIter = 30) {
    const { value: fa, defined: da } = this.evaluate(a);
    const { value: fb, defined: db } = this.evaluate(b);
    if (!da || !db || fa * fb >= 0) return (a + b) / 2;

    for (let i = 0; i < maxIter; i++) {
      const mid = (a + b) / 2;
      const { value: fm, defined: dm } = this.evaluate(mid);
      if (!dm) break;
      if (Math.abs(fm) < 1e-12) return mid;
      if (fa * fm < 0) {
        b = mid;
      } else {
        a = mid;
      }
    }
    return (a + b) / 2;
  }

  // 去除距离过近的重复点
  _dedup(arr, minDist = 0.1) {
    if (arr.length <= 1) return arr;
    const sorted = [...arr].sort((a, b) => a.x - b.x);
    const result = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].x - result[result.length - 1].x > minDist) {
        result.push(sorted[i]);
      }
    }
    return result;
  }

  // 生成语音摘要文本
  generateSummary(xMin, xMax) {
    const analysis = this.analyze(xMin, xMax);
    const parts = [];

    parts.push(`函数表达式为 y 等于${exprToChinese(this._expression)}。`);

    // 定义域信息
    const { points } = this.sample(xMin, xMax, 200);
    const definedCount = points.filter(p => p.defined).length;
    const hasUndefinedPoints = definedCount < points.length
      || analysis.asymptotes.length > 0
      || analysis.discontinuities.length > 0;
    if (!hasUndefinedPoints) {
      parts.push(`在 ${xMin} 到 ${xMax} 范围内处处有定义。`);
    } else {
      const allUndef = [
        ...analysis.asymptotes.map(a => ({ x: a.x, desc: `x约等于${a.x.toFixed(1)}处有垂直渐近线` })),
        ...analysis.discontinuities
          .filter(d => d.type === 'undefined_point')
          .map(d => ({ x: d.x, desc: `x等于${d.x.toFixed(1)}处无定义` }))
      ];
      if (allUndef.length > 0) {
        parts.push(allUndef.map(u => u.desc).join('，') + '。');
      } else {
        parts.push(`在某些点无定义。`);
      }
    }

    // 零点
    if (analysis.zeros.length > 0) {
      const positions = analysis.zeros.map(z => `x约等于${z.x.toFixed(2)}`).join('、');
      parts.push(`有${analysis.zeros.length}个零点，分别在${positions}。`);
    } else {
      parts.push('在该范围内没有零点。');
    }

    // 极值
    if (analysis.extrema.length > 0) {
      for (const ext of analysis.extrema) {
        const typeName = ext.type === 'max' ? '极大值' : '极小值';
        parts.push(`${typeName}在x约等于${ext.x.toFixed(2)}处，y约等于${ext.y.toFixed(2)}。`);
      }
    }

    // 渐近线
    if (analysis.asymptotes.length > 0) {
      const positions = analysis.asymptotes.map(a => `x约等于${a.x.toFixed(2)}`).join('、');
      parts.push(`在${positions}处存在垂直渐近线。`);
    }

    return parts.join('');
  }

  get expression() {
    return this._expression;
  }

  // 数值定积分（梯形法则）
  integrate(xMin, xMax, numSteps = 1000) {
    const step = (xMax - xMin) / numSteps;
    let sum = 0;
    let prevResult = this.evaluate(xMin);
    if (!prevResult.defined) return { value: NaN, defined: false };

    for (let i = 1; i <= numSteps; i++) {
      const x = xMin + i * step;
      const curr = this.evaluate(x);
      if (!curr.defined) return { value: NaN, defined: false };
      sum += (prevResult.value + curr.value) * step / 2;
      prevResult = curr;
    }
    return { value: sum, defined: true };
  }
}

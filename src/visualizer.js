// 可视化渲染器：低视力用户支持的简化图形
// 高对比度、粗线条、同步扫描线

export class Visualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.dpr = window.devicePixelRatio || 1;

    // 图形颜色（高对比度）
    this.colors = {
      bg: '#111111',
      axis: '#888888',
      grid: '#333333',
      curve: '#00e676',       // 亮绿
      curveNegative: '#ff5252', // 红
      scanLine: '#ffff00',    // 黄
      specialPoint: '#ff9100', // 橙
      zeroLine: '#ffffff',
      text: '#e0e0e0',
      referenceLine: 'rgba(255, 255, 255, 0.15)',
    };

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
    this.width = rect.width;
    this.height = rect.height;
    this.padding = { top: 30, right: 30, bottom: 40, left: 50 };
  }

  // 主绘制方法
  render(options) {
    const {
      xMin, xMax,
      points,         // [{x, y, defined}]
      yMin, yMax,
      analysis,
      scanProgress = -1, // 0~1，-1 表示不在扫描
      currentX = null,
      derivativeMode = false
    } = options;

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const p = this.padding;

    // 清屏
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, w, h);

    const plotW = w - p.left - p.right;
    const plotH = h - p.top - p.bottom;

    // 坐标转换
    const toPixelX = (x) => p.left + ((x - xMin) / (xMax - xMin)) * plotW;
    const toPixelY = (y) => p.top + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

    // 绘制网格
    this._drawGrid(ctx, xMin, xMax, yMin, yMax, toPixelX, toPixelY, w, h, p);

    // 绘制坐标轴
    this._drawAxes(ctx, xMin, xMax, yMin, yMax, toPixelX, toPixelY, w, h, p);

    // 绘制 y=0 参考线
    if (yMin <= 0 && yMax >= 0) {
      const y0 = toPixelY(0);
      ctx.strokeStyle = this.colors.referenceLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.left, y0);
      ctx.lineTo(w - p.right, y0);
      ctx.stroke();
    }

    // 绘制曲线
    this._drawCurve(ctx, points, yMin, yMax, toPixelX, toPixelY);

    // 绘制特殊点
    if (analysis) {
      this._drawSpecialPoints(ctx, analysis, toPixelX, toPixelY);
    }

    // 绘制扫描线
    if (scanProgress >= 0 && scanProgress <= 1) {
      const scanX = toPixelX(xMin + scanProgress * (xMax - xMin));
      ctx.strokeStyle = this.colors.scanLine;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(scanX, p.top);
      ctx.lineTo(scanX, h - p.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 绘制当前探索位置
    if (currentX !== null && currentX >= xMin && currentX <= xMax) {
      const fn = derivativeMode
        ? (x) => { /* 需要外部传入 */ }
        : (x) => null;
      // currentX 位置标记
      const px = toPixelX(currentX);
      ctx.fillStyle = this.colors.scanLine;
      ctx.beginPath();
      ctx.arc(px, p.top + plotH / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 坐标标签
    this._drawLabels(ctx, xMin, xMax, yMin, yMax, toPixelX, toPixelY, w, h, p);
  }

  _drawGrid(ctx, xMin, xMax, yMin, yMax, toPixelX, toPixelY, w, h, p) {
    ctx.strokeStyle = this.colors.grid;
    ctx.lineWidth = 0.5;

    // 计算合理的网格间距
    const xStep = this._niceStep(xMax - xMin, 10);
    const yStep = this._niceStep(yMax - yMin, 8);

    // 垂直网格线
    const xStart = Math.ceil(xMin / xStep) * xStep;
    for (let x = xStart; x <= xMax; x += xStep) {
      const px = toPixelX(x);
      ctx.beginPath();
      ctx.moveTo(px, p.top);
      ctx.lineTo(px, h - p.bottom);
      ctx.stroke();
    }

    // 水平网格线
    const yStart = Math.ceil(yMin / yStep) * yStep;
    for (let y = yStart; y <= yMax; y += yStep) {
      const py = toPixelY(y);
      ctx.beginPath();
      ctx.moveTo(p.left, py);
      ctx.lineTo(w - p.right, py);
      ctx.stroke();
    }
  }

  _drawAxes(ctx, xMin, xMax, yMin, yMax, toPixelX, toPixelY, w, h, p) {
    ctx.strokeStyle = this.colors.axis;
    ctx.lineWidth = 2;

    // X 轴
    if (yMin <= 0 && yMax >= 0) {
      const y0 = toPixelY(0);
      ctx.beginPath();
      ctx.moveTo(p.left, y0);
      ctx.lineTo(w - p.right, y0);
      ctx.stroke();
    }

    // Y 轴
    if (xMin <= 0 && xMax >= 0) {
      const x0 = toPixelX(0);
      ctx.beginPath();
      ctx.moveTo(x0, p.top);
      ctx.lineTo(x0, h - p.bottom);
      ctx.stroke();
    }
  }

  _drawCurve(ctx, points, yMin, yMax, toPixelX, toPixelY) {
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let drawing = false;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!p.defined || isNaN(p.y)) {
        drawing = false;
        continue;
      }

      const px = toPixelX(p.x);
      const py = toPixelY(p.y);

      if (!drawing) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.strokeStyle = p.y >= 0 ? this.colors.curve : this.colors.curveNegative;
        drawing = true;
      } else {
        // 检测正负域切换
        const prevP = points[i - 1];
        if (prevP.defined && ((prevP.y >= 0) !== (p.y >= 0))) {
          // 正负切换：在穿越点分段
          ctx.lineTo(px, py);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.strokeStyle = p.y >= 0 ? this.colors.curve : this.colors.curveNegative;
        } else {
          ctx.lineTo(px, py);
        }
      }
    }
    if (drawing) ctx.stroke();
  }

  _drawSpecialPoints(ctx, analysis, toPixelX, toPixelY) {
    const drawMarker = (x, y, label) => {
      const px = toPixelX(x);
      const py = toPixelY(y);
      ctx.fillStyle = this.colors.specialPoint;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();

      if (label) {
        ctx.fillStyle = this.colors.text;
        ctx.font = '14px sans-serif';
        ctx.fillText(label, px + 8, py - 8);
      }
    };

    for (const z of analysis.zeros) {
      drawMarker(z.x, 0, '零');
    }
    for (const e of analysis.extrema) {
      drawMarker(e.x, e.y, e.type === 'max' ? '大' : '小');
    }
  }

  _drawLabels(ctx, xMin, xMax, yMin, yMax, toPixelX, toPixelY, w, h, p) {
    ctx.fillStyle = this.colors.text;
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';

    const xStep = this._niceStep(xMax - xMin, 10);
    const xStart = Math.ceil(xMin / xStep) * xStep;
    for (let x = xStart; x <= xMax; x += xStep) {
      const px = toPixelX(x);
      ctx.fillText(this._formatNum(x), px, h - p.bottom + 20);
    }

    ctx.textAlign = 'right';
    const yStep = this._niceStep(yMax - yMin, 8);
    const yStart2 = Math.ceil(yMin / yStep) * yStep;
    for (let y = yStart2; y <= yMax; y += yStep) {
      const py = toPixelY(y);
      ctx.fillText(this._formatNum(y), p.left - 8, py + 5);
    }
  }

  _niceStep(range, targetTicks) {
    const rough = range / targetTicks;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
    const residual = rough / magnitude;
    let nice;
    if (residual <= 1.5) nice = 1;
    else if (residual <= 3) nice = 2;
    else if (residual <= 7) nice = 5;
    else nice = 10;
    return nice * magnitude;
  }

  _formatNum(n) {
    if (Number.isInteger(n) || Math.abs(n) >= 10) return n.toFixed(0);
    return n.toFixed(1);
  }
}

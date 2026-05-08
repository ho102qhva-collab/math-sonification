// 键盘导航系统：处理所有键盘交互
// 管理当前探索位置、步长、书签、缩放

export class Navigator {
  constructor(mathEngine, audioEngine, speech, scanner) {
    this.math = mathEngine;
    this.audio = audioEngine;
    this.speech = speech;
    this.scanner = scanner;

    // 导航状态
    this.xMin = -10;
    this.xMax = 10;
    this.currentX = 0;
    this.stepSize = 0.5;
    this.bookmarks = [];
    this.bookmarkIndex = -1;
    this.derivativeMode = false;
    this.referenceTone = true;

    // 回调
    this.onPositionChange = null;
    this.onRangeChange = null;
    this.onDerivativeToggle = null;
    this.onBookmark = null;

    this._bound = false;
    this.activePreset = null;
    this.paramValue = null;
  }
  }

  bind(element = document) {
    if (this._bound) return;
    this._bound = true;
    this._element = element;
    element.addEventListener('keydown', (e) => this._handleKey(e));
  }

  unbind() {
    if (this._element) {
      this._element.removeEventListener('keydown', (e) => this._handleKey(e));
    }
    this._bound = false;
  }

  _handleKey(e) {
    // 不拦截输入框里的按键（除了 Escape）
    const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
    if (isInput && e.key !== 'Escape') return;

    const handlers = {
      'ArrowLeft': () => this.stepBackward(),
      'ArrowRight': () => this.stepForward(),
      'ArrowUp': () => this.increaseStep(),
      'ArrowDown': () => this.decreaseStep(),
      ' ': () => { e.preventDefault(); this.playFromCurrent(); },
      'Enter': () => this.reportCoordinate(),
      'z': () => this.jumpToZero(),
      'Z': () => this.jumpToZero(),
      'm': () => this.jumpToExtrema(),
      'M': () => this.jumpToExtrema(),
      'Home': () => this.jumpToStart(),
      'End': () => this.jumpToEnd(),
      'd': () => this.toggleDerivative(),
      'D': () => this.toggleDerivative(),
      '+': () => this.zoomIn(),
      '=': () => this.zoomIn(), // + 键通常需要 Shift
      '-': () => this.zoomOut(),
      'b': () => this.addBookmark(),
      'B': () => {
        if (e.shiftKey) this.prevBookmark();
        else this.addBookmark();
      },
      'r': () => this.toggleReference(),
      'R': () => this.toggleReference(),
      '[': () => this.adjustParam(-1),
      ']': () => this.adjustParam(1),
      'Escape': () => this.stopPlayback(),
    };

    const handler = handlers[e.key];
    if (handler) {
      e.preventDefault();
      handler();
    }
  }

  stepForward() {
    this.currentX = Math.min(this.currentX + this.stepSize, this.xMax);
    this._playStep();
    this._notifyPosition();
  }

  stepBackward() {
    this.currentX = Math.max(this.currentX - this.stepSize, this.xMin);
    this._playStep();
    this._notifyPosition();
  }

  increaseStep() {
    this.stepSize = Math.min(5, this.stepSize * 1.5);
    this.speech.speakAction(`步长增大到${this.stepSize.toFixed(2)}`);
  }

  decreaseStep() {
    this.stepSize = Math.max(0.01, this.stepSize / 1.5);
    this.speech.speakAction(`步长减小到${this.stepSize.toFixed(2)}`);
  }

  playFromCurrent() {
    if (this.onPositionChange) {
      this.onPositionChange({ action: 'playFrom', x: this.currentX });
    }
  }

  reportCoordinate() {
    const { value, defined } = this.derivativeMode
      ? this.math.derivative(this.currentX)
      : this.math.evaluate(this.currentX);
    this.speech.speakCoordinate(this.currentX, value, defined);
  }

  jumpToZero() {
    const analysis = this.math.analyze(this.xMin, this.xMax);
    if (analysis.zeros.length === 0) {
      this.speech.speakAction('该范围内没有零点');
      return;
    }
    // 找最近的零点
    const nearest = this._findNearest(analysis.zeros);
    this.currentX = nearest.x;
    this._playStep();
    this._notifyPosition();
    this.speech.speakAction(`跳转到零点 x等于${nearest.x.toFixed(2)}`);
  }

  jumpToExtrema() {
    const analysis = this.math.analyze(this.xMin, this.xMax);
    if (analysis.extrema.length === 0) {
      this.speech.speakAction('该范围内没有极值点');
      return;
    }
    const nearest = this._findNearest(analysis.extrema);
    this.currentX = nearest.x;
    this._playStep();
    this._notifyPosition();
    const type = nearest.type === 'max' ? '极大值' : '极小值';
    this.speech.speakAction(`跳转到${type} x等于${nearest.x.toFixed(2)} y等于${nearest.y.toFixed(2)}`);
  }

  jumpToStart() {
    this.currentX = this.xMin;
    this._playStep();
    this._notifyPosition();
  }

  jumpToEnd() {
    this.currentX = this.xMax;
    this._playStep();
    this._notifyPosition();
  }

  toggleDerivative() {
    this.derivativeMode = !this.derivativeMode;
    if (this.onDerivativeToggle) {
      this.onDerivativeToggle(this.derivativeMode);
    }
    this.speech.speakAction(this.derivativeMode ? '导数模式已开启' : '导数模式已关闭');
  }

  zoomIn() {
    const range = this.xMax - this.xMin;
    if (range <= 0.1) {
      this.speech.speakAction('已达到最大放大倍数');
      return;
    }
    const center = this.currentX;
    const newRange = range / 2;
    this.xMin = center - newRange;
    this.xMax = center + newRange;
    if (this.onRangeChange) this.onRangeChange(this.xMin, this.xMax);
    this.speech.speakAction(`放大，范围 ${this.xMin.toFixed(1)} 到 ${this.xMax.toFixed(1)}`);
  }

  zoomOut() {
    const range = this.xMax - this.xMin;
    if (range >= 1000) {
      this.speech.speakAction('已达到最小缩放倍数');
      return;
    }
    const center = this.currentX;
    const newRange = range * 2;
    this.xMin = center - newRange;
    this.xMax = center + newRange;
    if (this.onRangeChange) this.onRangeChange(this.xMin, this.xMax);
    this.speech.speakAction(`缩小，范围 ${this.xMin.toFixed(1)} 到 ${this.xMax.toFixed(1)}`);
  }

  addBookmark() {
    const { value, defined } = this.math.evaluate(this.currentX);
    const bookmark = {
      x: this.currentX,
      y: defined ? value : null,
      defined,
      timestamp: Date.now()
    };
    this.bookmarks.push(bookmark);
    this.bookmarkIndex = this.bookmarks.length - 1;
    if (this.onBookmark) this.onBookmark(bookmark);
    this.speech.speakAction(`书签已添加在 x等于${this.currentX.toFixed(2)}`);
    this.audio.playBookmarkConfirm(this.audio.currentTime);
  }

  prevBookmark() {
    if (this.bookmarks.length === 0) {
      this.speech.speakAction('没有书签');
      return;
    }
    this.bookmarkIndex = (this.bookmarkIndex - 1 + this.bookmarks.length) % this.bookmarks.length;
    const bm = this.bookmarks[this.bookmarkIndex];
    this.currentX = bm.x;
    this._playStep();
    this._notifyPosition();
    this.speech.speakAction(`跳转到书签 x等于${bm.x.toFixed(2)}`);
  }

  toggleReference() {
    this.referenceTone = !this.referenceTone;
    if (this.onPositionChange) {
      this.onPositionChange({ action: 'toggleRef', value: this.referenceTone });
    }
    this.speech.speakAction(this.referenceTone ? '参考音已开启' : '参考音已关闭');
  }

  stopPlayback() {
    this.scanner.stop();
    this.speech.stop();
  }

  // 在当前步进位置播放一个短音
  _playStep() {
    // 听觉疲劳管理：连续探索每 10 秒插入静音间隔
    const now = Date.now();
    if (this._lastStepTime) {
      const elapsed = now - this._lastStepTime;
      if (elapsed < 10000) {
        // 在同一个 10 秒窗口内，正常播放
      } else if (elapsed < 11000) {
        // 进入静音间隔，跳过播放
        this._lastStepTime = now;
        return;
      }
      // 超过 11 秒，重置窗口
    }
    this._lastStepTime = now;

    const fn = this.derivativeMode ? (x) => this.math.derivative(x) : (x) => this.math.evaluate(x);
    const { value, defined } = fn(this.currentX);

    if (!defined) return;

    const { yMin, yMax } = this._getYRange();
    const freq = this.audio.yToFrequency(value, yMin, yMax);
    const pan = this.audio.xToPan(this.currentX, this.xMin, this.xMax);

    const now = this.audio.currentTime;
    const { osc, gain, panner } = this.audio.createOscillator(this.audio.getWaveformForY(value));
    osc.frequency.setValueAtTime(freq, now);
    panner.pan.setValueAtTime(pan, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.01);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  _getYRange() {
    const { yMin, yMax } = this.math.sample(this.xMin, this.xMax, 200);
    const pad = Math.max(1, (yMax - yMin) * 0.1);
    return { yMin: yMin - pad, yMax: yMax + pad };
  }

  _findNearest(points) {
    let nearest = points[0];
    let minDist = Math.abs(points[0].x - this.currentX);
    for (let i = 1; i < points.length; i++) {
      const dist = Math.abs(points[i].x - this.currentX);
      if (dist < minDist) {
        minDist = dist;
        nearest = points[i];
      }
    }
    return nearest;
  }

  _notifyPosition() {
    if (this.onPositionChange) {
      const fn = this.derivativeMode ? (x) => this.math.derivative(x) : (x) => this.math.evaluate(x);
      const { value, defined } = fn(this.currentX);
      this.onPositionChange({
        action: 'move',
        x: this.currentX,
        y: defined ? value : null,
        defined,
        xMin: this.xMin,
        xMax: this.xMax
      });
    }
  }

  adjustParam(direction) {
    const preset = this.activePreset;
    if (!preset || !preset.param) {
      this.speech.speakAction('当前函数不支持参数调节，请从"参数调节"类别选择');
      return;
    }
    const step = preset.paramStep * direction;
    this.paramValue = Math.max(
      preset.paramMin,
      Math.min(preset.paramMax, (this.paramValue ?? preset.paramValue) + step)
    );
    const rounded = Math.round(this.paramValue * 100) / 100;
    this.paramValue = rounded;
    const expr = preset.expr.replace(preset.param, String(rounded));
    if (this.onParamChange) this.onParamChange(expr, preset.param, rounded);
  }
}

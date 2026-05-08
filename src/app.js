// 应用主控制器：整合所有模块，驱动感知协议
// 状态机：idle → summary → fastScan → normalScan → explore

import { AudioEngine } from './audio-engine.js';
import { MathEngine } from './math-engine.js';
import { SoundEffects } from './sound-effects.js';
import { Scanner } from './scanner.js';
import { Speech } from './speech.js';
import { Navigator } from './navigator.js';
import { Visualizer } from './visualizer.js';
import { renderPresets, PRESETS } from './presets.js';
import { TutorialSystem } from './tutorial.js';
import { SelfTest } from './selftest.js';
import { Calibration } from './calibration.js';
import { exprToChinese } from './expr-speech.js';

export class App {
  constructor() {
    this.audio = new AudioEngine();
    this.math = new MathEngine();
    this.sfx = new SoundEffects(this.audio);
    this.speech = new Speech();
    this.scanner = new Scanner(this.audio, this.math, this.sfx);
    this.nav = new Navigator(this.math, this.audio, this.speech, this.scanner);
    this.tutorial = new TutorialSystem(this);
    this.selftest = new SelfTest(this);
    this.calibration = new Calibration(this.audio, this.speech);

    // 状态
    this.state = 'idle'; // idle | summary | scanning | explore
    this.summaryEnabled = true;
    this.analysis = null;
    this._snapshotEngine = null; // 参照函数的 MathEngine
    this.currentPoints = null;
    this.currentYRange = { yMin: -5, yMax: 5 };

    // DOM 引用
    this.els = {};
  }

  async init() {
    this._cacheElements();
    this._bindEvents();
    this._renderPresets();

    // 初始化可视化
    this.viz = new Visualizer(this.els.canvas);
    this._renderEmptyGraph();

    // 绑定导航器
    this.nav.bind(document);
    this.nav.onPositionChange = (info) => this._onNavigatorChange(info);
    this.nav.onRangeChange = (xMin, xMax) => this._onRangeChange(xMin, xMax);
    this.nav.onDerivativeToggle = (on) => this._onDerivativeToggle(on);
    this.nav.onParamChange = (expr, param, value) => this._onParamChange(expr, param, value);
    this.nav.onSnapshotToggle = () => this._toggleSnapshot();

    // 恢复校准结果
    this._restoreCalibration();

    // 恢复用户偏好
    this._restorePreferences();

    // 检查是否是首次使用
    if (!localStorage.getItem('mathSonification.visited')) {
      const audioOk = !!(window.AudioContext || window.webkitAudioContext);
      const speechOk = !!window.speechSynthesis;
      if (!audioOk) {
        this._updateStatus('您的浏览器不支持 Web Audio API，声觉化功能无法使用。请使用最新版 Chrome 或 Edge。');
      } else if (!speechOk) {
        this.speech.speak(
          '欢迎使用数学声觉化工具。您的浏览器语音合成不可用，部分语音提示将无法播放，但声觉化功能正常。',
          { priority: true }
        );
      } else {
        this.speech.speak(
          '欢迎使用数学声觉化工具。正在为您开启教学引导。',
          { priority: true, onEnd: () => this.tutorial.start() }
        );
      }
      localStorage.setItem('mathSonification.visited', 'true');
    }
  }

  _cacheElements() {
    const $ = (id) => document.getElementById(id);
    this.els = {
      input: $('expression-input'),
      playBtn: $('btn-play'),
      stopBtn: $('btn-stop'),
      status: $('status-bar'),
      canvas: $('graph-canvas'),
      xMin: $('x-min'),
      xMax: $('x-max'),
      speed: $('speed-select'),
      derivativeBtn: $('btn-derivative'),
      referenceBtn: $('btn-reference'),
      summaryBtn: $('btn-summary'),
      presetSelect: $('preset-select'),
      cursorInfo: $('cursor-info'),
      tutorialBtn: $('btn-tutorial'),
      selftestBtn: $('btn-selftest'),
      tutorialDialog: $('tutorial-dialog'),
      tutorialTitle: $('tutorial-title'),
      tutorialBody: $('tutorial-body'),
      tutorialNext: $('btn-tutorial-next'),
      tutorialSkip: $('btn-tutorial-skip'),
      selftestDialog: $('selftest-dialog'),
      selftestBody: $('selftest-body'),
      selftestAnswer: $('btn-selftest-answer'),
      selftestClose: $('btn-selftest-close'),
      contrastBtn: $('btn-contrast'),
      paramsDisplay: $('params-display'),
      paramsText: $('params-text'),
      snapshotBtn: $('btn-snapshot'),
      calibrationBtn: $('btn-calibration'),
    };
  }

  _bindEvents() {
    this.els.playBtn.addEventListener('click', () => this._onPlay());
    this.els.stopBtn.addEventListener('click', () => this._onStop());
    this.els.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._onPlay();
      }
    });
    this.els.derivativeBtn.addEventListener('click', () => this.nav.toggleDerivative());
    this.els.referenceBtn.addEventListener('click', () => this.nav.toggleReference());
    this.els.summaryBtn.addEventListener('click', () => this._toggleSummary());
    this.els.tutorialBtn.addEventListener('click', () => this.tutorial.start());
    this.els.selftestBtn.addEventListener('click', () => this.selftest.start());
    this.els.tutorialSkip.addEventListener('click', () => this.tutorial.close());
    this.els.tutorialNext.addEventListener('click', () => this.tutorial.nextStep());
    this.els.selftestClose.addEventListener('click', () => this.selftest.close());
    this.els.selftestAnswer.addEventListener('click', () => this.selftest.submitAnswer());
    this.els.contrastBtn.addEventListener('click', () => this._toggleContrast());
    this.els.snapshotBtn.addEventListener('click', () => this._toggleSnapshot());
    this.els.calibrationBtn.addEventListener('click', () => this.calibration.start());
    this._bindTouchControls();
  }

  _renderPresets() {
    renderPresets(this.els.presetSelect, (preset) => {
      this._pendingPreset = preset;
      this.els.input.value = preset.expr || preset.name;
      if (preset.xMin !== undefined) this.els.xMin.value = preset.xMin;
      if (preset.xMax !== undefined) this.els.xMax.value = preset.xMax;
      this.nav.xMin = preset.xMin ?? -10;
      this.nav.xMax = preset.xMax ?? 10;
      // 保存参数调节预设信息
      if (preset.param) {
        this.nav.activePreset = preset;
        this.nav.paramValue = preset.paramValue;
        this.els.paramsDisplay?.classList.remove('hidden');
      } else {
        this.nav.activePreset = null;
        this.nav.paramValue = null;
      }
    });
  }

  // 主播放入口
  async _onPlay() {
    if (!this.audio.init()) {
      this._updateStatus('音频系统初始化失败。请检查浏览器是否支持 Web Audio API。');
      return;
    }

    const expr = this.els.input.value.trim();
    if (!expr) {
      this.speech.speakError('请先输入函数表达式');
      return;
    }

    // 检查是否是参数方程模式（来自预置选择）
    if (this._pendingPreset?.type === 'parametric' && this._pendingPreset.preset) {
      this._playParametric(this._pendingPreset.preset);
      this._pendingPreset = null;
      return;
    }
    this._pendingPreset = null;

    // 检测多表达式（分号分隔）
    const hasMultipleExprs = expr.includes(';');
    if (hasMultipleExprs) {
      this._onPlayMulti(expr);
      return;
    }

    // 编译单表达式
    const result = this.math.compile(expr);
    if (!result.success) {
      this.speech.speakError(`表达式有误：${result.error}。请检查后重试。`);
      this._updateStatus(`表达式错误：${result.error}`);
      return;
    }

    // 确认音
    this.sfx.confirm(this.audio.currentTime);

    // 读取范围
    const xMin = parseFloat(this.els.xMin.value) || -10;
    const xMax = parseFloat(this.els.xMax.value) || 10;
    this.nav.xMin = xMin;
    this.nav.xMax = xMax;

    // 分析函数
    const analyzeStart = performance.now();
    this.analysis = this.math.analyze(xMin, xMax);
    const analyzeTime = performance.now() - analyzeStart;

    // S21: 计算超过 1 秒时语音提示
    if (analyzeTime > 1000) {
      this.speech.speakAction('计算已完成');
    }
    const { points, yMin, yMax } = this.math.sample(xMin, xMax, 500);
    this.currentPoints = points;
    const pad = Math.max(1, (yMax - yMin) * 0.1);
    this.currentYRange = { yMin: yMin - pad, yMax: yMax + pad };

    // 更新可视化
    this._updateVisualization();

    // 感知协议：语音摘要 → 扫描
    const summary = this.math.generateSummary(xMin, xMax);
    this._updateStatus(summary);

    if (this.summaryEnabled) {
      this.state = 'summary';
      this.speech.speakSummary(summary, () => {
        this._startScan();
      });
    } else {
      this.state = 'scanning';
      this._startScan();
    }

    // 更新按钮状态
    this.els.playBtn.disabled = true;
    this.els.stopBtn.disabled = false;
  }

  _startScan() {
    const xMin = this.nav.xMin;
    const xMax = this.nav.xMax;
    const speed = this.els.speed.value;
    const durations = { fast: 2.5, normal: 5, slow: 10 };
    const duration = durations[speed] || 5;

    // 感知协议：先用快速扫描获得整体印象，再用正常速度感知细节
    const fastDuration = Math.min(2.5, duration * 0.4);
    this._scanPass = 0;

    this.state = 'scanning';

    const startFastScan = () => {
      this._scanPass = 1;
      this.scanner.play({
        xMin, xMax, duration: fastDuration,
        yMin: this.currentYRange.yMin,
        yMax: this.currentYRange.yMax,
        referenceTone: false,
        analysis: this.analysis,
        onProgress: (progress) => {
          this._updateScanLine(progress);
        },
        onComplete: () => {
          // 快扫结束，短暂间隔后开始正常扫描
          setTimeout(() => {
            if (this.state !== 'scanning') return;
            this._scanPass = 2;
            this.scanner.play({
              xMin, xMax, duration,
              yMin: this.currentYRange.yMin,
              yMax: this.currentYRange.yMax,
              referenceTone: this.nav.referenceTone,
              analysis: this.analysis,
              snapshotEngine: this._snapshotEngine || undefined,
              onProgress: (progress) => {
                this._updateScanLine(progress);
              },
              onComplete: () => {
                this.state = 'explore';
                this.els.playBtn.disabled = false;
                this.els.stopBtn.disabled = true;
                this.speech.speak('扫描完成，现在可以使用方向键自由探索。', { rate: 1.3 });
              },
              onSpecialPoint: (sp) => {
                this._onSpecialPoint(sp);
              }
            });
          }, 300);
        },
        onSpecialPoint: () => {} // 快扫不播放特殊点音效
      });
    };

    startFastScan();
  }

  // 多函数叠加播放
  _onPlayMulti(exprStr) {
    const result = this.math.compileMulti(exprStr);
    if (!result.success) {
      this.speech.speakError(`表达式有误：${result.error}`);
      this._updateStatus(`表达式错误：${result.error}`);
      return;
    }

    this.sfx.confirm(this.audio.currentTime);
    this._multiExprStr = exprStr;
    this._multiFocusIndex = 0;

    const xMin = parseFloat(this.els.xMin.value) || -10;
    const xMax = parseFloat(this.els.xMax.value) || 10;
    this.nav.xMin = xMin;
    this.nav.xMax = xMax;
    this.nav._multiEngines = this.math._compiledList.map(c => {
      const eng = new MathEngine();
      eng._compiled = c.compiled;
      eng._expression = c.expr;
      return eng;
    });

    const count = result.count;
    const summary = `正在播放 ${count} 个函数的叠加声觉化。按 Tab 键切换焦点曲线。`;
    this._updateStatus(summary);
    this.els.playBtn.disabled = true;
    this.els.stopBtn.disabled = false;
    this.state = 'scanning';

    if (this.summaryEnabled) {
      this.speech.speak(summary, { priority: true, onEnd: () => this._startMultiScan() });
    } else {
      this._startMultiScan();
    }
  }

  _startMultiScan() {
    const xMin = this.nav.xMin;
    const xMax = this.nav.xMax;
    const speed = this.els.speed.value;
    const durations = { fast: 2.5, normal: 5, slow: 10 };
    const duration = durations[speed] || 5;
    const engines = this.nav._multiEngines;
    const focusIndex = this._multiFocusIndex || 0;

    if (!engines || engines.length === 0) return;

    this.scanner.playMulti({
      engines,
      xMin, xMax, duration,
      focusIndex,
      onProgress: (progress) => this._updateScanLine(progress),
      onComplete: () => {
        this.state = 'explore';
        this.els.playBtn.disabled = false;
        this.els.stopBtn.disabled = true;
        this.speech.speak('多函数扫描完成。', { rate: 1.3 });
      }
    });
  }

  _onStop() {
    this.scanner.stop();
    this.speech.stop();
    this.state = 'idle';
    this.els.playBtn.disabled = false;
    this.els.stopBtn.disabled = true;
    this._updateStatus('已停止。按播放键重新开始。');
    this._updateVisualization();
  }

  // 参数方程播放
  _playParametric(preset) {
    if (!this.audio.init()) {
      this._updateStatus('音频系统初始化失败。');
      return;
    }
    this.sfx.confirm(this.audio.currentTime);

    this.els.playBtn.disabled = true;
    this.els.stopBtn.disabled = false;
    this.state = 'scanning';

    const durations = { fast: 2.5, normal: 5, slow: 10 };
    const duration = durations[this.els.speed.value] || 5;
    const displayName = exprToChinese(preset.name);

    this._updateStatus(`正在播放：${displayName}（参数方程）`);

    if (this.summaryEnabled) {
      this.speech.speak(`${displayName}，参数方程`, {
        priority: true,
        onEnd: () => this._startParametricScan(preset, duration)
      });
    } else {
      this._startParametricScan(preset, duration);
    }
  }

  _startParametricScan(preset, duration) {
    this.scanner.playParametric({
      xFn: preset.xFn,
      yFn: preset.yFn,
      tMin: preset.tMin,
      tMax: preset.tMax,
      duration,
      referenceTone: this.nav.referenceTone,
      onProgress: (progress) => this._updateScanLine(progress),
      onComplete: () => {
        this.state = 'explore';
        this.els.playBtn.disabled = false;
        this.els.stopBtn.disabled = true;
        this.speech.speakAction('扫描完成');
      }
    });
  }

  _onNavigatorChange(info) {
    if (info.action === 'playFrom') {
      this._onPlay();
      return;
    }
    if (info.action === 'toggleRef') {
      this.els.referenceBtn.textContent = `参考音：${info.value ? '开' : '关'}`;
      this.els.referenceBtn.setAttribute('aria-pressed', info.value);
      this._savePreferences();
      return;
    }
    if (info.action === 'switchFocus') {
      this._multiFocusIndex = info.focusIndex;
      if (this.state === 'explore' && this.nav._multiEngines) {
        this._startMultiScan();
      }
      return;
    }

    this._updateExplorationVisual(info);
  }

  _onRangeChange(xMin, xMax) {
    this.els.xMin.value = xMin.toFixed(1);
    this.els.xMax.value = xMax.toFixed(1);

    // 重新分析和采样
    if (this.math._compiled) {
      this.analysis = this.math.analyze(xMin, xMax);
      const { points, yMin, yMax } = this.math.sample(xMin, xMax, 500);
      this.currentPoints = points;
      const pad = Math.max(1, (yMax - yMin) * 0.1);
      this.currentYRange = { yMin: yMin - pad, yMax: yMax + pad };
      this._updateVisualization();
    }
  }

  _onDerivativeToggle(on) {
    this.els.derivativeBtn.textContent = `导数模式：${on ? '开' : '关'}`;
    this.els.derivativeBtn.setAttribute('aria-pressed', on);
  }

  _onParamChange(expr, param, value) {
    this.els.input.value = expr;
    if (this.els.paramsText) {
      this.els.paramsText.textContent = `${param} = ${value}`;
    }
    this.speech.speakAction(`${param} 等于 ${value}`);
    this._onPlay();
  }

  _toggleSummary() {
    this.summaryEnabled = !this.summaryEnabled;
    this.els.summaryBtn.textContent = `语音摘要：${this.summaryEnabled ? '开' : '关'}`;
    this.els.summaryBtn.setAttribute('aria-pressed', this.summaryEnabled);
    this.speech.speakAction(this.summaryEnabled ? '语音摘要已开启' : '语音摘要已关闭');
    this._savePreferences();
  }

  _onSpecialPoint(sp) {
    let msg = '';
    switch (sp.type) {
      case 'zero': msg = `经过零点`; break;
      case 'yAxis': msg = `经过y轴`; break;
      case 'max': msg = `极大值`; break;
      case 'min': msg = `极小值`; break;
      case 'asymptote': msg = `渐近线`; break;
      case 'undefined': msg = `无定义点`; break;
    }
    this._updateStatus(msg);
  }

  // 可视化更新方法
  _updateVisualization() {
    if (!this.viz || !this.currentPoints) return;
    this.viz.render({
      xMin: this.nav.xMin,
      xMax: this.nav.xMax,
      points: this.currentPoints,
      yMin: this.currentYRange.yMin,
      yMax: this.currentYRange.yMax,
      analysis: this.analysis,
    });
  }

  _updateScanLine(progress) {
    if (!this.viz) return;
    this.viz.render({
      xMin: this.nav.xMin,
      xMax: this.nav.xMax,
      points: this.currentPoints,
      yMin: this.currentYRange.yMin,
      yMax: this.currentYRange.yMax,
      analysis: this.analysis,
      scanProgress: progress,
    });
  }

  _updateExplorationVisual(info) {
    if (!this.viz || !this.currentPoints) return;
    this.viz.render({
      xMin: info.xMin ?? this.nav.xMin,
      xMax: info.xMax ?? this.nav.xMax,
      points: this.currentPoints,
      yMin: this.currentYRange.yMin,
      yMax: this.currentYRange.yMax,
      analysis: this.analysis,
      currentX: info.x,
    });

    // 更新 ARIA 状态
    if (this.els.cursorInfo && info.defined) {
      this.els.cursorInfo.textContent = `当前位置：x=${info.x.toFixed(2)}, y=${info.y?.toFixed(2)}`;
    }
  }

  _renderEmptyGraph() {
    if (!this.viz) return;
    this.viz.render({
      xMin: -10, xMax: 10,
      points: [],
      yMin: -5, yMax: 5,
      analysis: null,
    });
  }

  _updateStatus(text) {
    if (this.els.status) {
      this.els.status.textContent = text;
    }
  }

  _toggleContrast() {
    const isHC = document.body.classList.toggle('high-contrast');
    this.els.contrastBtn.setAttribute('aria-pressed', isHC);
    this.speech.speakAction(isHC ? '高对比度模式已开启' : '高对比度模式已关闭');
    this._savePreferences();
  }

  _toggleSnapshot() {
    if (this._snapshotEngine) {
      this._snapshotEngine = null;
      this.els.snapshotBtn.textContent = '保存参照';
      this.els.snapshotBtn.setAttribute('aria-pressed', false);
      this.speech.speakAction('参照函数已清除');
      return;
    }
    if (!this.math._compiled) {
      this.speech.speakError('请先播放一个函数，再保存为参照');
      return;
    }
    // 克隆当前引擎
    const snap = new MathEngine();
    snap._compiled = this.math._compiled;
    snap._expression = this.math._expression;
    this._snapshotEngine = snap;
    this.els.snapshotBtn.textContent = '清除参照';
    this.els.snapshotBtn.setAttribute('aria-pressed', true);
    this.speech.speakAction(`已保存 ${this.math._expression} 作为参照函数`);
  }

  _restoreCalibration() {
    try {
      const data = localStorage.getItem('mathSonification.calibration');
      if (data) {
        const { minFreq, maxFreq } = JSON.parse(data);
        if (minFreq && maxFreq) {
          this.audio.setFrequencyRange(minFreq, maxFreq);
        }
      }
    } catch {}
  }

  _restorePreferences() {
    try {
      const data = localStorage.getItem('mathSonification.preferences');
      if (!data) return;
      const prefs = JSON.parse(data);

      if (prefs.speed && this.els.speed) {
        this.els.speed.value = prefs.speed;
      }
      if (prefs.summaryEnabled !== undefined) {
        this.summaryEnabled = prefs.summaryEnabled;
        this.els.summaryBtn.textContent = `语音摘要：${this.summaryEnabled ? '开' : '关'}`;
        this.els.summaryBtn.setAttribute('aria-pressed', this.summaryEnabled);
      }
      if (prefs.referenceTone !== undefined) {
        this.nav.referenceTone = prefs.referenceTone;
        this.els.referenceBtn.textContent = `参考音：${prefs.referenceTone ? '开' : '关'}`;
        this.els.referenceBtn.setAttribute('aria-pressed', prefs.referenceTone);
      }
      if (prefs.highContrast) {
        document.body.classList.add('high-contrast');
        this.els.contrastBtn.setAttribute('aria-pressed', true);
      }
    } catch {}
  }

  _savePreferences() {
    const prefs = {
      speed: this.els.speed.value,
      summaryEnabled: this.summaryEnabled,
      referenceTone: this.nav.referenceTone,
      highContrast: document.body.classList.contains('high-contrast'),
    };
    try {
      localStorage.setItem('mathSonification.preferences', JSON.stringify(prefs));
    } catch {}
  }

  _bindTouchControls() {
    const panel = document.getElementById('touch-controls');
    if (!panel) return;
    const actions = {
      left: () => this.nav.stepBackward(),
      right: () => this.nav.stepForward(),
      up: () => this.nav.increaseStep(),
      down: () => this.nav.decreaseStep(),
      play: () => this._onPlay(),
      report: () => this.nav.reportCoordinate(),
      zero: () => this.nav.jumpToZero(),
      extrema: () => this.nav.jumpToExtrema(),
      zoomin: () => this.nav.zoomIn(),
      zoomout: () => this.nav.zoomOut(),
    };
    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = actions[btn.dataset.action];
      if (action) action();
    });
  }
}

// 启动
const app = new App();
app.init();

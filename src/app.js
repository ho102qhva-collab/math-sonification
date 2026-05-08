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

    // 状态
    this.state = 'idle'; // idle | summary | scanning | explore
    this.summaryEnabled = true;
    this.analysis = null;
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

    // 检查是否是首次使用
    if (!localStorage.getItem('mathSonification.visited')) {
      this.speech.speak(
        '欢迎使用数学声觉化工具。请输入一个函数表达式，或从预置函数库中选择一个函数开始探索。',
        { priority: true }
      );
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
  }

  _renderPresets() {
    renderPresets(this.els.presetSelect, (preset) => {
      this._pendingPreset = preset;
      this.els.input.value = preset.expr || preset.name;
      if (preset.xMin !== undefined) this.els.xMin.value = preset.xMin;
      if (preset.xMax !== undefined) this.els.xMax.value = preset.xMax;
      this.nav.xMin = preset.xMin ?? -10;
      this.nav.xMax = preset.xMax ?? 10;
    });
  }

  // 主播放入口
  async _onPlay() {
    // 初始化音频（需要用户交互触发）
    this.audio.init();

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

    // 编译表达式
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
    this.analysis = this.math.analyze(xMin, xMax);
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

    this.state = 'scanning';

    this.scanner.play({
      xMin, xMax, duration,
      yMin: this.currentYRange.yMin,
      yMax: this.currentYRange.yMax,
      referenceTone: this.nav.referenceTone,
      analysis: this.analysis,
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
    this.audio.init();
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
      // 从当前位置开始扫描
      this._onPlay();
      return;
    }
    if (info.action === 'toggleRef') {
      this.els.referenceBtn.textContent = `参考音：${info.value ? '开' : '关'}`;
      this.els.referenceBtn.setAttribute('aria-pressed', info.value);
      return;
    }

    // 更新当前探索位置的可视化
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

  _toggleSummary() {
    this.summaryEnabled = !this.summaryEnabled;
    this.els.summaryBtn.textContent = `语音摘要：${this.summaryEnabled ? '开' : '关'}`;
    this.els.summaryBtn.setAttribute('aria-pressed', this.summaryEnabled);
    this.speech.speakAction(this.summaryEnabled ? '语音摘要已开启' : '语音摘要已关闭');
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
}

// 启动
const app = new App();
app.init();

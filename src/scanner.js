// 扫描播放器：核心 sonification 引擎
// 从左到右扫描函数，实时调度所有音频参数和音效

export class Scanner {
  constructor(audioEngine, mathEngine, soundEffects) {
    this.audio = audioEngine;
    this.math = mathEngine;
    this.sfx = soundEffects;
    this._playing = false;
    this._scheduledNodes = [];
    this._currentPosition = 0; // 当前扫描位置 (0~1)
    this._abortController = null;
  }

  get isPlaying() {
    return this._playing;
  }

  get currentPosition() {
    return this._currentPosition;
  }

  // 停止所有播放
  stop() {
    this._playing = false;
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    for (const node of this._scheduledNodes) {
      try {
        if (node.osc) { node.osc.stop(); node.osc.disconnect(); }
        if (node.gain) node.gain.disconnect();
        if (node.panner) node.panner.disconnect();
        if (node.source) { node.source.stop(); node.source.disconnect(); }
      } catch { /* already stopped */ }
    }
    this._scheduledNodes = [];
  }

  // 主扫描播放
  // options: { xMin, xMax, duration, yMin, yMax, referenceTone, onProgress, onComplete, onSpecialPoint, analysis }
  play(options) {
    this.stop();

    const {
      xMin, xMax, duration,
      yMin: userYMin, yMax: userYMax,
      referenceTone = true,
      onProgress,
      onComplete,
      onSpecialPoint,
      analysis
    } = options;

    if (!this.math._compiled) return;

    this._playing = true;
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    // 确定采样密度和 y 范围
    const numSteps = Math.max(200, Math.ceil(duration * 100)); // 每秒约100步
    const { points, yMin: sampleYMin, yMax: sampleYMax } = this.math.sample(xMin, xMax, numSteps);

    // y 映射范围：考虑用户给定的范围或自动范围
    const yPad = Math.max(1, (sampleYMax - sampleYMin) * 0.1);
    let yMin, yMax;
    if (userYMin !== undefined && userYMax !== undefined) {
      yMin = userYMin;
      yMax = userYMax;
    } else {
      yMin = sampleYMin - yPad;
      yMax = sampleYMax + yPad;
    }

    // 限制 y 范围的极端情况
    const yRange = yMax - yMin;
    if (yRange < 1) {
      const mid = (yMax + yMin) / 2;
      yMin = mid - 1;
      yMax = mid + 1;
    }

    const now = this.audio.currentTime + 0.05; // 小缓冲确保调度安全
    const stepDuration = duration / numSteps;

    // 创建主旋律振荡器
    const melody = this.audio.createMelodyOsc();
    melody.osc.start(now);
    melody.osc.stop(now + duration + 1);
    this._scheduledNodes.push(melody);

    // 创建参考音（如果启用）
    let refTone = null;
    if (referenceTone) {
      refTone = this.audio.createReferenceTone();
      refTone.osc.start(now);
      refTone.osc.stop(now + duration + 1);
      this._scheduledNodes.push(refTone);
      refTone.gain.gain.setValueAtTime(0, now);
      refTone.gain.gain.linearRampToValueAtTime(0.08, now + 0.1);
    }

    // 预计算特殊点位置（用于音效调度）
    const specialPoints = this._buildSpecialPointSchedule(analysis, xMin, xMax, numSteps);

    // 记录上一个点的信息用于检测穿越
    let prevY = null;
    let prevDefined = false;

    // 调度每一步
    for (let i = 0; i < numSteps; i++) {
      if (signal.aborted) break;

      const p = points[i];
      const t = now + i * stepDuration;
      const progress = i / (numSteps - 1);

      if (p.defined) {
        const freq = this.audio.yToFrequency(p.y, yMin, yMax);
        const pan = this.audio.xToPan(p.x, xMin, xMax);

        // 音量基于斜率：平缓→安静，陡峭→响亮，形成呼吸感
        const { value: slope } = this.math.derivative(p.x);
        const normalizedSlope = Math.min(1, Math.abs(slope) / Math.max(1, yRange * 0.2));
        const slopeVolume = 0.2 + 0.8 * Math.pow(normalizedSlope, 0.6);

        // 波形基于正负
        const waveform = this.audio.getWaveformForY(p.y);

        // 调度参数
        this.audio.setFrequencySmooth(melody.osc, freq, t, stepDuration * 0.8);
        this.audio.setPanSmooth(melody.panner, pan, t, stepDuration * 0.8);
        this.audio.setGainSmooth(melody.gain, slopeVolume * 0.6, t, stepDuration * 0.5);
        this.audio.setWaveform(melody.osc, waveform, t);

        // 检测 y 值穿越零点 → 零点 click
        if (prevDefined && prevY !== null && prevY * p.y < 0) {
          this.sfx.zeroClick(t, p.x, xMin, xMax);
          if (onSpecialPoint) onSpecialPoint({ type: 'zero', x: p.x, y: 0 });
        }

        // 检测 x 穿越零 → y轴 thud
        if (i > 0 && points[i - 1].x < 0 && p.x >= 0) {
          this.sfx.yAxisThud(t);
          if (onSpecialPoint) onSpecialPoint({ type: 'yAxis', x: 0 });
        }
      } else {
        // 无定义点：音量归零
        this.audio.setGainSmooth(melody.gain, 0, t, stepDuration * 0.3);

        if (prevDefined && prevY !== null) {
          // 从有定义变为无定义
          if (Math.abs(prevY) > yRange * 2) {
            // 渐近线
            if (prevY > 0) {
              this.sfx.asymptotePositive(t);
            } else {
              this.sfx.asymptoteNegative(t);
            }
            if (onSpecialPoint) onSpecialPoint({ type: 'asymptote', x: p.x, direction: prevY > 0 ? '+' : '-' });
          } else {
            this.sfx.undefinedPoint(t);
            if (onSpecialPoint) onSpecialPoint({ type: 'undefined', x: p.x });
          }
        }
      }

      // 网格节拍：经过整数点
      const xFloor = Math.floor(p.x);
      const prevXFloor = i > 0 ? Math.floor(points[i - 1].x) : xFloor - 1;
      if (xFloor !== prevXFloor && p.defined) {
        if (Math.abs(p.x) < stepDuration * 2) {
          // 接近原点
          this.sfx.originTick(t);
        } else {
          this.sfx.gridTick(t, p.x, xMin, xMax);
        }
      }

      // 预计算的极值点音效
      for (const sp of specialPoints) {
        if (sp.stepIndex === i) {
          if (sp.type === 'max') {
            this.sfx.maxDing(t, sp.x, xMin, xMax);
          } else if (sp.type === 'min') {
            this.sfx.minDing(t, sp.x, xMin, xMax);
          } else if (sp.type === 'inflection') {
            this.sfx.inflection(t);
          }
          if (onSpecialPoint) onSpecialPoint(sp);
        }
      }

      prevY = p.defined ? p.y : null;
      prevDefined = p.defined;
    }

    // 结尾淡出
    const endTime = now + duration;
    this.audio.setGainSmooth(melody.gain, 0, endTime - 0.1, 0.1);
    if (refTone) {
      refTone.gain.gain.setTargetAtTime(0, endTime - 0.1, 0.05);
    }

    // 参照曲线：低音量 sawtooth 叠加
    if (options.snapshotEngine) {
      const snapEng = options.snapshotEngine;
      const { points: snapPoints } = snapEng.sample(xMin, xMax, numSteps);
      const snapVoice = this.audio.createOscillator('sawtooth');
      snapVoice.osc.start(now);
      snapVoice.osc.stop(now + duration + 1);
      this._scheduledNodes.push(snapVoice);

      for (let i = 0; i < numSteps; i++) {
        if (signal.aborted) break;
        const sp = snapPoints[i];
        const t = now + i * stepDuration;
        if (sp.defined) {
          const freq = this.audio.yToFrequency(sp.y, yMin, yMax);
          const pan = this.audio.xToPan(sp.x, xMin, xMax);
          this.audio.setFrequencySmooth(snapVoice.osc, freq, t, stepDuration * 0.8);
          this.audio.setPanSmooth(snapVoice.panner, pan, t, stepDuration * 0.8);
          this.audio.setGainSmooth(snapVoice.gain, 0.12, t, stepDuration * 0.5);
        } else {
          this.audio.setGainSmooth(snapVoice.gain, 0, t, stepDuration * 0.3);
        }
      }
      this.audio.setGainSmooth(snapVoice.gain, 0, endTime - 0.1, 0.1);
    }

    // 进度跟踪
    this._trackProgress(now, duration, signal, onProgress, onComplete);
  }

  // 将分析结果映射到采样步索引
  _buildSpecialPointSchedule(analysis, xMin, xMax, numSteps) {
    if (!analysis) return [];
    const schedule = [];
    const step = (xMax - xMin) / (numSteps - 1);

    for (const ext of analysis.extrema) {
      const idx = Math.round((ext.x - xMin) / step);
      if (idx >= 0 && idx < numSteps) {
        schedule.push({ stepIndex: idx, type: ext.type, x: ext.x, y: ext.y });
      }
    }

    for (const inf of (analysis.inflections || [])) {
      const idx = Math.round((inf.x - xMin) / step);
      if (idx >= 0 && idx < numSteps) {
        schedule.push({ stepIndex: idx, type: 'inflection', x: inf.x });
      }
    }

    return schedule;
  }

  // 使用 requestAnimationFrame 跟踪进度
  _trackProgress(startTime, duration, signal, onProgress, onComplete) {
    const update = () => {
      if (signal.aborted) return;

      const elapsed = this.audio.currentTime - startTime;
      const progress = Math.min(1, Math.max(0, elapsed / duration));
      this._currentPosition = progress;

      if (onProgress) onProgress(progress);

      if (progress >= 1) {
        this._playing = false;
        if (onComplete) onComplete();
        return;
      }

      requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }

  // 参数方程模式播放
  // options: { xFn, yFn, tMin, tMax, duration, referenceTone, onProgress, onComplete }
  playParametric(options) {
    this.stop();

    const {
      xFn, yFn,       // (t) => number 函数
      tMin = 0, tMax = 2 * Math.PI,
      duration = 5,
      referenceTone = true,
      onProgress, onComplete
    } = options;

    this._playing = true;
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    const numSteps = Math.max(200, Math.ceil(duration * 100));
    const stepDt = (tMax - tMin) / (numSteps - 1);

    // 采样计算范围
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    const points = [];
    for (let i = 0; i < numSteps; i++) {
      const t = tMin + i * stepDt;
      const x = xFn(t);
      const y = yFn(t);
      if (isFinite(x) && isFinite(y)) {
        xMin = Math.min(xMin, x);
        xMax = Math.max(xMax, x);
        yMin = Math.min(yMin, y);
        yMax = Math.max(yMax, y);
      }
      points.push({ x, y, defined: isFinite(x) && isFinite(y) });
    }

    // 确保范围有效
    const padX = Math.max(0.5, (xMax - xMin) * 0.1);
    const padY = Math.max(0.5, (yMax - yMin) * 0.1);
    xMin -= padX; xMax += padX;
    yMin -= padY; yMax += padY;

    const now = this.audio.currentTime + 0.05;
    const stepDuration = duration / numSteps;

    // 创建主旋律振荡器
    const melody = this.audio.createMelodyOsc();
    melody.osc.start(now);
    melody.osc.stop(now + duration + 1);
    this._scheduledNodes.push(melody);

    // 参考音
    let refTone = null;
    if (referenceTone) {
      refTone = this.audio.createReferenceTone();
      refTone.osc.start(now);
      refTone.osc.stop(now + duration + 1);
      this._scheduledNodes.push(refTone);
      refTone.gain.gain.setValueAtTime(0, now);
      refTone.gain.gain.linearRampToValueAtTime(0.08, now + 0.1);
    }

    // 调度每一步
    for (let i = 0; i < numSteps; i++) {
      if (signal.aborted) break;

      const p = points[i];
      const t = now + i * stepDuration;

      if (p.defined) {
        const freq = this.audio.yToFrequency(p.y, yMin, yMax);
        const pan = this.audio.xToPan(p.x, xMin, xMax);
        const waveform = this.audio.getWaveformForY(p.y);

        this.audio.setFrequencySmooth(melody.osc, freq, t, stepDuration * 0.8);
        this.audio.setPanSmooth(melody.panner, pan, t, stepDuration * 0.8);
        this.audio.setGainSmooth(melody.gain, 0.5, t, stepDuration * 0.5);
        this.audio.setWaveform(melody.osc, waveform, t);
      } else {
        this.audio.setGainSmooth(melody.gain, 0, t, stepDuration * 0.3);
      }
    }

    // 结尾淡出
    const endTime = now + duration;
    this.audio.setGainSmooth(melody.gain, 0, endTime - 0.1, 0.1);
    if (refTone) refTone.gain.gain.setTargetAtTime(0, endTime - 0.1, 0.05);

    this._trackProgress(now, duration, signal, onProgress, onComplete);
  }

  // 多函数叠加播放
  // options: { mathEngines[], xMin, xMax, duration, yMin, yMax, focusIndex, onProgress, onComplete, onSpecialPoint }
  playMulti(options) {
    this.stop();

    const {
      engines,       // MathEngine[] 每个已编译不同表达式
      xMin, xMax, duration,
      yMin: userYMin, yMax: userYMax,
      focusIndex = 0,
      onProgress, onComplete, onSpecialPoint
    } = options;

    this._playing = true;
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    const numSteps = Math.max(200, Math.ceil(duration * 100));
    const stepDuration = duration / numSteps;
    const now = this.audio.currentTime + 0.05;

    // 为每条曲线采样，计算统一 y 范围
    const allYValues = [];
    const curvesPoints = [];
    for (const eng of engines) {
      const { points, yMin: syMin, yMax: syMax } = eng.sample(xMin, xMax, numSteps);
      curvesPoints.push(points);
      for (const p of points) { if (p.defined) allYValues.push(p.y); }
    }

    let yMin, yMax;
    if (userYMin !== undefined && userYMax !== undefined) {
      yMin = userYMin; yMax = userYMax;
    } else if (allYValues.length > 10) {
      const sorted = [...allYValues].sort((a, b) => a - b);
      yMin = sorted[Math.floor(sorted.length * 0.05)];
      yMax = sorted[Math.ceil(sorted.length * 0.95) - 1];
    } else {
      yMin = allYValues.length ? Math.min(...allYValues) : -5;
      yMax = allYValues.length ? Math.max(...allYValues) : 5;
    }
    const pad = Math.max(1, (yMax - yMin) * 0.1);
    yMin -= pad; yMax += pad;
    if (yMax - yMin < 1) { const mid = (yMax + yMin) / 2; yMin = mid - 1; yMax = mid + 1; }

    // 波形分配：不同曲线用不同波形
    const waveforms = ['sine', 'triangle', 'square', 'sawtooth'];
    // 每条曲线创建独立振荡器
    const voices = [];
    for (let ci = 0; ci < engines.length; ci++) {
      const waveform = waveforms[ci % waveforms.length];
      const voice = this.audio.createOscillator(waveform);
      voice.osc.start(now);
      voice.osc.stop(now + duration + 1);
      this._scheduledNodes.push(voice);
      voices.push(voice);
    }

    // 为每条曲线调度参数
    for (let ci = 0; ci < engines.length; ci++) {
      const points = curvesPoints[ci];
      const voice = voices[ci];
      const isFocused = ci === focusIndex;
      const volume = isFocused ? 0.5 : 0.15;

      for (let i = 0; i < numSteps; i++) {
        if (signal.aborted) break;
        const p = points[i];
        const t = now + i * stepDuration;

        if (p.defined) {
          const freq = this.audio.yToFrequency(p.y, yMin, yMax);
          const pan = this.audio.xToPan(p.x, xMin, xMax);
          this.audio.setFrequencySmooth(voice.osc, freq, t, stepDuration * 0.8);
          this.audio.setPanSmooth(voice.panner, pan, t, stepDuration * 0.8);
          this.audio.setGainSmooth(voice.gain, volume, t, stepDuration * 0.5);
        } else {
          this.audio.setGainSmooth(voice.gain, 0, t, stepDuration * 0.3);
        }
      }

      // 结尾淡出
      this.audio.setGainSmooth(voice.gain, 0, now + duration - 0.1, 0.1);
    }

    // 交叉点检测：相邻曲线的 y 差值变号
    if (curvesPoints.length >= 2) {
      for (let ci = 0; ci < curvesPoints.length - 1; ci++) {
        const ptsA = curvesPoints[ci];
        const ptsB = curvesPoints[ci + 1];
        for (let i = 1; i < numSteps; i++) {
          if (signal.aborted) break;
          const a0 = ptsA[i - 1], a1 = ptsA[i];
          const b0 = ptsB[i - 1], b1 = ptsB[i];
          if (a0.defined && a1.defined && b0.defined && b1.defined) {
            const diff0 = a0.y - b0.y;
            const diff1 = a1.y - b1.y;
            if (diff0 * diff1 < 0) {
              const t = now + i * stepDuration;
              this.sfx.intersection(t);
              if (onSpecialPoint) {
                onSpecialPoint({ type: 'intersection', x: (a1.x + b1.x) / 2 });
              }
            }
          }
        }
      }
    }

    this._trackProgress(now, duration, signal, onProgress, onComplete);
  }
}

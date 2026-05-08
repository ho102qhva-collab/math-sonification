// 听力校准系统：测试用户可听频率范围，个性化频率映射
// 测试 6 个频率点，记录用户可听范围，调整 audio-engine 的映射区间

export class Calibration {
  constructor(audio, speech) {
    this.audio = audio;
    this.speech = speech;
    this._active = false;
    this._step = 0;
    this._results = [];

    // 测试频率：覆盖低→中→高频
    this.testFreqs = [220, 440, 660, 880, 1320, 1760];

    // DOM 引用
    this.els = {};
  }

  get active() { return this._active; }

  start() {
    this._cacheElements();
    if (!this.els.dialog) return;

    this._active = true;
    this._step = 0;
    this._results = [];
    this.els.dialog.classList.remove('hidden');
    this.els.progress.textContent = `第 1 步，共 ${this.testFreqs.length} 步`;
    this.els.freqDisplay.textContent = '';

    if (!this.audio.init()) {
      this.speech.speakError('音频系统初始化失败，无法进行校准');
      this.close();
      return;
    }

    this.speech.speak('开始听力校准。即将播放不同频率的测试音，听到按空格或"能听到"，听不到按"听不到"。', { priority: true });
    setTimeout(() => this._playCurrentFreq(), 2000);
  }

  close() {
    this._active = false;
    if (this.els.dialog) this.els.dialog.classList.add('hidden');
  }

  _cacheElements() {
    if (this.els.dialog) return;
    const $ = (id) => document.getElementById(id);
    this.els = {
      dialog: $('calibration-dialog'),
      body: $('calibration-body'),
      instruction: $('calibration-instruction'),
      progress: $('calibration-progress'),
      freqDisplay: $('calibration-freq-display'),
      hearBtn: $('btn-calibration-hear'),
      nohearBtn: $('btn-calibration-nohear'),
      replayBtn: $('btn-calibration-replay'),
      closeBtn: $('btn-calibration-close'),
    };

    if (this.els.hearBtn) this.els.hearBtn.addEventListener('click', () => this._onHear());
    if (this.els.nohearBtn) this.els.nohearBtn.addEventListener('click', () => this._onNoHear());
    if (this.els.replayBtn) this.els.replayBtn.addEventListener('click', () => this._playCurrentFreq());
    if (this.els.closeBtn) this.els.closeBtn.addEventListener('click', () => this.close());
  }

  _playCurrentFreq() {
    if (!this._active || this._step >= this.testFreqs.length) return;
    const freq = this.testFreqs[this._step];
    const now = this.audio.currentTime;

    const osc = this.audio.ctx.createOscillator();
    const gain = this.audio.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.1);
    gain.gain.setValueAtTime(0.4, now + 1.0);
    gain.gain.linearRampToValueAtTime(0, now + 1.5);

    osc.connect(gain);
    gain.connect(this.audio.masterGain);
    osc.start(now);
    osc.stop(now + 1.6);

    this.els.freqDisplay.textContent = `正在播放 ${Math.round(freq)} Hz`;
    this.speech.speak(`${Math.round(freq)} 赫兹`, { rate: 1.2 });
  }

  _onHear() {
    this._results.push({ freq: this.testFreqs[this._step], heard: true });
    this._advance();
  }

  _onNoHear() {
    this._results.push({ freq: this.testFreqs[this._step], heard: false });
    this._advance();
  }

  _advance() {
    this._step++;
    if (this._step >= this.testFreqs.length) {
      this._finish();
      return;
    }
    this.els.progress.textContent = `第 ${this._step + 1} 步，共 ${this.testFreqs.length} 步`;
    this.els.freqDisplay.textContent = '';
    setTimeout(() => this._playCurrentFreq(), 800);
  }

  _finish() {
    const heard = this._results.filter(r => r.heard);
    let minFreq = 220;
    let maxFreq = 1760;

    if (heard.length > 0) {
      minFreq = Math.min(...heard.map(r => r.freq));
      maxFreq = Math.max(...heard.map(r => r.freq));
    }

    // 确保范围合理
    if (maxFreq - minFreq < 200) {
      maxFreq = minFreq + 200;
    }

    // 保存校准结果
    const calibration = { minFreq, maxFreq, testedAt: Date.now() };
    try {
      localStorage.setItem('mathSonification.calibration', JSON.stringify(calibration));
    } catch {}

    // 应用校准
    this.audio.setFrequencyRange(minFreq, maxFreq);

    this.els.freqDisplay.textContent = `校准完成！您的可听范围：${minFreq}-${maxFreq} Hz`;
    this.speech.speak(
      `校准完成。您的可听频率范围是 ${minFreq} 到 ${maxFreq} 赫兹。已自动调整音频映射。`,
      { priority: true }
    );

    setTimeout(() => this.close(), 3000);
  }
}

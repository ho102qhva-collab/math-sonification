// Web Audio API 封装：所有声音的底层调度
// 核心原则：绝不产生爆音，所有参数变化必须平滑过渡

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this._initialized = false;
  }

  init() {
    if (this._initialized) {
      this.ctx.resume();
      return true;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.7;
      this.masterGain.connect(this.ctx.destination);
      this._initialized = true;
      return true;
    } catch (e) {
      console.error('AudioEngine 初始化失败:', e);
      return false;
    }
  }

  get available() {
    return this._initialized && this.ctx && this.ctx.state !== 'closed';
  }

  get currentTime() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // 对数频率映射：y 值 → 频率 (Hz)
  // 范围 C2(65Hz) ~ C7(2093Hz)，5 个八度，增强音高区分度
  // y=0 对应 C4(262Hz)
  yToFrequency(y, yMin = -5, yMax = 5) {
    const C2 = 65;
    const C7 = 2093;
    const normalized = (y - yMin) / (yMax - yMin);
    const clamped = Math.max(0, Math.min(1, normalized));
    const minLog = Math.log2(C2);
    const maxLog = Math.log2(C7);
    return Math.pow(2, minLog + clamped * (maxLog - minLog));
  }

  // x 值 → 立体声声像 (-1 全左, 0 中, +1 全右)
  xToPan(x, xMin = -10, xMax = 10) {
    const normalized = (x - xMin) / (xMax - xMin);
    return Math.max(-1, Math.min(1, normalized * 2 - 1));
  }

  // 创建一个平滑播放的振荡器节点组
  // 返回 { osc, gain, panner } — 调用者负责 stop/disconnect
  createOscillator(waveform = 'sine') {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();

    osc.type = waveform;
    gain.gain.value = 0;
    panner.pan.value = 0;

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);

    return { osc, gain, panner };
  }

  // 平滑设置频率（避免爆音）
  setFrequencySmooth(oscNode, freq, time, rampTime = 0.02) {
    if (!oscNode || !oscNode.frequency) return;
    freq = Math.max(20, Math.min(20000, freq)); // 安全边界
    oscNode.frequency.setTargetAtTime(freq, time, rampTime * 0.3);
  }

  // 平滑设置增益（避免爆音）
  setGainSmooth(gainNode, value, time, rampTime = 0.02) {
    if (!gainNode || !gainNode.gain) return;
    value = Math.max(0, Math.min(1, value));
    gainNode.gain.setTargetAtTime(value, time, rampTime * 0.3);
  }

  // 平滑设置声像
  setPanSmooth(pannerNode, value, time, rampTime = 0.02) {
    if (!pannerNode || !pannerNode.pan) return;
    value = Math.max(-1, Math.min(1, value));
    pannerNode.pan.setTargetAtTime(value, time, rampTime * 0.3);
  }

  // 播放一个短促的音效（tick, click 等）
  // 返回结束时间
  playTick(time, freq = 800, duration = 0.03, volume = 0.3, pan = 0) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();

    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.003);
    gain.gain.linearRampToValueAtTime(0, time + duration);
    panner.pan.value = pan;

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration + 0.01);
    return time + duration;
  }

  // 播放"叮"音效（极值点）
  playDing(time, ascending = true, volume = 0.4) {
    const baseFreq = ascending ? 1200 : 600;
    const endFreq = ascending ? 1600 : 400;
    const duration = 0.15;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, time);
    osc.frequency.linearRampToValueAtTime(endFreq, time + duration * 0.3);
    osc.frequency.linearRampToValueAtTime(baseFreq, time + duration);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.005);
    gain.gain.setTargetAtTime(0, time + duration * 0.6, duration * 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration + 0.2);
    return time + duration;
  }

  // 播放渐近线音效：音高快速升降后静音
  playAsymptote(time, positive = true, volume = 0.5) {
    const duration = 0.3;
    const startFreq = positive ? 500 : 500;
    const endFreq = positive ? 3000 : 80;
    const silenceDuration = 0.3;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.linearRampToValueAtTime(endFreq, time + duration * 0.8);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.01);
    gain.gain.setValueAtTime(volume, time + duration * 0.7);
    gain.gain.linearRampToValueAtTime(0, time + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration + silenceDuration + 0.1);
    return time + duration + silenceDuration;
  }

  // 跳跃不连续"咔嗒"声
  playClick(time, volume = 0.4) {
    const duration = 0.015;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.value = 2000;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.linearRampToValueAtTime(0, time + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration + 0.01);
    return time + duration;
  }

  // S09 拐点：短暂的音色闪烁（sine→triangle→sine 快速切换）
  playInflection(time, volume = 0.25) {
    const duration = 0.06;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.value = 700;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.005);
    gain.gain.linearRampToValueAtTime(0, time + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration + 0.01);
  }

  // S14 可去间断点：轻微的"缺口"提示音
  playRemovableDiscontinuity(time, volume = 0.15) {
    const duration = 0.04;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 1000;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.003);
    gain.gain.setValueAtTime(volume, time + duration * 0.3);
    gain.gain.linearRampToValueAtTime(0, time + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration + 0.01);
  }

  // 无定义点"空洞"音效（静噪声）
  playUndefined(time, volume = 0.2) {
    const duration = 0.08;
    // 用白噪声缓冲区
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.005);
    gain.gain.linearRampToValueAtTime(0, time + duration);

    source.connect(gain);
    gain.connect(this.masterGain);

    source.start(time);
    return time + duration;
  }

  // 播放确认音"嘀"
  playConfirm(time) {
    return this.playTick(time, 1000, 0.05, 0.2, 0);
  }

  // 书签确认音
  playBookmarkConfirm(time) {
    this.playTick(time, 880, 0.04, 0.25, 0);
    this.playTick(time + 0.06, 1100, 0.06, 0.25, 0);
    return time + 0.14;
  }

  // S16 交叉点：两个频率叠加的短暂和弦
  playIntersection(time, freq1 = 800, freq2 = 1200, volume = 0.3) {
    const duration = 0.1;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.value = freq1;
    osc2.type = 'sine';
    osc2.frequency.value = freq2;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.01);
    gain.gain.linearRampToValueAtTime(0, time + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(time);
    osc1.stop(time + duration + 0.01);
    osc2.start(time);
    osc2.stop(time + duration + 0.01);
  }

  // 创建参考音（持续的 C4 持续音）
  createReferenceTone() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 262; // C4
    gain.gain.value = 0;

    osc.connect(gain);
    gain.connect(this.masterGain);

    return { osc, gain };
  }

  // 面积音效：持续和弦，时长与面积成正比
  playAreaSound(area) {
    const absArea = Math.abs(area);
    const duration = Math.min(3, Math.max(0.3, Math.log2(absArea + 1) * 0.5));
    const now = this.currentTime;

    // 正面积用大三和弦，负面积用小三和弦
    const positive = area >= 0;
    const baseFreq = positive ? 440 : 415;
    const thirdFreq = positive ? baseFreq * 5 / 4 : baseFreq * 6 / 5;
    const fifthFreq = baseFreq * 3 / 2;

    for (const freq of [baseFreq, thirdFreq, fifthFreq]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gain.gain.setValueAtTime(0.15, now + duration - 0.1);
      gain.gain.linearRampToValueAtTime(0, now + duration);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + duration + 0.01);
    }
  }

  // S18 坐标系切换音效：升调=放大，降调=缩小
  playZoomSound(zoomIn) {
    const now = this.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const startFreq = zoomIn ? 600 : 800;
    const endFreq = zoomIn ? 900 : 500;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.linearRampToValueAtTime(endFreq, now + 0.12);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  // 创建主旋律振荡器
  createMelodyOsc() {
    return this.createOscillator('sine');
  }

  // 切换波形类型（正值/负值音色切换）
  setWaveform(oscNode, type, time) {
    oscNode.type = type;
  }

  // 获取 y>0 和 y<0 对应的波形类型
  getWaveformForY(y) {
    return y >= 0 ? 'sine' : 'sawtooth';
  }

  // 全局静音
  mute() {
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
    }
  }

  // 全局恢复
  unmute() {
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0.7, this.ctx.currentTime, 0.01);
    }
  }

  // 停止所有声音（硬停止）
  stopAll() {
    if (!this.ctx) return;
    this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.005);
    setTimeout(() => {
      if (this.ctx.state !== 'closed') {
        this.masterGain.gain.setTargetAtTime(0.7, this.ctx.currentTime, 0.005);
      }
    }, 50);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend();
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
}

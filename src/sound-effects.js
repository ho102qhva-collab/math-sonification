// 音效管理器：统筹所有特殊点音效的触发时机
// S01-S22 全部音效定义

export class SoundEffects {
  constructor(audioEngine) {
    this.audio = audioEngine;
  }

  static _vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch {}
  }

  // S01 操作确认音
  confirm(time) {
    return this.audio.playConfirm(time);
  }

  // S02 网格节拍（x轴整数点）
  gridTick(time, x, xMin, xMax) {
    const pan = this.audio.xToPan(x, xMin, xMax);
    this.audio.playTick(time, 600, 0.02, 0.15, pan);
  }

  // S03 原点节拍（x=0，区别于普通节拍）
  originTick(time) {
    this.audio.playTick(time, 900, 0.04, 0.25, 0);
  }

  // S05 零点 click
  zeroClick(time, x, xMin, xMax) {
    const pan = this.audio.xToPan(x, xMin, xMax);
    this.audio.playTick(time, 1400, 0.025, 0.35, pan);
    SoundEffects._vibrate(30);
  }

  // S06 y轴 thud（x过零）
  yAxisThud(time) {
    this.audio.playTick(time, 200, 0.06, 0.3, 0);
  }

  // S07 极大值"叮"
  maxDing(time, x, xMin, xMax) {
    this.audio.playDing(time, true, 0.4);
    SoundEffects._vibrate([20, 30, 20]);
  }

  // S08 极小值"叮"
  minDing(time, x, xMin, xMax) {
    this.audio.playDing(time, false, 0.4);
    SoundEffects._vibrate([40]);
  }

  // S10 正无穷渐近
  asymptotePositive(time) {
    this.audio.playAsymptote(time, true, 0.5);
  }

  // S11 负无穷渐近
  asymptoteNegative(time) {
    this.audio.playAsymptote(time, false, 0.5);
  }

  // S12 跳跃不连续
  jumpDiscontinuity(time) {
    this.audio.playClick(time, 0.5);
  }

  // S09 拐点音色变化
  inflection(time) {
    this.audio.playInflection(time);
  }

  // S14 可去间断点
  removableDiscontinuity(time) {
    this.audio.playRemovableDiscontinuity(time);
  }

  // S13 无定义点
  undefinedPoint(time) {
    this.audio.playUndefined(time, 0.25);
  }

  // S17 书签确认
  bookmarkConfirm(time) {
    this.audio.playBookmarkConfirm(time);
  }

  // S15 溢出音效（y值超出映射范围）
  overflow(time, positive, x, xMin, xMax) {
    const pan = this.audio.xToPan(x, xMin, xMax);
    const freq = positive ? 1800 : 300;
    this.audio.playTick(time, freq, 0.04, 0.2, pan);
  }

  // S16 交叉点音效
  intersection(time) {
    this.audio.playIntersection(time, 800, 1200, 0.3);
    SoundEffects._vibrate([15, 15, 15, 15, 15]);
  }
}

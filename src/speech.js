// 语音系统：优先使用浏览器中的微软小小语音，备选 Edge TTS WebSocket
// 在 Edge 浏览器中可直接获取 Xiaoxiao Natural 语音

const EDGE_TTS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';

export class Speech {
  constructor() {
    this._speaking = false;
    this._audioCtx = null;
    this._currentSource = null;
    this._queue = [];
    this._mode = 'webspeech'; // 'webspeech' | 'edgetts'
    this._voice = null;
    this._targetRate = 3.0;

    this.synth = window.speechSynthesis;
    this._initVoice();
  }

  _initVoice() {
    const select = () => {
      const voices = this.synth.getVoices();
      // 优先级：小小 Natural > 微软中文女声 > 任何中文语音
      this._voice =
        voices.find(v => /xiaoxiao.*natural/i.test(v.name)) ||
        voices.find(v => /xiaoxiao/i.test(v.name)) ||
        voices.find(v => /microsoft.*zh.*online/i.test(v.name)) ||
        voices.find(v => /microsoft.*zh/i.test(v.name) && /female/i.test(v.name)) ||
        voices.find(v => /zh-cn/i.test(v.lang)) ||
        voices.find(v => /zh/i.test(v.lang)) ||
        null;

      if (this._voice) {
        this._mode = 'webspeech';
        // Natural 语音支持更高语速
        this._targetRate = /natural/i.test(this._voice.name) ? 3.0 : 2.0;
      } else {
        // 没有中文语音 → 尝试 Edge TTS WebSocket
        this._mode = 'edgetts';
        this._targetRate = 3.0;
      }
    };

    select();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = select;
    }
  }

  _getAudioCtx() {
    if (!this._audioCtx) this._audioCtx = new AudioContext();
    return this._audioCtx;
  }

  get isSpeaking() { return this._speaking; }

  speak(text, options = {}) {
    const { priority = false, rate, onEnd } = options;
    if (priority) {
      this._cancelCurrent();
      this._queue = [];
    }
    if (this._speaking && !priority) {
      this._queue.push({ text, options });
      return;
    }
    this._speaking = true;
    const actualRate = rate ?? this._targetRate;

    if (this._mode === 'webspeech') {
      this._speakWebspeech(text, actualRate, onEnd);
    } else {
      this._speakEdgeTTS(text, actualRate, onEnd);
    }
  }

  _speakWebspeech(text, rate, onEnd) {
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'zh-CN';
    utt.rate = rate;
    utt.volume = 1;
    utt.pitch = 1;
    if (this._voice) utt.voice = this._voice;

    utt.onend = () => { this._speaking = false; if (onEnd) onEnd(); this._drain(); };
    utt.onerror = () => { this._speaking = false; this._drain(); };
    this.synth.speak(utt);
  }

  async _speakEdgeTTS(text, rate, onEnd) {
    try {
      const pctRate = Math.round(rate * 100 - 100);
      const audio = await this._fetchEdgeAudio(text, `+${pctRate}%`);
      await this._playAudioBuffer(audio);
    } catch (e) {
      console.warn('Edge TTS 失败:', e.message);
      // 最终回退：用浏览器默认语音
      this._speakWebspeech(text, Math.min(rate, 2.0), onEnd);
      return;
    }
    this._speaking = false;
    if (onEnd) onEnd();
    this._drain();
  }

  _fetchEdgeAudio(text, rateStr) {
    return new Promise((resolve, reject) => {
      const uuid = crypto.randomUUID();
      const ws = new WebSocket(
        `${EDGE_TTS_URL}?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=${uuid}`
      );
      const chunks = [];

      ws.binaryType = 'arraybuffer';
      ws.onopen = () => {
        ws.send(
          `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
          `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`
        );
        const reqId = crypto.randomUUID();
        const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>` +
          `<voice name='zh-CN-XiaoxiaoNeural'><prosody rate='${rateStr}'>${this._esc(text)}</prosody></voice></speak>`;
        ws.send(`X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`);
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          if (ev.data.includes('Path:turn.end')) ws.close();
        } else {
          const d = new Uint8Array(ev.data);
          const start = this._findMP3(d);
          if (start >= 0) chunks.push(d.slice(start));
        }
      };

      ws.onclose = () => {
        if (!chunks.length) { reject(new Error('无音频')); return; }
        const total = chunks.reduce((s, c) => s + c.length, 0);
        const buf = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) { buf.set(c, off); off += c.length; }
        resolve(buf.buffer);
      };
      ws.onerror = () => reject(new Error('WS 连接失败'));
      setTimeout(() => { try { ws.close(); } catch {} if (!chunks.length) reject(new Error('超时')); }, 8000);
    });
  }

  _playAudioBuffer(ab) {
    return new Promise((resolve, reject) => {
      const ctx = this._getAudioCtx();
      ctx.decodeAudioData(ab, buf => {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        this._currentSource = src;
        src.onended = () => { this._currentSource = null; resolve(); };
        src.start(0);
      }, reject);
    });
  }

  _findMP3(d) {
    for (let i = 0; i < Math.min(d.length - 1, 128); i++) {
      if (d[i] === 0xFF && (d[i + 1] & 0xE0) === 0xE0) return i;
    }
    return -1;
  }

  _esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  _cancelCurrent() {
    if (this._currentSource) { try { this._currentSource.stop(); } catch {} this._currentSource = null; }
    this.synth.cancel();
  }

  _drain() {
    if (this._queue.length && !this._speaking) {
      const { text, options } = this._queue.shift();
      this.speak(text, options);
    }
  }

  stop() { this._queue = []; this._cancelCurrent(); this._speaking = false; }

  speakCoordinate(x, y, defined = true) {
    this.speak(!defined ? `x等于${x.toFixed(2)}，该点无定义` : `x等于${x.toFixed(2)}，y等于${y.toFixed(2)}`, { priority: true });
  }

  speakSummary(text, onEnd) {
    this.speak(text, { priority: true, rate: this._targetRate * 0.85, onEnd });
  }

  speakError(msg) { this.speak(msg, { priority: true }); }
  speakAction(text) { this.speak(text, { priority: true }); }
  updateStatus(el, text) { if (el) el.textContent = text; }
}

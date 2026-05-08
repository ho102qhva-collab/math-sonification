// 自测模块：播放 sonification 后出题验证理解

export class SelfTest {
  constructor(app) {
    this.app = app;
    this.currentQuestion = null;
    this.score = 0;
    this.total = 0;
  }

  start() {
    this.score = 0;
    this.total = 0;
    this.app.els.selftestDialog.classList.remove('hidden');
    this._nextQuestion();
  }

  close() {
    this.app.els.selftestDialog.classList.add('hidden');
    this.currentQuestion = null;
  }

  _nextQuestion() {
    const question = this._generateQuestion();
    this.currentQuestion = question;
    this.total++;

    this.app.els.selftestBody.innerHTML = `
      <p>请先听一下这个函数的声音：</p>
      <p><strong>${question.displayExpr}</strong></p>
      <button id="btn-selftest-play" aria-label="播放函数声音">播放函数</button>
      <p style="margin-top:1rem">${question.question}</p>
      <div id="selftest-options">
        ${question.options.map((opt, i) => `
          <button class="selftest-option" data-index="${i}" aria-label="选项 ${String.fromCharCode(65 + i)}：${opt}">
            ${String.fromCharCode(65 + i)}. ${opt}
          </button>
        `).join('')}
      </div>
      <p id="selftest-result" aria-live="polite"></p>
      <p id="selftest-score">得分：${this.score} / ${this.total - 1}</p>
    `;

    // 绑定事件
    document.getElementById('btn-selftest-play')?.addEventListener('click', () => {
      this.app.audio.init();
      this.app.els.input.value = question.expr;
      if (question.xMin) this.app.els.xMin.value = question.xMin;
      if (question.xMax) this.app.els.xMax.value = question.xMax;
      this.app.nav.xMin = question.xMin ?? -10;
      this.app.nav.xMax = question.xMax ?? 10;
      this.app._onPlay();
    });

    document.querySelectorAll('.selftest-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        this._checkAnswer(idx);
      });
    });

    // 语音播报问题
    this.app.speech.speak(
      `自测题：函数 ${question.displayExpr}。${question.question}`,
      { priority: true }
    );
  }

  _checkAnswer(selectedIndex) {
    const correct = this.currentQuestion.correctIndex === selectedIndex;
    if (correct) this.score++;

    const resultEl = document.getElementById('selftest-result');
    const scoreEl = document.getElementById('selftest-score');

    if (resultEl) {
      resultEl.textContent = correct
        ? `正确！${this.currentQuestion.explanation}`
        : `不对。正确答案是 ${String.fromCharCode(65 + this.currentQuestion.correctIndex)}。${this.currentQuestion.explanation}`;
      resultEl.style.color = correct ? '#81c784' : '#e57373';
    }
    if (scoreEl) {
      scoreEl.textContent = `得分：${this.score} / ${this.total}`;
    }

    this.app.speech.speak(
      correct ? '回答正确！' : `不对。正确答案是 ${String.fromCharCode(65 + this.currentQuestion.correctIndex)}。${this.currentQuestion.explanation}`,
      { priority: true }
    );

    // 高亮正确答案
    document.querySelectorAll('.selftest-option').forEach((btn, i) => {
      if (i === this.currentQuestion.correctIndex) {
        btn.style.background = '#81c784';
      } else if (i === selectedIndex && !correct) {
        btn.style.background = '#e57373';
      }
      btn.disabled = true;
    });
  }

  submitAnswer() {
    // 生成下一题
    this._nextQuestion();
  }

  _generateQuestion() {
    const templates = [
      {
        expr: 'x^2 - 4',
        displayExpr: 'y = x² - 4',
        xMin: -5, xMax: 5,
        question: '这个函数有几个零点？',
        options: ['1个', '2个', '3个', '0个'],
        correctIndex: 1,
        explanation: 'y = x² - 4 = (x+2)(x-2)，有两个零点 x = -2 和 x = 2。'
      },
      {
        expr: 'sin(x)',
        displayExpr: 'y = sin(x)',
        xMin: -7, xMax: 7,
        question: 'sin(x) 是奇函数还是偶函数？',
        options: ['奇函数（关于原点对称）', '偶函数（关于y轴对称）', '都不是'],
        correctIndex: 0,
        explanation: 'sin(-x) = -sin(x)，所以 sin(x) 是奇函数。'
      },
      {
        expr: 'x^3 - 3*x',
        displayExpr: 'y = x³ - 3x',
        xMin: -3, xMax: 3,
        question: '这个函数有几个极值点？',
        options: ['1个', '2个', '3个', '0个'],
        correctIndex: 1,
        explanation: 'f\'(x) = 3x² - 3 = 0，x = ±1，有一个极大值和一个极小值。'
      },
      {
        expr: 'exp(-x^2)',
        displayExpr: 'y = e^(-x²)',
        xMin: -3, xMax: 3,
        question: '这个函数在 x=0 处是什么？',
        options: ['极小值', '极大值', '零点', '无定义'],
        correctIndex: 1,
        explanation: 'e^(-x²) 在 x=0 处取得最大值 1，是一个钟形曲线（高斯函数）。'
      },
      {
        expr: '1/x',
        displayExpr: 'y = 1/x',
        xMin: -5, xMax: 5,
        question: '这个函数在 x=0 处有什么特征？',
        options: ['零点', '极值点', '垂直渐近线', '水平渐近线'],
        correctIndex: 2,
        explanation: '1/x 在 x=0 处趋向无穷，有一条垂直渐近线。'
      },
      {
        expr: 'abs(x)',
        displayExpr: 'y = |x|',
        xMin: -5, xMax: 5,
        question: '这个函数在 x=0 处有什么特征？',
        options: ['零点', '极小值', '极大值', '不连续点'],
        correctIndex: 1,
        explanation: '|x| 在 x=0 处取得最小值 0，且在该点不可导（有一个"尖角"）。'
      },
      {
        expr: 'cos(x)',
        displayExpr: 'y = cos(x)',
        xMin: -7, xMax: 7,
        question: 'cos(x) 与 sin(x) 的关系是什么？',
        options: ['完全相同', 'cos(x) = sin(x + π/2)，相位差 π/2', '互为倒数', '没有关系'],
        correctIndex: 1,
        explanation: 'cos(x) = sin(x + π/2)，两个函数形状相同，但 cos(x) 向左平移了 π/2。'
      }
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }
}

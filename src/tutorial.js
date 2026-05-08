// 教学引导系统：10 课渐进式教学

export class TutorialSystem {
  constructor(app) {
    this.app = app;
    this.currentLesson = 0;
    this.lessons = this._buildLessons();
  }

  _buildLessons() {
    return [
      {
        title: '第1课：水平线 — 不变的音高',
        body: `<p>我们将从最简单的函数开始：<strong>y = 1</strong>（一条水平线）。</p>
          <p>听的时候注意：音高从头到尾保持不变，就像一个持续的"嘟——"声。这就是水平线的声音。</p>
          <p>准备好了吗？点击"下一步"开始播放。</p>`,
        expr: '1',
        xMin: -5, xMax: 5,
        speed: 'normal'
      },
      {
        title: '第2课：正比例函数 — 上升的音高',
        body: `<p>现在来看 <strong>y = x</strong>（一条从左下到右上的直线）。</p>
          <p>你会听到：音高从低到高均匀上升。左边（左耳）音高低，右边（右耳）音高高。这就是"递增函数"的声音。</p>
          <p>注意：音高在正中间时恰好是参考音（中央C），这表示 y = 0，也就是经过了坐标原点。</p>`,
        expr: 'x',
        xMin: -5, xMax: 5,
        speed: 'normal'
      },
      {
        title: '第3课：反向直线 — 下降的音高',
        body: `<p><strong>y = -x</strong> 是一条从左上到右下的直线。</p>
          <p>与上一课对比：音高从高到低均匀下降。这就是"递减函数"的声音。注意音色：y 为负时音色更粗糙（锯齿波）。</p>`,
        expr: '-x',
        xMin: -5, xMax: 5,
        speed: 'normal'
      },
      {
        title: '第4课：抛物线 — 先降后升',
        body: `<p><strong>y = x²</strong> 是一条抛物线。</p>
          <p>你会听到：音高先降到最低（在 x=0 处，也就是原点），然后对称地升回去。这就是抛物线"先降后升"的特征。</p>
          <p>在最低点，你会听到一个"降调叮"——这标记了一个极小值点。</p>`,
        expr: 'x^2',
        xMin: -4, xMax: 4,
        speed: 'normal'
      },
      {
        title: '第5课：认识网格节拍',
        body: `<p>我们来学习<strong>网格节拍</strong>。</p>
          <p>当扫描经过 x 轴上的整数点（x=..., -2, -1, 0, 1, 2, ...）时，你会听到轻微的"嗒"声。这帮你感知当前位置的 x 坐标。</p>
          <p>当经过 x=0（原点）时，节拍声会略有不同（频率更高）。试着数一数节拍来估算坐标位置。</p>`,
        expr: 'sin(x)',
        xMin: -7, xMax: 7,
        speed: 'slow'
      },
      {
        title: '第6课：零点与极值音效',
        body: `<p>函数 <strong>y = x³ - 3x</strong> 有三个零点和两个极值。</p>
          <ul>
            <li>经过零点时：听到短促的高频"嘀"声</li>
            <li>经过极大值时：升调"叮"</li>
            <li>经过极小值时：降调"叮"</li>
          </ul>
          <p>试着辨认这三种音效出现的时刻。</p>`,
        expr: 'x^3 - 3*x',
        xMin: -3, xMax: 3,
        speed: 'normal'
      },
      {
        title: '第7课：周期函数 — 重复的旋律',
        body: `<p><strong>y = sin(x)</strong> 是最经典的周期函数。</p>
          <p>你会听到音高上上下下、不断重复——就像一段循环播放的旋律。每次"上上下下"就是一个完整周期（2π ≈ 6.28）。</p>
          <p>试着数一数：在这个范围内能听到几个完整的周期？</p>`,
        expr: 'sin(x)',
        xMin: -7, xMax: 7,
        speed: 'slow'
      },
      {
        title: '第8课：导数模式 — 变化的变化',
        body: `<p>现在开启<strong>导数模式</strong>（按 D 键或点击导数按钮）。</p>
          <p>导数模式播放的是 f'(x) 而不是 f(x)：</p>
          <ul>
            <li>音高在参考音上方 → 原函数递增</li>
            <li>音高在参考音下方 → 原函数递减</li>
            <li>音高经过参考音 → 原函数有极值</li>
          </ul>
          <p>我们用 y = x² 来感受：导数是 y = 2x，所以音高从低到高直线上升。</p>`,
        expr: 'x^2',
        xMin: -4, xMax: 4,
        speed: 'normal',
        derivativeMode: true
      },
      {
        title: '第9课：函数变换对比',
        body: `<p><strong>y = sin(x - π/2)</strong> 是 sin(x) 向右平移了 π/2。</p>
          <p>如果同时播放原始 sin(x) 和变换后的函数，你会听出"同样的旋律但晚了一拍"——这就是相位平移的听觉化。</p>
          <p>自己感受一下：这个函数和第7课的 sin(x) 有什么不同？</p>`,
        expr: 'sin(x - pi/2)',
        xMin: -7, xMax: 7,
        speed: 'normal'
      },
      {
        title: '第10课：渐近线与不连续',
        body: `<p><strong>y = 1/x</strong> 在 x=0 处有垂直渐近线。</p>
          <p>你会听到：</p>
          <ul>
            <li>从左边接近 x=0 时，音高极速下降</li>
            <li>突然静音——这表示函数值趋向负无穷</li>
            <li>从右边开始，音高从极高处急速下降——表示趋向正无穷后恢复正常</li>
          </ul>
          <p>这种"音高骤变+静音"就是渐近线的声音。</p>`,
        expr: '1/x',
        xMin: -5, xMax: 5,
        speed: 'slow'
      }
    ];
  }

  start() {
    this.currentLesson = 0;
    this._showLesson();
    this.app.els.tutorialDialog.classList.remove('hidden');
  }

  nextStep() {
    const lesson = this.lessons[this.currentLesson];

    // 播放当前课的函数
    this.app.audio.init();
    this.app.els.input.value = lesson.expr;
    if (lesson.xMin !== undefined) this.app.els.xMin.value = lesson.xMin;
    if (lesson.xMax !== undefined) this.app.els.xMax.value = lesson.xMax;
    if (lesson.speed) this.app.els.speed.value = lesson.speed;

    // 编译并播放
    const result = this.app.math.compile(lesson.expr);
    if (result.success) {
      // 设置导数模式
      if (lesson.derivativeMode && !this.app.nav.derivativeMode) {
        this.app.nav.derivativeMode = true;
        this.app.els.derivativeBtn.textContent = '导数模式：开';
        this.app.els.derivativeBtn.setAttribute('aria-pressed', 'true');
      } else if (!lesson.derivativeMode && this.app.nav.derivativeMode) {
        this.app.nav.derivativeMode = false;
        this.app.els.derivativeBtn.textContent = '导数模式：关';
        this.app.els.derivativeBtn.setAttribute('aria-pressed', 'false');
      }

      this.app.nav.xMin = lesson.xMin ?? -10;
      this.app.nav.xMax = lesson.xMax ?? 10;
      this.app._onPlay();
    }

    // 前进到下一课
    if (this.currentLesson < this.lessons.length - 1) {
      this.currentLesson++;
      this._showLesson();
    } else {
      this.app.els.tutorialNext.textContent = '完成教学';
      this.close();
      this.app.speech.speak('恭喜完成全部教学课程！你现在可以自由探索任何函数了。', { priority: true });
    }
  }

  close() {
    this.app.els.tutorialDialog.classList.add('hidden');
    this.app.els.tutorialNext.textContent = '下一步';
  }

  _showLesson() {
    const lesson = this.lessons[this.currentLesson];
    this.app.els.tutorialTitle.textContent = lesson.title;
    this.app.els.tutorialBody.innerHTML = lesson.body;
    this.app.speech.speak(`${lesson.title}。${lesson.body.replace(/<[^>]+>/g, '')}`, { priority: true, rate: 1.0 });
  }
}

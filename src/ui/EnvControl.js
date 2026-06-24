// ============================================================
// ui/EnvControl.js — 时段 + 天气控制面板
//
// 右上角浮动小面板:
//   - 滑块:一天 24h(0~24)
//   - 播放/暂停:控制时间自动循环
//   - 4 个天气按钮:晴 / 雪 / 雨 / 雾
//   - 当前时段文字
// ============================================================

export class EnvControl {
  /**
   * @param {Object} opts
   * @param {Object} opts.timeOfDay - TimeOfDay 实例
   * @param {Object} opts.weather   - Weather 实例
   * @param {Object} opts.scene     - THREE.Scene(用来 applyFog)
   * @param {Object} [opts.snowAccum] - SnowAccumulation 实例(可选)
   */
  constructor({ timeOfDay, weather, scene, snowAccum }) {
    this.timeOfDay = timeOfDay;
    this.weather = weather;
    this.scene = scene;
    this.snowAccum = snowAccum;

    this._build();
  }

  _build() {
    const root = document.createElement('div');
    root.className = 'env-control';
    root.innerHTML = `
      <button class="env-toggle-collapse" id="env-collapse" type="button">
        <span>⛰  山中时辰</span>
        <span class="env-badge" id="env-badge">17.3 时</span>
      </button>
      <div class="env-content">
        <div class="env-row">
          <span class="env-label" id="env-phase">—</span>
          <button class="env-btn-toggle" id="env-toggle" type="button">⏸</button>
        </div>
        <div class="env-row">
          <input type="range" min="0" max="24" step="0.1" value="17.3" id="env-time" class="env-slider" />
          <span class="env-hour" id="env-hour">17.3 时</span>
        </div>
        <div class="env-row env-weather">
          <button class="env-wbtn" data-w="clear" type="button">☀ 晴</button>
          <button class="env-wbtn active" data-w="snow" type="button">❄ 雪</button>
          <button class="env-wbtn" data-w="rain" type="button">🌧 雨</button>
          <button class="env-wbtn" data-w="fog" type="button">🌫 雾</button>
        </div>
        ${this.snowAccum ? `
        <div class="env-divider">❄  积雪</div>
        <div class="env-row">
          <div class="env-snow-bar"><div class="env-snow-fill" id="env-snow-fill"></div></div>
          <span class="env-snow-pct" id="env-snow-pct">0%</span>
        </div>
        <div class="env-row env-snow-btns">
          <button class="env-sbtn" id="env-snow-faster" type="button">⏩ 加速</button>
          <button class="env-sbtn" id="env-snow-reset" type="button">🧹 清雪</button>
          <button class="env-sbtn" id="env-snow-max" type="button">❄ 满雪</button>
        </div>
        ` : ''}
      </div>
    `;
    document.body.appendChild(root);
    this.root = root;

    // 元素
    this.phaseEl = root.querySelector('#env-phase');
    this.hourEl = root.querySelector('#env-hour');
    this.badgeEl = root.querySelector('#env-badge');
    this.sliderEl = root.querySelector('#env-time');
    this.toggleEl = root.querySelector('#env-toggle');
    this.collapseBtn = root.querySelector('#env-collapse');

    // 折叠/展开
    this.collapseBtn.addEventListener('click', () => {
      root.classList.toggle('collapsed');
      const isCollapsed = root.classList.contains('collapsed');
      // 折叠时 badge 实时显示当前时段文字
      this.collapseBtn.querySelector('span:first-child').textContent =
        isCollapsed ? '⛰  山中时辰 ▸' : '⛰  山中时辰 ▾';
    });

    // 滑块
    this.sliderEl.addEventListener('input', (e) => {
      const h = parseFloat(e.target.value);
      this.timeOfDay.setHour(h);
      this.timeOfDay.pause();
      this.toggleEl.textContent = '▶';
      this._updateUI();
    });

    // 播放/暂停
    this.toggleEl.addEventListener('click', () => {
      if (this.timeOfDay.paused) {
        this.timeOfDay.resume();
        this.toggleEl.textContent = '⏸';
      } else {
        this.timeOfDay.pause();
        this.toggleEl.textContent = '▶';
      }
    });

    // 天气按钮
    root.querySelectorAll('.env-wbtn').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = btn.dataset.w;
        this.weather.setType(w);
        this.weather.applyFog(this.scene, this.timeOfDay);
        root.querySelectorAll('.env-wbtn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // 雪按钮
    if (this.snowAccum) {
      this.snowFillEl = root.querySelector('#env-snow-fill');
      this.snowPctEl = root.querySelector('#env-snow-pct');
      root.querySelector('#env-snow-faster').addEventListener('click', () => {
        this.snowAccum.setSpeed(0.1);
      });
      root.querySelector('#env-snow-reset').addEventListener('click', () => {
        this.snowAccum.reset();
        this.snowAccum.setSpeed(0.005);
      });
      root.querySelector('#env-snow-max').addEventListener('click', () => {
        this.snowAccum.setLevel(1.0);
      });
    }
  }

  /** 每帧更新 UI 文字 */
  _updateUI() {
    const phase = this.timeOfDay.getPhaseLabel();
    const h = this.timeOfDay.hour;
    this.phaseEl.textContent = phase;
    this.hourEl.textContent = h.toFixed(1) + ' 时';
    if (this.badgeEl) this.badgeEl.textContent = h.toFixed(1) + ' 时';
    if (this.snowAccum && this.snowFillEl) {
      const lv = this.snowAccum.getLevel();
      this.snowFillEl.style.width = (lv * 100).toFixed(0) + '%';
      this.snowPctEl.textContent = (lv * 100).toFixed(0) + '%';
    }
  }

  /** 在主循环里每帧调一次 */
  update() {
    // 滑块值要跟随时段(如果没在拖动)
    if (document.activeElement !== this.sliderEl) {
      this.sliderEl.value = this.timeOfDay.hour.toFixed(1);
    }
    this._updateUI();
  }
}

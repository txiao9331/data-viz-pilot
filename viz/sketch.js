// Data-Viz Pilot · 双模式可视化骨架 v0.4（真实数据 · 30 天窗口 · 新映射规则）
// 数据：data/huawei_daily.csv（华为手表日汇总，最近 30 个日历日切片）
// 参数映射（范围按窗口内数据 min/max 动态计算，逐日演变 1.5s/天，天数间线性插值）：
//   静息心率 → 粒子流速 + 线条出生粗细（力度/脉搏感）
//   睡眠时长 → 粒子数量（整体丰盈/稀疏）
//   压力     → 色相 蓝210°→红10°（冷暖情绪）
//   血氧     → 粒子寿命：线条随年龄变细变透明的速率（持续性/绵密度）
// 粒子死透后立即在随机位置重生 → 画面密度恒由睡眠决定，血氧只影响拖尾长度
// 图表模式：四指标小倍数，日期刻度 + 缺测断线 + 睡眠截断日标记
// sessionLog：由 app.js 驱动（startParticipantSession / setMode / finishViewing），getSession() 取回

// 窗口：默认最近 30 个日历日；?days=N 自定义；?days=all 全量数据（2020-11 起）
// 全量模式下抽象演变更为 80ms/天（约 56s 跑完全程），作为"数年身体史"的整体印象
// 公共池模拟：?mode=pool —— 近 6 个自然月 = 6 位伪参与者，6 层粒子系统叠加
//   ?me=N 指定"我"是哪一层（1-6，默认最后一层）；?view=layers 初始即研究者分层视图；
//   按 R 切公共/分层视图；按住空格暂时移除"我"的层
// 单日冻结：?day=YYYY-MM-DD（抽象模式）——参数恒定，只看这一天的粒子生灭全过程
// 9/22 馆 review 修复：①截断日图例右对齐防溢出 ②无单位指标不显示空括号
//   ③pool 模式屏蔽 1/2 键（否则切到 abstract 无 complete 数据黑屏且无法返回）④data_window 记录真实 CSV 文件与池模式 complete 计数
const PARAMS = new URLSearchParams(location.search);
const POOL_INIT_VIEW = PARAMS.get('view');
const ALL_DATA = PARAMS.get('days') === 'all';
const POOL_MODE = PARAMS.get('mode') === 'pool';
const POOL_ME = Math.max(1, parseInt(PARAMS.get('me')) || 6);
const WINDOW_DAYS = ALL_DATA ? 36500 : (parseInt(PARAMS.get('days')) || 30);
const DAY_MS = ALL_DATA ? 80 : 1500;
const POOL_DAY_MS = 800;           // 公共池每层演变速度（6 层并行，约 24s 循环）
const POOL_LAYER_MAX = 200;        // 每层粒子池上限
const CSV_FILE = (ALL_DATA || POOL_MODE) ? 'data/huawei_daily_full.csv' : 'data/huawei_daily.csv';
const MAX_PARTICLES = 700;
const FLOW_SCALE = 0.0028; // 流场噪声尺度（v0.4 起为固定常数，不再由数据驱动）

const SEED = 20260918; // 固定种子，保证每次渲染可复现（演示友好）

let table;
let raw = [];        // 窗口内全部日历日（缺测为 NaN）
let complete = [];   // 四指标齐全日
let mode = null; // 'abstract' | 'chart'
let winStart = '', winEnd = '';

let session = null;      // {session_id, data_window, started_at, events: []}
let modeEnterT = null;   // 当前模式进入时刻（ms）

// —— i18n：T() 由 app.js 提供 ——
const t = (k, vars) => (typeof window.T === 'function' ? window.T(k, vars) : k);

function preload() {
  table = loadTable(CSV_FILE, 'csv', 'header',
    () => {},
    () => {
      const hint = document.getElementById('hint');
      if (hint) hint.innerHTML = '<span style="color:#e8734a">' + t('err.csv') + '</span>';
    });
}

function setup() {
  randomSeed(SEED);
  noiseSeed(SEED);
  colorMode(HSB, 360, 100, 100, 100);
  const cnv = createCanvas(960, 600);
  cnv.parent('canvas-holder');
  if (!table) return; // CSV 加载失败：hint 已显示原因，不再继续
  if (POOL_MODE) {
    parsePool();
    initPoolParticles();
  } else {
    parseData();
    initParticles();
  }
  noLoop();
  // 演示/测试直达：?mode=abstract|chart|pool
  // 注意：必须是这里（p5 初始化完成后）启动，app.js 的 DOMContentLoaded 早于 p5 setup，
  // 若在那边 setMode/loop，setup 里的 noLoop() 会把动画永久停掉（"界面不运动"的元凶）
  const auto = PARAMS.get('mode');
  if (auto === 'abstract' || auto === 'chart' || auto === 'pool') {
    if (typeof window.startParticipantSession === 'function') window.startParticipantSession();
    mode = null; // 防御：若别处已提前置过 mode，强制重走完整分支确保 loop() 生效
    setMode(auto);
  }
}

// ============ 公共池模拟：近 6 个自然月 = 6 位伪参与者 ============
// 参数映射用 6 个月的全局 min/max：人和人的差异真实反映在视觉差异上；
// 公共视图所有层同一套色相规则（匿名化），研究者视图每层错开 57° 色相（结构验证）。
let pool = [];       // [{label:'YYYY-MM', days:[四指标齐全行], parts:[粒子]}]
let poolExt = null;  // 全局 extent
let poolView = POOL_INIT_VIEW === 'layers' ? 'layers' : 'public'; // 'public' | 'layers'（按 R 切换）
let meRemoved = false;   // 按住空格：暂时移除"我"的层（识别探针）

const extentOf = (days, k) => {
  const v = days.map(d => d[k]).filter(v => !isNaN(v));
  return v.length ? [Math.min(...v), Math.max(...v)] : [0, 1];
};

function parsePool() {
  const all = [];
  for (let r = 0; r < table.getRowCount(); r++) {
    const row = {
      date: table.getString(r, 'date'),
      hr: numOrNaN(table.getString(r, 'resting_hr')),
      sleep: numOrNaN(table.getString(r, 'sleep_min')),
      spo2: numOrNaN(table.getString(r, 'spo2')),
      stress: numOrNaN(table.getString(r, 'stress')),
    };
    if (![row.hr, row.sleep, row.spo2, row.stress].some(isNaN)) all.push(row);
  }
  if (!all.length) return;
  const months = [...new Set(all.map(d => d.date.slice(0, 7)))].slice(-6);
  pool = months.map(m => ({ label: m, days: all.filter(d => d.date.startsWith(m)), parts: [] }));
  const allDays = pool.flatMap(L => L.days);
  poolExt = { hr: extentOf(allDays, 'hr'), sleep: extentOf(allDays, 'sleep'),
              spo2: extentOf(allDays, 'spo2'), stress: extentOf(allDays, 'stress') };
  winStart = months[0] + '-01';
  winEnd = all[all.length - 1].date;
  raw = allDays; // 供 session data_window 记录
}

function poolDayParams(d) {
  const [slo, shi] = poolExt.sleep;
  const [tlo, thi] = poolExt.stress;
  const [hlo, hhi] = poolExt.hr;
  const [olo, ohi] = poolExt.spo2;
  return {
    count: map(d.sleep, slo, shi, 60, POOL_LAYER_MAX, true),
    hue: map(d.stress, tlo, thi, 210, 10, true),
    speed: map(d.hr, hlo, hhi, 1.2, 3.6, true),
    w0: map(d.hr, hlo, hhi, 1, 4, true),
    life: map(d.spo2, olo, ohi, 30, 120, true),
  };
}

function initPoolParticles() {
  for (const L of pool) {
    for (let i = 0; i < POOL_LAYER_MAX; i++) {
      L.parts.push({ x: random(width), y: random(height), j: random(-14, 14),
                     age: random(0, 90), life: 60, w0: 2.5 });
    }
  }
}

function drawPool() {
  if (!pool.length) return;
  noStroke(); fill(12, 14, 18, 4); rect(0, 0, width, height);
  let myDay = null, myIdx = 0;
  pool.forEach((L, li) => {
    if (!L.days.length) return;
    if (li === POOL_ME - 1) { myIdx = li; }
    if (li === POOL_ME - 1 && meRemoved) return; // 识别探针：暂时移除"我"
    const pos = (millis() / POOL_DAY_MS) % L.days.length;
    const i = floor(pos), f = pos - i;
    const a = poolDayParams(L.days[i]), b = poolDayParams(L.days[(i + 1) % L.days.length]);
    const cur = {
      count: lerp(a.count, b.count, f),
      hue: (lerp(a.hue, b.hue, f) + 360) % 360,
      speed: lerp(a.speed, b.speed, f),
      w0: lerp(a.w0, b.w0, f),
      life: lerp(a.life, b.life, f),
    };
    if (li === POOL_ME - 1) myDay = L.days[i];
    const n = constrain(round(cur.count), 0, POOL_LAYER_MAX);
    for (let k = 0; k < n; k++) {
      const p = L.parts[k];
      p.age++;
      if (p.age >= p.life) {
        p.x = random(width); p.y = random(height);
        p.age = 0; p.life = cur.life; p.w0 = cur.w0;
      }
      const lifeT = constrain(p.age / p.life, 0, 1);
      const w = Math.max(p.w0 * (1 - lifeT), 0.3);
      const alpha = 30 * (1 - lifeT);
      const ang = noise(p.x * FLOW_SCALE, p.y * FLOW_SCALE, frameCount * 0.002 * cur.speed) * TWO_PI * 2;
      const px = p.x, py = p.y;
      p.x += cos(ang) * cur.speed;
      p.y += sin(ang) * cur.speed;
      // 色相：公共视图统一规则（匿名）；研究者视图每层错 57°
      const hue = poolView === 'layers' ? (cur.hue + li * 57 + 360) % 360 : (cur.hue + p.j + 360) % 360;
      if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
        p.x = (p.x + width) % width; p.y = (p.y + height) % height;
        p.age = 0; p.life = cur.life; p.w0 = cur.w0;
        noStroke(); fill(hue, 70, 90, 30); circle(p.x, p.y, 2.4);
      } else {
        stroke(hue, poolView === 'layers' ? 55 : 70, 90, alpha); strokeWeight(w);
        line(px, py, p.x, p.y);
      }
    }
    // 研究者视图：层标签
    if (poolView === 'layers') {
      noStroke(); fill((poolDayParams(L.days[0]).hue + li * 57) % 360, 55, 80); textSize(11);
      textAlign(LEFT, TOP);
      text(`${li + 1}·${L.label}${li === POOL_ME - 1 ? t('pool.meTag') : ''}`, 10, 10 + li * 16);
    }
  });
  // 读数：我的层当前演变到的日期 + 探针状态
  noStroke(); fill(0, 0, 85); textAlign(LEFT, BOTTOM); textSize(13);
  const meLabel = pool[myIdx] ? pool[myIdx].label : '-';
  text(t('pool.readout', { me: POOL_ME, month: meLabel, day: myDay ? myDay.date : '-' }), 14, height - 30);
  if (meRemoved) { fill(30, 90, 95); text(t('pool.meRemoved'), 14, height - 12); }
  textAlign(RIGHT, BOTTOM); fill(0, 0, 45);
  text(poolView === 'layers' ? t('pool.viewLayers') : t('pool.viewPublic'), width - 14, height - 12);
  textAlign(LEFT, BOTTOM);
}

function parseData() {
  const all = [];
  for (let r = 0; r < table.getRowCount(); r++) {
    all.push({
      date: table.getString(r, 'date'),
      hr: numOrNaN(table.getString(r, 'resting_hr')),
      sleep: numOrNaN(table.getString(r, 'sleep_min')),
      spo2: numOrNaN(table.getString(r, 'spo2')),
      stress: numOrNaN(table.getString(r, 'stress')),
      capped: table.getString(r, 'sleep_capped') === '1',
    });
  }
  if (!all.length) return;
  winEnd = all[all.length - 1].date;
  winStart = ALL_DATA ? all[0].date : shiftDate(winEnd, -(WINDOW_DAYS - 1)); // 纯日期算术，不经 Date 时区转换
  for (const row of all) {
    if (row.date >= winStart && row.date <= winEnd) {
      raw.push(row);
      if (![row.hr, row.sleep, row.spo2, row.stress].some(isNaN)) complete.push(row);
    }
  }
}

// ISO 日期加减天数（字符串算术，避免 new Date + toISOString 的时区漂移）
function shiftDate(iso, delta) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const p = n => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

function numOrNaN(s) {
  const v = parseFloat(s);
  return s === '' || isNaN(v) ? NaN : v;
}

// —— 窗口内统计（逐指标忽略缺测，范围按窗口计算）——
const extent = k => {
  const v = raw.map(d => d[k]).filter(v => !isNaN(v));
  return v.length ? [Math.min(...v), Math.max(...v)] : [0, 1];
};

// 每日参数（抽象模式时间演变用；v0.4 映射规则）
function dayParams(d) {
  const [slo, shi] = extent('sleep');
  const [tlo, thi] = extent('stress');
  const [hlo, hhi] = extent('hr');
  const [olo, ohi] = extent('spo2');
  return {
    count: map(d.sleep, slo, shi, 250, MAX_PARTICLES, true),
    hue: map(d.stress, tlo, thi, 210, 10, true),
    speed: map(d.hr, hlo, hhi, 1.2, 3.6, true),
    w0: map(d.hr, hlo, hhi, 1, 4, true),      // 出生粗细（心率）
    life: map(d.spo2, olo, ohi, 30, 120, true), // 寿命帧数（血氧：低=早逝，高=绵长）
  };
}

function initParticles() {
  // 出生年龄随机错开，避免整批同步生灭
  particles.length = 0;
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.push({
      x: random(width), y: random(height),
      j: random(-14, 14),
      age: random(0, 90), life: 60, w0: 2.5,
    });
  }
}
let particles = [];

// 当前插值参数（重生粒子取用）
let cur = { count: 300, hue: 200, speed: 2, w0: 2.5, life: 60 };

function draw() {
  if (mode === 'abstract') {
    drawAbstract(); // 不清屏：由内部残影矩形制造拖尾
  } else if (mode === 'pool') {
    drawPool();     // 不清屏：同上
  } else {
    background(12, 14, 18);
    if (mode === 'chart') drawChart();
    else introScreen();
  }
}

function introScreen() {
  fill(0, 0, 90); noStroke(); textAlign(CENTER, CENTER); textSize(18);
  text(t('viz.intro'), width / 2, height / 2 - 16);
  textSize(13); fill(0, 0, 55);
  text(t('viz.window', { from: winStart, to: winEnd, days: raw.length, complete: complete.length }), width / 2, height / 2 + 16);
}

// —— 抽象模式：数据驱动的生成流体，逐日演变 ——
// ?day=YYYY-MM-DD：冻结在指定那一天，参数恒定，只看这一天的生成过程（demo/教学用）
const HOLD_DAY = PARAMS.get('day');
function drawAbstract() {
  if (!complete.length) return;
  let i = 0;
  if (HOLD_DAY) {
    const found = complete.findIndex(r => r.date === HOLD_DAY);
    if (found < 0) return; // 该日缺测或无数据：保持黑屏（demo 参数错误时可见）
    i = found;
    cur = dayParams(complete[i]);
  } else {
    const pos = (millis() % (complete.length * DAY_MS)) / DAY_MS;
    i = floor(pos);
    const f = pos - i;
    const a = dayParams(complete[i]), b = dayParams(complete[(i + 1) % complete.length]);
    cur = {
      count: lerp(a.count, b.count, f),
      hue: (lerp(a.hue, b.hue, f) + 360) % 360,
      speed: lerp(a.speed, b.speed, f),
      w0: lerp(a.w0, b.w0, f),
      life: lerp(a.life, b.life, f),
    };
  }
  // 残影拖尾
  noStroke(); fill(12, 14, 18, 4); rect(0, 0, width, height);
  const n = constrain(round(cur.count), 0, MAX_PARTICLES);
  for (let k = 0; k < n; k++) {
    const p = particles[k];
    // 生命推进：血氧决定衰减速率
    p.age++;
    if (p.age >= p.life) { // 死透 → 随机位置重生（密度恒定）
      p.x = random(width); p.y = random(height);
      p.age = 0; p.life = cur.life; p.w0 = cur.w0;
    }
    const lifeT = constrain(p.age / p.life, 0, 1);   // 0 新生 → 1 消亡
    const w = Math.max(p.w0 * (1 - lifeT), 0.3);      // 随年龄变细
    const alpha = 34 * (1 - lifeT);                   // 随年龄变透明
    const ang = noise(p.x * FLOW_SCALE, p.y * FLOW_SCALE, frameCount * 0.002 * cur.speed) * TWO_PI * 2;
    const px = p.x, py = p.y;
    p.x += cos(ang) * cur.speed;
    p.y += sin(ang) * cur.speed;
    const c = (cur.hue + p.j + 360) % 360;
    if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
      // 越界：回绕并视为重生，避免跨屏长线
      p.x = (p.x + width) % width; p.y = (p.y + height) % height;
      p.age = 0; p.life = cur.life; p.w0 = cur.w0;
      noStroke(); fill(c, 70, 90, 32); circle(p.x, p.y, 2.4);
    } else {
      stroke(c, 70, 90, alpha); strokeWeight(w);
      line(px, py, p.x, p.y);
    }
  }
  // 日期读数：当前演进到的那一天
  const d = complete[i];
  noStroke(); fill(0, 0, 85); textAlign(LEFT, BOTTOM); textSize(13);
  text(t('viz.readout', {
    date: d.date, sleep: fmtHours(d.sleep), hr: fmt(d.hr),
    stress: fmt(d.stress), spo2: fmt(d.spo2),
  }), 14, height - 12);
  textAlign(RIGHT, BOTTOM); fill(0, 0, 45);
  text(`${i + 1}/${complete.length}`, width - 14, height - 12);
}

const fmt = v => isNaN(v) ? '—' : Math.round(v);
const fmtHours = v => isNaN(v) ? '—' : (v / 60).toFixed(1) + 'h';

// —— 图表模式：四指标小倍数，日期刻度 + 缺测断线 ——
function drawChart() {
  const metrics = [
    [t('chart.hr'), 'hr', 'bpm'],
    [t('chart.sleep'), 'sleep', 'min'],
    [t('chart.spo2'), 'spo2', '%'],
    [t('chart.stress'), 'stress', ''],
  ];
  const cols = 2, w = width / cols, h = height / 2;
  textSize(12); textAlign(LEFT, TOP);
  metrics.forEach(([label, key, unit], i) => {
    const ox = (i % cols) * w + 50;
    const oy = floor(i / cols) * h + 45;
    const cw = w - 90, ch = h - 95;
    let [lo, hi] = extent(key);
    const pad = (hi - lo) * 0.08 || 1;
    lo -= pad; hi += pad;
    noFill(); stroke(0, 0, 50); rect(ox, oy, cw, ch);
    noFill(); stroke(0, 0, 80); strokeWeight(1.2);
    let pen = false;
    for (let j = 0; j < raw.length; j++) {
      const v = raw[j][key];
      if (isNaN(v)) {
        if (pen) { endShape(); pen = false; } // 缺测前先闭合当前段，否则 p5 丢弃未闭合 shape
        continue;
      }
      const x = ox + map(j, 0, raw.length - 1, 0, cw);
      const y = oy + ch - map(v, lo, hi, 0, ch, true);
      if (!pen) { beginShape(); pen = true; }
      vertex(x, y);
      if (key === 'sleep' && raw[j].capped) {
        push();
        noStroke(); fill(30, 90, 95);
        circle(x, y, 5);
        pop();
        endShape(); pen = false;
      }
    }
    if (pen) endShape();
    noStroke(); fill(0, 0, 90);
    const rangeTxt = `${Math.round(extent(key)[0])}~${Math.round(extent(key)[1])}`;
    text(`${label}${unit ? ` (${unit})` : ''}  ${rangeTxt}`, ox, oy - 20);
    textAlign(CENTER, TOP); fill(0, 0, 55); textSize(10);
    const longSpan = (raw[raw.length - 1].date.slice(0, 4) - raw[0].date.slice(0, 4)) >= 1;
    const lbl = d => longSpan ? d.slice(0, 7) : d.slice(5);
    text(lbl(raw[0].date), ox, oy + ch + 5);
    text(lbl(raw[floor(raw.length / 2)].date), ox + cw / 2, oy + ch + 5);
    text(lbl(raw[raw.length - 1].date), ox + cw, oy + ch + 5);
    textAlign(LEFT, TOP); textSize(12);
  });
  // 截断日图例：右对齐，避免长文案溢出画布右缘
  noStroke(); textAlign(RIGHT, CENTER); textSize(11);
  const capTxt = t('chart.cappedLegend');
  fill(0, 0, 60);
  text(capTxt, width - 14, 18);
  fill(30, 90, 95);
  circle(width - 14 - textWidth(capTxt) - 10, 18, 6);
  textAlign(LEFT, TOP);
  const miss = raw.filter(d => isNaN(d.hr) || isNaN(d.sleep) || isNaN(d.spo2) || isNaN(d.stress)).length;
  if (miss) {
    fill(0, 0, 55); textAlign(RIGHT, CENTER);
    text(t('chart.missing', { n: miss }), width - 14, height - 14);
  }
}

// —— 对 app.js 暴露的 API ——
function startParticipantSession(id) {
  if (session) return session.session_id;
  const sid = id || `P-${Date.now().toString(36).toUpperCase()}`;
  session = {
    session_id: sid,
    data_window: { file: CSV_FILE, from: winStart, to: winEnd, calendar_days: raw.length, complete_days: POOL_MODE ? raw.length : complete.length },
    seed: SEED,
    started_at: new Date().toISOString(),
    events: [{ event: 'session_start', t: new Date().toISOString() }],
  };
  return sid;
}

function setMode(m) {
  if (!session) return;
  if (mode === m) return;
  const now = new Date().toISOString();
  if (mode) {
    session.events.push({ event: 'mode_exit', mode, t: now, dwell_sec: modeEnterT ? (Date.now() - modeEnterT) / 1000 : null });
  }
  mode = m;
  modeEnterT = Date.now();
  session.events.push({ event: 'mode_enter', mode: m, t: now });
  if (m === 'abstract' || m === 'pool') { background(12, 14, 18); loop(); }
  else { noLoop(); redraw(); }
}

function finishViewing() {
  if (!session) return;
  const now = new Date().toISOString();
  if (mode) {
    session.events.push({ event: 'mode_exit', mode, t: now, dwell_sec: modeEnterT ? (Date.now() - modeEnterT) / 1000 : null });
    mode = null; modeEnterT = null;
    noLoop(); redraw();
  }
  session.events.push({ event: 'viewing_completed', t: now });
}

function getSession() { return session; }

window.startParticipantSession = startParticipantSession;
window.setMode = setMode;
window.finishViewing = finishViewing;
window.getSession = getSession;
window.setPoolView = (v) => {
  poolView = (v === 'layers') ? 'layers' : 'public';
  background(12, 14, 18); // 换视图时清掉上一视图的拖尾
};
window.redrawCanvas = () => {
  // 防御：p5 初始化完成前 redraw 尚不存在（app.js 的 applyLang 可能更早调用）
  if (typeof redraw === 'function' && mode !== 'abstract' && mode !== 'pool') redraw();
};

function keyPressed() {
  if (!session) return;
  // pool 模式下 1/2 无意义（无 complete 数据会黑屏且无法返回），仅保留 R 与空格探针
  if (!POOL_MODE && key === '1') setMode('abstract');
  if (!POOL_MODE && key === '2') setMode('chart');
  if (mode === 'pool' && (key === 'r' || key === 'R')) {
    setPoolView(poolView === 'public' ? 'layers' : 'public');
  }
  if (mode === 'pool' && (key === ' ' || keyCode === 32)) meRemoved = true;
}

function keyReleased() {
  if (key === ' ' || keyCode === 32) meRemoved = false;
}

// Data-Viz Pilot · 流程与双语界面 v0.4
// 四步向导：同意书 → 观看前问卷 → 观看 → 观看后问卷 → 导出 JSON
// 默认中文，可切英文（demo 用）；JSON 键名与选项值保持英文（研究数据惯例）
// URL 参数：?lang=en|zh 指定语言；?mode=abstract|chart 演示直达（跳过向导自动开始 session）

// ============ i18n ============
const I18N = {
  zh: {
    'title': 'Data-Viz Pilot · 身体数据可视化',
    'langBtn': 'EN',
    'step': '第 {n} 步，共 4 步',
    'next': '继续',
    'back': '返回',
    'err.csv': 'CSV 加载失败。如果你是通过双击文件打开的（地址栏是 file:// 开头），浏览器会拦截本地数据读取——请在 viz 目录下运行 python -m http.server 8000，然后浏览器访问 http://localhost:8000。若已用本地服务器，请确认 data/huawei_daily.csv 存在。',

    'consent.title': '知情同意书',
    'consent.p1': '一项关于数据可视化如何影响人对自己身体数据的感知的小型研究（pilot）。你查看自己可穿戴设备数据的两种可视化呈现，并填写一份短问卷（<5 分钟）。',
    'consent.h1': '你要做什么',
    'consent.p2': '① 提供你可穿戴设备/健康 app 的数据（数据导出文件，或由研究者协助手动录入）\n② 在本机查看两种可视化（抽象 / 图表），顺序由你决定\n③ 完成一份问卷',
    'consent.h2': '数据怎么处理',
    'consent.p3': '· 数据仅保存在研究者本机，不记名，以编号代替\n· 问卷中的开放文本与任何身份信息分开存储\n· 研究结束后，原始数据文件将被删除\n· 不会向任何第三方提供数据；发表（如有）只呈现汇总结果',
    'consent.h3': '风险与收益',
    'consent.p4': '· 无已知风险；无直接物质收益\n· 可视化可能引起对自己健康状况的情绪反应，可随时暂停或退出',
    'consent.h4': '自愿原则',
    'consent.p5': '· 参与完全自愿，可随时退出，无需说明理由，退出不影响任何关系\n· 年满 18 周岁方可参与',
    'consent.check': '我已阅读并理解以上信息，年满 18 周岁，自愿参与本 pilot。',
    'consent.mustCheck': '请先勾选知情同意',

    'pre.title': '观看前问卷',
    'pre.q1': '在开始之前（1–5 分）：你觉得自己对近期身体状况的了解程度？',
    'pre.q1.low': '1 完全不了解',
    'pre.q1.high': '5 非常了解',
    'pre.q2a': '你日常使用哪款可穿戴设备/健康 app？',
    'pre.q2a.other': '其他',
    'pre.q2b': '使用了多久？',
    'dur.0': '<3 个月', 'dur.1': '3–12 个月', 'dur.2': '1–3 年', 'dur.3': '>3 年',
    'dev.huawei': '华为手表/运动健康', 'dev.apple': 'Apple Watch/健康', 'dev.garmin': 'Garmin', 'dev.fitbit': 'Fitbit', 'dev.xiaomi': '小米/米动', 'dev.none': '没有固定使用',

    'view.id': '你的编号',
    'view.hint': '两种模式都可以看，顺序和次数由你决定，建议每种至少看 30 秒。看完点下方按钮进入问卷。',
    'view.abstract': '抽象模式',
    'view.chart': '图表模式',
    'view.done': '我看完两种模式了，去后测问卷',

    'post.title': '观看后问卷',
    'post.q3': '看完两种可视化之后（1–5 分）：现在你对近期身体状况的了解程度？',
    'post.q4': '哪一种让你更理解自己的身体数据？',
    'post.why': '为什么？（可选）',
    'post.q5': '哪一种你更信任？',
    'post.q6': '哪一种让你产生了情绪反应（好奇、不安、亲切、无感……）？请描述。',
    'post.q7': '抽象的可视化让你联想到什么？',
    'post.q8': '如果有一个"只显示抽象可视化"的公共页面，你愿意让自己的数据加入吗？',
    'post.q9': '如果不愿意，最主要的原因是？',
    'opt.abstract': '抽象', 'opt.chart': '图表', 'opt.same': '差不多',
    'opt.yes': '愿意', 'opt.no': '不愿意', 'opt.unsure': '不确定',
    'open.optional': '开放题，可不答',
    'open.caution': '请勿在开放题中填写姓名、联系方式、地址等可识别身份的信息。',
    'post.done': '完成，导出记录',

    'done.title': '完成',
    'done.hint': '点击下载本次 session 的完整记录（观看日志 + 问卷答案，JSON 格式）。文件只包含你的编号，不包含姓名。请把文件发给研究者。',
    'done.download': '下载记录 JSON',
    'done.restart': '重新开始（新参与者）',
    'done.noSession': 'session 尚未开始',

    'viz.intro': '选择上方按钮开始观看：抽象 或 图表（顺序由你决定）',
    'viz.window': '数据窗口：{from} ~ {to}（{days} 天，四指标齐全 {complete} 天）',
    'viz.readout': '{date} · 睡眠 {sleep} · 静息心率 {hr} · 压力 {stress} · 血氧 {spo2}%',
    'chart.hr': '静息心率', 'chart.sleep': '睡眠时长', 'chart.spo2': '血氧', 'chart.stress': '压力',
    'chart.cappedLegend': '睡眠截断日（>16h 按 16h 计）',
    'chart.missing': '缺测 {n} 天（折线断开处）',

    'pool.readout': '我的层 {me}/6（{month}）· 当前日 {day} · 按 R 切分层视图 · 按住空格移除我的层',
    'pool.meRemoved': '（已暂时移除你的层——感受流体的差别）',
    'pool.viewPublic': '公共视图',
    'pool.viewLayers': '研究者视图',
    'pool.meTag': '（我）',
    'pool.probeHint': '按住空格：暂时移除"我"的层',
    'pool.hint': '公共池模拟：6 位参与者的身体数据融合为一流体。点上方按钮切换公共/研究者视图，按住空格可以暂时移除"我"的层。',
  },
  en: {
    'title': 'Data-Viz Pilot · Bodily Data Visualization',
    'langBtn': '中',
    'step': 'Step {n} of 4',
    'next': 'Continue',
    'back': 'Back',
    'err.csv': 'Failed to load CSV. If you opened this file by double-clicking (address bar starts with file://), the browser blocks local data access — run python -m http.server 8000 inside the viz folder and visit http://localhost:8000 instead. If you are already using a local server, make sure data/huawei_daily.csv exists.',

    'consent.title': 'Informed Consent',
    'consent.p1': 'A small pilot study on how data visualization shapes a person\'s perception of their own bodily data. You will view two visualizations of your own wearable data and complete a short questionnaire (<5 minutes).',
    'consent.h1': 'What you will do',
    'consent.p2': '① Provide data from your wearable device / health app (an export file, or manual entry assisted by the researcher)\n② View two visualizations (abstract / chart) on this computer, in any order you choose\n③ Complete a questionnaire',
    'consent.h2': 'How your data is handled',
    'consent.p3': '· Data stays only on the researcher\'s computer, non-identified, referenced by a code number\n· Open-text answers are stored separately from any identifying information\n· Raw data files will be deleted after the study\n· Data will never be shared with third parties; any publication presents aggregate results only',
    'consent.h3': 'Risks and benefits',
    'consent.p4': '· No known risks; no direct material benefit\n· The visualizations may trigger emotional reactions about your own health; you may pause or quit at any time',
    'consent.h4': 'Voluntary participation',
    'consent.p5': '· Participation is fully voluntary; you may withdraw at any time without giving reasons\n· You must be 18 or older to participate',
    'consent.check': 'I have read and understood the above, I am 18 or older, and I voluntarily agree to participate in this pilot.',
    'consent.mustCheck': 'Please tick the consent box first',

    'pre.title': 'Pre-viewing Questionnaire',
    'pre.q1': 'Before we begin (1–5): how well do you feel you understand your recent physical condition?',
    'pre.q1.low': '1 not at all',
    'pre.q1.high': '5 very well',
    'pre.q2a': 'Which wearable device / health app do you use daily?',
    'pre.q2a.other': 'Other',
    'pre.q2b': 'For how long?',
    'dur.0': '<3 months', 'dur.1': '3–12 months', 'dur.2': '1–3 years', 'dur.3': '>3 years',
    'dev.huawei': 'Huawei watch / Health', 'dev.apple': 'Apple Watch / Health', 'dev.garmin': 'Garmin', 'dev.fitbit': 'Fitbit', 'dev.xiaomi': 'Mi Band / Zepp', 'dev.none': 'None regularly',

    'view.id': 'Your ID',
    'view.hint': 'You may view both modes in any order, as many times as you like. We suggest at least 30 seconds each. When done, use the button below to go to the post-viewing questionnaire.',
    'view.abstract': 'Abstract mode',
    'view.chart': 'Chart mode',
    'view.done': 'I have viewed both modes — go to post questionnaire',

    'post.title': 'Post-viewing Questionnaire',
    'post.q3': 'After viewing both visualizations (1–5): how well do you feel you understand your recent physical condition now?',
    'post.q4': 'Which form helped you understand your bodily data better?',
    'post.why': 'Why? (optional)',
    'post.q5': 'Which form do you trust more?',
    'post.q6': 'Which form triggered an emotional response (curiosity, unease, warmth, nothing…)? Please describe.',
    'post.q7': 'What does the abstract visualization remind you of?',
    'post.q8': 'If there were a public page showing only abstract visualizations, would you let your data join it?',
    'post.q9': 'If not, what is the main reason?',
    'opt.abstract': 'Abstract', 'opt.chart': 'Chart', 'opt.same': 'About the same',
    'opt.yes': 'Yes', 'opt.no': 'No', 'opt.unsure': 'Not sure',
    'open.optional': 'Open question, optional',
    'open.caution': 'Do not enter your name, contact details, address, or any identifying information in open questions.',
    'post.done': 'Finish and export record',

    'done.title': 'All done',
    'done.hint': 'Download the complete record of this session (viewing log + questionnaire responses, JSON). The file contains your ID code only, no name. Please send the file to the researcher.',
    'done.download': 'Download record JSON',
    'done.restart': 'Start over (new participant)',
    'done.noSession': 'Session has not started',

    'viz.intro': 'Choose a mode above to start viewing: abstract or chart (in any order you like).',
    'viz.window': 'Data window: {from} ~ {to} ({days} days, {complete} with all four metrics)',
    'viz.readout': '{date} · sleep {sleep} · resting HR {hr} · stress {stress} · SpO2 {spo2}%',
    'chart.hr': 'Resting HR', 'chart.sleep': 'Sleep', 'chart.spo2': 'SpO2', 'chart.stress': 'Stress',
    'chart.cappedLegend': 'Capped sleep day (>16h counted as 16h)',
    'chart.missing': '{n} day(s) missing (line breaks)',

    'pool.readout': 'My layer {me}/6 ({month}) · day {day} · press R for layered view · hold SPACE to remove my layer',
    'pool.meRemoved': '(your layer removed — feel the difference)',
    'pool.viewPublic': 'Public view',
    'pool.viewLayers': 'Researcher view',
    'pool.meTag': ' (me)',
    'pool.probeHint': 'Hold SPACE: temporarily remove my layer',
    'pool.hint': 'Public pool simulation: six participants\' bodily data merged into one fluid. Use the buttons above to switch views; hold SPACE to temporarily remove your layer.',
  },
};

let LANG = 'zh';
const params = new URLSearchParams(location.search);
if (params.get('lang') === 'en') LANG = 'en';

window.T = (key, vars) => {
  let s = (I18N[LANG] && I18N[LANG][key]) ?? I18N.zh[key] ?? key;
  if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
  return s;
};

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const text = window.T(key);
    if (el.tagName === 'TITLE') { document.title = text; return; }
    el.innerHTML = text.replace(/\n/g, '<br>');
  });
  document.getElementById('lang-btn').textContent = window.T('langBtn');
  buildQuestionnaires();
  if (typeof window.redrawCanvas === 'function') window.redrawCanvas();
}

// ============ 问卷模型（JSON 键名英文）============
function likert(name, qKey, lowKey, highKey) {
  return `<div class="q"><p>${window.T(qKey)}</p><div class="likert">` +
    [1, 2, 3, 4, 5].map(v =>
      `<label><input type="radio" name="${name}" value="${v}"><span>${v}</span></label>`).join('') +
    `<span class="likert-ends"><em>${window.T(lowKey)}</em><em>${window.T(highKey)}</em></span></div></div>`;
}
function radioGroup(name, qKey, options) {
  return `<div class="q"><p>${window.T(qKey)}</p><div class="opts">` +
    options.map(([val, key]) =>
      `<label class="opt"><input type="radio" name="${name}" value="${val}"><span>${window.T(key)}</span></label>`).join('') +
    `</div></div>`;
}
function openText(name, qKey) {
  return `<div class="q"><p>${window.T(qKey)}</p><textarea name="${name}" rows="3" placeholder="${window.T('open.optional')}"></textarea></div>`;
}
function deviceQ() {
  const devs = ['huawei', 'apple', 'garmin', 'fitbit', 'xiaomi', 'none'];
  return `<div class="q"><p>${window.T('pre.q2a')}</p><div class="opts">` +
    devs.map(d => `<label class="opt"><input type="radio" name="device_type" value="${d}"><span>${window.T('dev.' + d)}</span></label>`).join('') +
    `<label class="opt"><input type="radio" name="device_type" value="other"><span>${window.T('pre.q2a.other')}</span></label>
     <input type="text" name="device_type_other" class="inline-text" placeholder="${window.T('pre.q2a.other')}"></div></div>` +
    radioGroup('device_duration', 'pre.q2b', [['<3mo', 'dur.0'], ['3-12mo', 'dur.1'], ['1-3y', 'dur.2'], ['>3y', 'dur.3']]);
}

function buildQuestionnaires() {
  document.getElementById('pre-questions').innerHTML =
    likert('pre_baseline', 'pre.q1', 'pre.q1.low', 'pre.q1.high') + deviceQ();
  document.getElementById('post-questions').innerHTML =
    likert('post_understanding', 'post.q3', 'pre.q1.low', 'pre.q1.high') +
    radioGroup('pref_understanding', 'post.q4', [['abstract', 'opt.abstract'], ['chart', 'opt.chart'], ['same', 'opt.same']]) +
    openText('pref_understanding_why', 'post.why') +
    radioGroup('pref_trust', 'post.q5', [['abstract', 'opt.abstract'], ['chart', 'opt.chart'], ['same', 'opt.same']]) +
    openText('pref_trust_why', 'post.why') +
    openText('emotion', 'post.q6') +
    openText('association', 'post.q7') +
    radioGroup('optin', 'post.q8', [['yes', 'opt.yes'], ['no', 'opt.no'], ['unsure', 'opt.unsure']]) +
    openText('optin_reason', 'post.q9');
}

function readForm(containerId) {
  const out = {};
  document.querySelectorAll(`#${containerId} [name]`).forEach(el => {
    if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else if (el.value && el.value.trim()) out[el.name] = el.value.trim();
  });
  return out;
}

// Likert 分值转数字，便于直接计算前后测差值
function coerceTypes(responses) {
  for (const k of ['pre_baseline', 'post_understanding']) {
    if (k in responses) responses[k] = Number(responses[k]);
  }
  return responses;
}

// ============ 四步向导 ============
const STEPS = ['consent', 'pre', 'viewing', 'post', 'done'];
let currentStep = 'consent';
let participantId = null;

function showStep(step) {
  currentStep = step;
  STEPS.forEach(s => {
    document.getElementById('step-' + s).style.display = (s === step) ? 'block' : 'none';
  });
  document.getElementById('stage').style.display = (step === 'viewing') ? 'block' : 'none';
  const n = Math.min(STEPS.indexOf(step) + 1, 4);
  document.getElementById('step-indicator').textContent =
    step === 'done' ? '' : window.T('step', { n });
  if (step === 'viewing' && typeof window.redrawCanvas === 'function') window.redrawCanvas();
}

function gotoPre() {
  const check = document.getElementById('consent-check');
  if (!check.checked) { alert(window.T('consent.mustCheck')); return; }
  participantId = (typeof window.startParticipantSession === 'function')
    ? window.startParticipantSession() : 'P-UNKNOWN';
  document.getElementById('participant-id').textContent = participantId;
  showStep('pre');
}

function gotoViewing() {
  const pre = readForm('pre-questions');
  if (!('pre_baseline' in pre)) { alert(window.T('pre.q1')); return; }
  window.__preResponses = pre; // 导出时并入
  showStep('viewing');
}

function gotoPost() {
  if (typeof window.finishViewing === 'function') window.finishViewing();
  showStep('post');
}

function exportRecord() {
  const session = (typeof window.getSession === 'function') ? window.getSession() : null;
  if (!session) { alert(window.T('done.noSession')); return; }
  const record = {
    session_id: session.session_id,
    lang: LANG,
    exported_at: new Date().toISOString(),
    session_events: session.events,
    data_window: session.data_window,
    questionnaire_responses: coerceTypes(Object.assign({}, window.__preResponses || {}, readForm('post-questions'))),
  };
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `session_log_${session.session_id}.json`;
  a.click();
  showStep('done');
}

function restart() { location.reload(); }

// ============ 启动 ============
document.addEventListener('DOMContentLoaded', () => {
  applyLang();
  document.getElementById('lang-btn').addEventListener('click', () => {
    LANG = (LANG === 'zh') ? 'en' : 'zh';
    applyLang();
  });
  document.getElementById('btn-consent-next').addEventListener('click', gotoPre);
  document.getElementById('btn-pre-next').addEventListener('click', gotoViewing);
  document.getElementById('btn-view-done').addEventListener('click', gotoPost);
  document.getElementById('btn-post-done').addEventListener('click', exportRecord);
  document.getElementById('btn-download-again').addEventListener('click', exportRecord);
  document.getElementById('btn-restart').addEventListener('click', restart);
  document.getElementById('btn-mode-abstract').addEventListener('click', () => window.setMode('abstract'));
  document.getElementById('btn-mode-chart').addEventListener('click', () => window.setMode('chart'));
  // 演示/测试直达：?mode=abstract|chart|pool（跳过向导）
  // 注意：这里只做 UI；session 与 setMode 必须由 sketch.js 的 setup() 启动
  // （p5 在此之后才就绪，见 sketch.js 注释——在更早的时机 loop() 会被 setup 的 noLoop 永久停掉）
  const autoMode = params.get('mode');
  if (autoMode === 'abstract' || autoMode === 'chart' || autoMode === 'pool') {
    document.getElementById('wizard').style.display = 'none';
    document.getElementById('demo-bar').style.display = 'block';
    document.getElementById('stage').style.display = 'block';
    if (autoMode === 'pool') {
      document.getElementById('demo-modes').style.display = 'none'; // 池模式没有抽象/图表切换
      document.getElementById('demo-pool').style.display = 'inline';
      // 画布下方的提示换成池模式专属（applyLang 按 data-i18n 刷新，换语言也正确）
      document.getElementById('hint').setAttribute('data-i18n', 'pool.hint');
      document.getElementById('hint').textContent = window.T('pool.hint');
      const markPoolView = (v) => {
        document.getElementById('btn-pool-public').classList.toggle('active', v === 'public');
        document.getElementById('btn-pool-layers').classList.toggle('active', v === 'layers');
      };
      markPoolView(params.get('view') === 'layers' ? 'layers' : 'public');
      document.getElementById('btn-pool-public').addEventListener('click', () => { window.setPoolView('public'); markPoolView('public'); });
      document.getElementById('btn-pool-layers').addEventListener('click', () => { window.setPoolView('layers'); markPoolView('layers'); });
    }
  } else {
    // ?step=pre|viewing|post|done 跳步（测试/截图用）；越过 consent 时自动开始 session
    const jump = params.get('step');
    if (['pre', 'viewing', 'post', 'done'].includes(jump)) {
      if (typeof window.startParticipantSession === 'function') participantId = window.startParticipantSession();
      if (jump !== 'pre') document.getElementById('participant-id').textContent = participantId;
      showStep(jump);
    } else {
      showStep('consent');
    }
  }
});

"use strict";

/* ---------- データ ---------- */
const KEY = "ankiTimer.v1";
const AVATARS = ["🦊", "🐺", "🐯", "🦅", "🐧", "🐈‍⬛", "🐼", "🦉"];
const SET_XP = 10;

const ADVICE_MEM = [
  "💡 声に出して読むと記憶に残りやすい",
  "💡 書いて覚えるなら指書きでもOK",
  "💡 意味をイメージしながら覚えよう",
  "💡 苦手なものから優先的に",
  "💡 目を閉じて言えるかセルフチェック",
];
const ADVICE_TEST = [
  "💡 できなかった問題に印をつけよう",
  "💡 間違えた字・単語は3回書いて修正",
  "💡 印のついた問題は次のセットでも要チェック",
  "💡 自信がなかった所も見直しておこう",
];
const PRAISE = [
  "お疲れさま!",
  "ナイス! 継続は力なり",
  "いいペース!",
  "その調子!",
  "コツコツが最強",
];

const BADGES = [
  { id: "first",    emoji: "🌱", name: "はじめの一歩", desc: "初めて1セット完了",        test: (s) => s.log.length >= 1 },
  { id: "sets10",   emoji: "🎈", name: "10セット",     desc: "累計10セット達成",         test: (s) => s.log.length >= 10 },
  { id: "sets50",   emoji: "🏔️", name: "50セット",     desc: "プリント1周分!",          test: (s) => s.log.length >= 50 },
  { id: "sets100",  emoji: "👑", name: "100セット",    desc: "累計100セット達成",        test: (s) => s.log.length >= 100 },
  { id: "streak3",  emoji: "🔥", name: "3日連続",      desc: "3日連続で学習",            test: (s) => s.streak.best >= 3 },
  { id: "streak7",  emoji: "🚀", name: "1週間",        desc: "7日連続で学習",            test: (s) => s.streak.best >= 7 },
  { id: "streak30", emoji: "🌈", name: "1ヶ月",        desc: "30日連続で学習",           test: (s) => s.streak.best >= 30 },
  { id: "perfect",  emoji: "💮", name: "パーフェクト", desc: "5問全問正解",              test: (s) => s.log.some((e) => e.correct === 5) },
  { id: "focus5",   emoji: "🧠", name: "集中モード",   desc: "1日に5セット",             test: (s) => maxSetsPerDay(s) >= 5 },
  { id: "both",     emoji: "⚔️", name: "二刀流",       desc: "1日で国語と英語の両方",    test: (s) => bothSubjectsInADay(s) },
  { id: "goalday",  emoji: "🎯", name: "目標達成",     desc: "1日の目標をクリア",        test: (s) => !!s.lastGoalBonus },
];

function defaults() {
  return {
    profile: null,
    xp: 0,
    badges: [],
    freeze: { count: 1, week: isoWeek(new Date()) },
    streak: { current: 0, best: 0, last: null },
    log: [],
    lastGoalBonus: null,
    settings: { memMin: 3, testMin: 2, sound: true, lastSubject: "国語", goalSets: 4, testDate: "2026-07-19" },
  };
}
let S = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged = Object.assign(defaults(), parsed);
      merged.settings = Object.assign(defaults().settings, parsed.settings || {});
      return merged;
    }
  } catch (e) {}
  return defaults();
}
function save() { localStorage.setItem(KEY, JSON.stringify(S)); }

/* ---------- 日付ヘルパー ---------- */
function localDate(d) {
  const x = d || new Date();
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
}
function today() { return localDate(); }
function daysBetween(a, b) {
  return Math.round((new Date(b + "T00:00") - new Date(a + "T00:00")) / 86400000);
}
function isoWeek(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((x - yearStart) / 86400000 + 1) / 7);
  return x.getUTCFullYear() + "-W" + week;
}
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
function prettyDate(iso) {
  const d = new Date(iso + "T00:00");
  return (d.getMonth() + 1) + "/" + d.getDate() + "(" + WEEKDAYS[d.getDay()] + ")";
}

/* ---------- 集計 ---------- */
function todayLog() { return S.log.filter((e) => e.date === today()); }
const SUBJECTS = ["国語", "英語"];
function perSubjectToday() {
  const per = { 国語: 0, 英語: 0 };
  todayLog().forEach((e) => { if (per[e.subject] !== undefined) per[e.subject] += 1; });
  return per;
}
function daysToTest() {
  if (!S.settings.testDate) return null;
  const d = daysBetween(today(), S.settings.testDate);
  return d >= 0 ? d : null;
}
function maxSetsPerDay(s) {
  const m = {};
  s.log.forEach((e) => { m[e.date] = (m[e.date] || 0) + 1; });
  return Math.max(0, ...Object.values(m));
}
function bothSubjectsInADay(s) {
  const m = {};
  s.log.forEach((e) => { (m[e.date] = m[e.date] || new Set()).add(e.subject); });
  return Object.values(m).some((set) => set.size >= 2);
}
function effectiveStreak() {
  if (!S.streak.last) return { n: 0, note: "" };
  const gap = daysBetween(S.streak.last, today());
  if (gap <= 1) return { n: S.streak.current, note: gap === 1 ? "今日もやって記録をつなげよう" : "" };
  if (gap === 2 && S.freeze.count > 0) return { n: S.streak.current, note: "今日やれば🎫おやすみ券で連続記録が続く" };
  return { n: 0, note: "" };
}

/* ---------- セット完了処理 ---------- */
function completeSet(correct, subject) {
  if (S.freeze.week !== isoWeek(new Date())) S.freeze = { count: 1, week: isoWeek(new Date()) };
  let freezeUsed = false;
  const t = today();
  if (S.streak.last !== t) {
    const gap = S.streak.last ? daysBetween(S.streak.last, t) : null;
    if (gap === 1) {
      S.streak.current += 1;
    } else if (gap === 2 && S.freeze.count > 0) {
      S.freeze.count -= 1;
      S.streak.current += 1;
      freezeUsed = true;
    } else {
      S.streak.current = 1;
    }
    S.streak.last = t;
    S.streak.best = Math.max(S.streak.best, S.streak.current);
  }
  const now = new Date();
  S.log.push({
    date: t,
    time: String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0"),
    subject: subject,
    correct: correct,
  });
  S.xp += SET_XP;
  let goalBonus = false;
  const per = perSubjectToday();
  if (SUBJECTS.every((sub) => per[sub] >= S.settings.goalSets) && S.lastGoalBonus !== t) {
    S.lastGoalBonus = t;
    S.xp += 20;
    goalBonus = true;
  }
  const newBadges = BADGES.filter((b) => !S.badges.includes(b.id) && b.test(S));
  newBadges.forEach((b) => S.badges.push(b.id));
  save();
  return { correct, freezeUsed, newBadges, goalBonus };
}

/* ---------- 画面切り替え ---------- */
const $ = (id) => document.getElementById(id);
function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $("screen-" + name).classList.add("active");
  window.scrollTo(0, 0);
}

/* ---------- 音とバイブ ---------- */
let audioCtx = null;
function audioInit() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}
function beep(freq, start, dur, vol) {
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, audioCtx.currentTime + start);
  g.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + start + 0.02);
  g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + start + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(audioCtx.currentTime + start);
  o.stop(audioCtx.currentTime + start + dur + 0.05);
}
function alarm(kind) {
  if (navigator.vibrate) navigator.vibrate(kind === "mid" ? [300, 100, 300, 100, 300] : [200, 80, 200, 80, 500]);
  if (!S.settings.sound || !audioCtx) return;
  if (kind === "mid") {
    for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) beep(880, r * 0.6 + i * 0.15, 0.1, 0.4);
  } else {
    [523, 659, 784, 1047].forEach((f, i) => beep(f, i * 0.18, 0.25, 0.35));
  }
}

/* ---------- 画面スリープ防止 ---------- */
let wakeLock = null;
async function requestWake() {
  try { if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen"); } catch (e) {}
}
function releaseWake() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && session) requestWake();
});

/* ---------- タイマー ---------- */
let session = null;
let timerId = null;
let subject = S.settings.lastSubject || "国語";

function startSession() {
  audioInit();
  const setNo = todayLog().length + 1;
  session = { subject, setNo, phase: "mem", endsAt: Date.now() + S.settings.memMin * 60000 };
  document.body.classList.remove("phase-test");
  renderPhase();
  showScreen("timer");
  requestWake();
  clearInterval(timerId);
  timerId = setInterval(tick, 200);
  tick();
}
function renderPhase() {
  const mem = session.phase === "mem";
  $("timer-phase").textContent = mem ? "📖 暗記タイム" : "✏️ テスト&丸つけ";
  $("timer-info").textContent = "今日 " + session.setNo + "セット目・" + session.subject;
  const list = mem ? ADVICE_MEM : ADVICE_TEST;
  $("timer-advice").textContent = list[(S.log.length + session.setNo) % list.length];
  document.body.classList.toggle("phase-test", !mem);
}
function tick() {
  const rem = session.endsAt - Date.now();
  if (rem <= 0) {
    if (session.phase === "mem") {
      alarm("mid");
      session.phase = "test";
      session.endsAt = Date.now() + S.settings.testMin * 60000;
      renderPhase();
    } else {
      alarm("end");
      finishTimer();
    }
    return;
  }
  const total = (session.phase === "mem" ? S.settings.memMin : S.settings.testMin) * 60000;
  const sec = Math.ceil(rem / 1000);
  $("timer-clock").textContent = Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  $("timer-bar").style.width = (rem / total) * 100 + "%";
}
function finishTimer() {
  clearInterval(timerId);
  timerId = null;
  showScreen("marking");
}
function quitSession() {
  clearInterval(timerId);
  timerId = null;
  session = null;
  releaseWake();
  document.body.classList.remove("phase-test");
  renderHome();
  showScreen("home");
}

/* ---------- まるつけ → けっか ---------- */
let lastResult = null;
function handleMark(correct) {
  const res = completeSet(correct, session.subject);
  lastResult = { correct, subject: session.subject, setNo: session.setNo, freezeUsed: res.freezeUsed, newBadges: res.newBadges, goalBonus: res.goalBonus };
  session = null;
  releaseWake();
  document.body.classList.remove("phase-test");
  renderResult();
  showScreen("result");
}
function renderResult() {
  const r = lastResult;
  $("result-emoji").textContent = ["🎉", "🌟", "💪", "🎊", "✨"][S.log.length % 5];
  $("result-praise").textContent = PRAISE[S.log.length % PRAISE.length];
  $("result-correct").textContent = r.correct + "/5";
  $("result-streak").textContent = "🔥" + S.streak.current + "日";
  const badgeBox = $("result-badge");
  if (r.newBadges.length > 0) {
    badgeBox.hidden = false;
    badgeBox.textContent = "🏅 バッジゲット! " + r.newBadges.map((b) => b.emoji + " " + b.name).join(" / ");
  } else {
    badgeBox.hidden = true;
  }
  $("result-note").textContent = [
    r.goalBonus ? "🎯 今日の目標達成! +20 XPボーナス!" : null,
    r.freezeUsed ? "🎫 おやすみ券で連続記録をキープ!" : null,
  ].filter(Boolean).join(" ");
}

/* ---------- 共有 ---------- */
function buildReport(includeLast) {
  const name = S.profile ? S.profile.avatar + " " + S.profile.name : "";
  const logs = todayLog();
  const mins = logs.length * (S.settings.memMin + S.settings.testMin);
  const subjects = [...new Set(logs.map((e) => e.subject))].join("・") || "-";
  const correctSum = logs.reduce((a, e) => a + e.correct, 0);
  let text = "📚 暗記タイマー 学習報告\n";
  text += name + "\n";
  text += "今日の学習: " + logs.length + "セット(" + mins + "分)\n";
  text += "教科: " + subjects + "\n";
  text += "正解: " + correctSum + "/" + logs.length * 5 + "問\n";
  const per = perSubjectToday();
  text += "🎯 目標: 国語 " + per["国語"] + "/" + S.settings.goalSets + "・英語 " + per["英語"] + "/" + S.settings.goalSets + "\n";
  if (includeLast && lastResult) text += "今回のセット: " + lastResult.correct + "/5問正解\n";
  if (S.streak.current > 1) text += "🔥 " + S.streak.current + "日連続学習中!\n";
  const dt = daysToTest();
  if (dt !== null) text += "📝 テストまで あと" + dt + "日\n";
  return text;
}
async function shareReport(includeLast) {
  const text = buildReport(includeLast);
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast("コピーしました。LINEやメールに貼り付けて送ってください");
  } catch (e) {
    prompt("この文章をコピーしてください", text);
  }
}

/* ---------- トースト ---------- */
let toastEl = null;
function toast(msg) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2500);
}

/* ---------- 各画面の描画 ---------- */
function renderHome() {
  $("home-avatar").textContent = S.profile.avatar;
  $("home-name").textContent = S.profile.name;
  $("home-xp").textContent = S.xp + " XP";
  const es = effectiveStreak();
  $("home-streak").textContent = es.n;
  $("home-streak-flame").textContent = es.n > 0 ? "🔥" : "🕯️";
  $("home-streak-note").textContent = es.note || (es.n === 0 ? "今日からスタート!" : "");
  $("home-freeze-count").textContent = S.freeze.week === isoWeek(new Date()) ? S.freeze.count : 1;
  const dt = daysToTest();
  $("home-countdown").hidden = dt === null;
  if (dt !== null) {
    $("home-countdown").textContent = dt === 0 ? "📝 テスト当日! 実力を出しきろう" : "📝 テストまで あと" + dt + "日";
  }
  const goal = S.settings.goalSets;
  $("home-goal-label").textContent = "今日の目標(各教科 " + goal + "セット)";
  const per = perSubjectToday();
  const rows = $("home-goal-rows");
  rows.innerHTML = "";
  SUBJECTS.forEach((sub) => {
    const row = document.createElement("div");
    const cleared = per[sub] >= goal;
    row.className = "goal-row" + (cleared ? " done" : "");
    let dotsHtml = "";
    for (let i = 0; i < Math.max(goal, per[sub]); i++) {
      dotsHtml += '<span class="dot' + (i < per[sub] ? " done" : "") + '"></span>';
    }
    row.innerHTML = '<span class="goal-name">' + sub + '</span><span class="dots">' + dotsHtml + "</span><span class=\"goal-check\">" + (cleared ? "クリア🎉" : per[sub] + "/" + goal) + "</span>";
    rows.appendChild(row);
  });
  const n = todayLog().length;
  const allClear = SUBJECTS.every((sub) => per[sub] >= goal);
  $("home-today").textContent = allClear ? "🎯 今日の目標を全クリア!" : n === 0 ? "今日はまだ0セット" : "今日の合計 " + n + "セット";
  document.querySelectorAll(".subject-btn").forEach((b) => b.classList.toggle("selected", b.dataset.subject === subject));
}
function renderHistory() {
  $("hist-total").textContent = S.log.length;
  $("hist-min").textContent = S.log.length * (S.settings.memMin + S.settings.testMin);
  $("hist-best").textContent = S.streak.best + "日";
  const byDate = {};
  S.log.forEach((e) => { (byDate[e.date] = byDate[e.date] || []).push(e); });
  const list = $("hist-list");
  list.innerHTML = "";
  const dates = Object.keys(byDate).sort().reverse().slice(0, 30);
  if (dates.length === 0) {
    list.innerHTML = '<p class="hist-empty">まだ記録がありません。<br>最初の1セットからスタート!</p>';
    return;
  }
  dates.forEach((d) => {
    const logs = byDate[d];
    const correct = logs.reduce((a, e) => a + e.correct, 0);
    const subjects = [...new Set(logs.map((e) => e.subject))].join("・");
    const div = document.createElement("div");
    div.className = "hist-day";
    div.innerHTML =
      '<div><div class="hist-date">' + prettyDate(d) + '</div><div class="hist-detail">' +
      subjects + " / 正解 " + correct + "/" + logs.length * 5 + "</div></div>" +
      '<div class="hist-count">' + logs.length + "セット</div>";
    list.appendChild(div);
  });
}
function renderBadges() {
  const grid = $("badge-grid");
  grid.innerHTML = "";
  BADGES.forEach((b) => {
    const got = S.badges.includes(b.id);
    const div = document.createElement("div");
    div.className = "badge-card" + (got ? "" : " locked");
    div.innerHTML = '<div class="badge-emoji">' + b.emoji + '</div><div class="badge-name">' + b.name + '</div><div class="badge-desc">' + b.desc + "</div>";
    grid.appendChild(div);
  });
}
function renderAvatarPicker(containerId, selected, onPick) {
  const box = $(containerId);
  box.innerHTML = "";
  AVATARS.forEach((a) => {
    const b = document.createElement("button");
    b.className = "avatar-choice" + (a === selected ? " selected" : "");
    b.textContent = a;
    b.onclick = () => {
      onPick(a);
      renderAvatarPicker(containerId, a, onPick);
    };
    box.appendChild(b);
  });
}

/* ---------- イベント ---------- */
let setupAvatar = AVATARS[0];
let settingsAvatar = null;

function bind() {
  renderAvatarPicker("setup-avatars", setupAvatar, (a) => { setupAvatar = a; });
  $("setup-done").onclick = () => {
    const name = $("setup-name").value.trim();
    if (!name) { toast("名前を入力してください"); return; }
    S.profile = { name, avatar: setupAvatar };
    save();
    renderHome();
    showScreen("home");
  };

  document.querySelectorAll(".subject-btn").forEach((b) => {
    b.onclick = () => {
      subject = b.dataset.subject;
      S.settings.lastSubject = subject;
      save();
      renderHome();
    };
  });
  $("btn-start").onclick = startSession;
  $("btn-quit").onclick = () => { if (confirm("このセットを中断する?")) quitSession(); };
  $("btn-settings").onclick = () => { openSettings(); };
  $("btn-history").onclick = () => { renderHistory(); showScreen("history"); };
  $("btn-badges").onclick = () => { renderBadges(); showScreen("badges"); };
  $("btn-share-today").onclick = () => {
    if (todayLog().length === 0) { toast("今日はまだ学習記録がありません"); return; }
    shareReport(false);
  };

  const grid = $("mark-grid");
  for (let i = 0; i <= 5; i++) {
    const b = document.createElement("button");
    b.className = "mark-btn";
    b.innerHTML = i + "<small>問</small>";
    b.onclick = () => handleMark(i);
    grid.appendChild(b);
  }

  $("btn-share").onclick = () => shareReport(true);
  $("btn-again").onclick = startSession;
  $("btn-home").onclick = () => { renderHome(); showScreen("home"); };

  document.querySelectorAll("[data-back]").forEach((b) => {
    b.onclick = () => { renderHome(); showScreen("home"); };
  });

  $("set-save").onclick = () => {
    const name = $("set-name").value.trim();
    if (name) S.profile.name = name;
    if (settingsAvatar) S.profile.avatar = settingsAvatar;
    S.settings.memMin = parseInt($("set-mem").value, 10);
    S.settings.testMin = parseInt($("set-test").value, 10);
    S.settings.goalSets = parseInt($("set-goal").value, 10);
    S.settings.testDate = $("set-testdate").value || "";
    S.settings.sound = $("set-sound").checked;
    save();
    renderHome();
    showScreen("home");
    toast("保存しました");
  };
  $("set-reset").onclick = () => {
    if (confirm("記録もバッジも全て消えます。リセットする?") && confirm("最終確認: 本当に消していい?")) {
      localStorage.removeItem(KEY);
      S = defaults();
      showScreen("setup");
    }
  };
}
function openSettings() {
  $("set-name").value = S.profile.name;
  settingsAvatar = S.profile.avatar;
  renderAvatarPicker("set-avatars", settingsAvatar, (a) => { settingsAvatar = a; });
  $("set-mem").value = String(S.settings.memMin);
  $("set-test").value = String(S.settings.testMin);
  $("set-goal").value = String(S.settings.goalSets);
  $("set-testdate").value = S.settings.testDate || "";
  $("set-sound").checked = S.settings.sound;
  showScreen("settings");
}

/* ---------- 起動 ---------- */
bind();
if (S.profile) {
  renderHome();
  showScreen("home");
} else {
  showScreen("setup");
}

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

/* デバッグ用(開発時のみ使用) */
window._anki = {
  fastForward: (ms) => { if (session) { session.endsAt -= ms; tick(); } },
  state: () => S,
};

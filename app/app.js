// Sunset Ledger — tracker logic. Vanilla JS, no libraries, no network:
// it only reads the three JSON files under data/ that ship with the app.
const STORE_KEY = "sunset-ledger-v1";
const PSN_POINTS = { platinum: 180, gold: 90, silver: 30, bronze: 15 };
const GRADE_ORDER = { platinum: 0, gold: 1, silver: 2, bronze: 3 };

let trophies = [];
let sourcesDoc = null;
let roadmapDoc = null;
let audit = null;

const state = {
  earned: new Set(),
  progress: {},
  revealed: new Set(),
  spoiler: true,
  kind: "all",
  flag: "all",
  grade: "all",
  search: "",
  sort: "roadmap",
  selected: 28,
  tab: "tracker",
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.earned = new Set(saved.earned || []);
    state.progress = saved.progress || {};
    state.revealed = new Set(saved.revealed || []);
    if (typeof saved.spoiler === "boolean") state.spoiler = saved.spoiler;
  } catch (e) { /* fresh start on bad data */ }
}

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      earned: [...state.earned],
      progress: state.progress,
      revealed: [...state.revealed],
      spoiler: state.spoiler,
    }));
  } catch (e) { /* storage full or unavailable; the tracker still works in memory */ }
}

function seedDemoIfRequested() {
  const params = new URLSearchParams(location.search);
  if (!params.has("demo")) return;
  if (localStorage.getItem(STORE_KEY)) return;
  // Demo progress for the maker's screenshots: the first 11 roadmap-order
  // trophies earned, all bronze, 165 of 1,230 PSN points.
  const demoEarned = [2, 28, 3, 23, 20, 21, 4, 8, 24, 29, 5];
  state.earned = new Set(demoEarned);
  state.progress = { 28: 6, 15: 42, 31: 31, 35: 58, 32: 12, 48: 143 };
  saveState();
}

async function loadData() {
  const [t, s, r] = await Promise.all([
    fetch("data/trophies.json").then((x) => x.json()),
    fetch("data/sources.json").then((x) => x.json()),
    fetch("data/roadmap.json").then((x) => x.json()),
  ]);
  trophies = t.trophies;
  sourcesDoc = s;
  roadmapDoc = r;
  audit = s.audit;
}

function trophyById(id) { return trophies.find((t) => t.id === id); }
function trophyByOrder(n) { return trophies.find((t) => t.order === n); }
function isEarned(t) { return state.earned.has(t.id); }
function progressOf(t) { return state.progress[t.id] || 0; }
function isHiddenFromReader(t) {
  return state.spoiler && t.hidden && !isEarned(t) && !state.revealed.has(t.id);
}
function sourceByNumber(n) { return sourcesDoc.sources.find((s) => s.n === n); }

function gradeLabel(g) { return g === "platinum" ? "P" : g === "gold" ? "G" : g === "silver" ? "S" : "B"; }

function esc(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function citeLinks(nums) {
  return nums.map((n) => `<a class="cite" href="#tab-sources" data-goto-source="${n}">[${n}]</a>`).join(" ");
}

function renderAuditStrip() {
  const a = audit;
  const items = [
    `<span class="chip good"><b>55/55</b> official name, description, grade</span>`,
    `<span class="chip"><b>1P 2G 6S 46B</b> &middot; 28 PSN-hidden</span>`,
    `<span class="chip good"><b>${a.claimsCited}/${a.claimsCited}</b> claims cited</span>`,
    `<span class="chip good"><b>55/55</b> guides cite sources</span>`,
    `<span class="chip"><b>55</b> backed by 2+ guide sources</span>`,
    `<span class="chip"><b>${a.sources} sources</b> &middot; ${a.sites} sites &middot; read ${a.readDate}</span>`,
    `<span class="chip bad"><b>1</b> possibly missable &middot; <b>8</b> at risk</span>`,
    `<span class="chip"><b>6</b> unconfirmed</span>`,
    `<span class="chip"><b>13</b> disputes shown both ways</span>`,
  ];
  document.getElementById("auditStrip").innerHTML = items.join("");
}

function renderProgress() {
  const earned = trophies.filter(isEarned);
  const counts = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  let points = 0;
  for (const t of earned) { counts[t.grade]++; points += PSN_POINTS[t.grade]; }
  document.getElementById("earnedCount").textContent = earned.length;
  document.getElementById("progressFill").style.width = (earned.length / trophies.length * 100) + "%";
  document.getElementById("gradeCounts").textContent =
    `P ${counts.platinum}/1 \u00A0 G ${counts.gold}/2 \u00A0 S ${counts.silver}/6 \u00A0 B ${counts.bronze}/46`;
  document.getElementById("psnPoints").textContent = `${points.toLocaleString()} / 1,230 PSN points`;
}

function kindCounts() {
  const c = { all: trophies.length };
  for (const t of trophies) c[t.kind] = (c[t.kind] || 0) + 1;
  return c;
}

function renderChips() {
  const kc = kindCounts();
  const kinds = [["all", "All"], ["story", "Story"], ["side", "Side"], ["collectible", "Collectibles"], ["activity", "Activities"], ["crime", "Robbery"], ["misc", "Misc"], ["platinum", "Platinum"]];
  document.getElementById("kindChips").innerHTML = kinds.map(([k, label]) =>
    `<button type="button" data-kind="${k}" class="${state.kind === k ? "on" : ""}">${label} ${kc[k] || 0}</button>`).join("");
  const flags = [
    ["all", "All flags"], ["missable", "Missable 1"], ["atRisk", "At risk 8"],
    ["hidden", "PSN-hidden 28"], ["disputed", "Disputed 15"], ["unconfirmed", "Unconfirmed 6"],
    ["notEarned", "Not earned"],
  ];
  document.getElementById("flagChips").innerHTML = flags.map(([k, label]) =>
    `<button type="button" data-flag="${k}" class="${state.flag === k ? "on" : ""}">${label}</button>`).join("");
}

function filteredTrophies() {
  let list = trophies.slice();
  if (state.kind !== "all") list = list.filter((t) => t.kind === state.kind);
  if (state.flag === "missable") list = list.filter((t) => t.missable);
  if (state.flag === "atRisk") list = list.filter((t) => t.atRisk && !t.missable);
  if (state.flag === "hidden") list = list.filter((t) => t.hidden);
  if (state.flag === "disputed") list = list.filter((t) => t.disputed);
  if (state.flag === "unconfirmed") list = list.filter((t) => t.unconfirmed);
  if (state.flag === "notEarned") list = list.filter((t) => !isEarned(t));
  if (state.grade !== "all") list = list.filter((t) => t.grade === state.grade);
  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter((t) =>
      t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) ||
      t.guide.toLowerCase().includes(q) ||
      t.steps.some((s) => s.text.toLowerCase().includes(q)));
  }
  if (state.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
  else if (state.sort === "grade") list.sort((a, b) => GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade] || a.name.localeCompare(b.name));
  else if (state.sort === "chapter") list.sort((a, b) => (a.chapter || 99) - (b.chapter || 99) || a.order - b.order);
  else list.sort((a, b) => a.order - b.order);
  return list;
}

function flagTags(t) {
  const tags = [];
  if (t.hidden) tags.push(`<span class="tag hiddenflag">PSN-hidden</span>`);
  if (t.kind === "story") tags.push(`<span class="tag story">Story</span>`);
  if (t.missable) tags.push(`<span class="tag miss">Possibly missable</span>`);
  else if (t.atRisk) tags.push(`<span class="tag risk">At risk</span>`);
  if (t.unconfirmed) tags.push(`<span class="tag unconf">Unconfirmed</span>`);
  if (t.disputed) tags.push(`<span class="tag disp">Sources differ</span>`);
  if (t.chapter) tags.push(`<span class="tag">Ch ${t.chapter}</span>`);
  return tags.join("");
}

function stepperHtml(t) {
  if (!t.target) return "";
  const cur = progressOf(t);
  const done = cur >= t.target;
  const label = t.target >= 1000 ? `${cur.toLocaleString()} / ${t.target.toLocaleString()}` : `${cur} / ${t.target}`;
  return `<div class="stepper">
    <button type="button" data-step="${t.id}|-1" aria-label="decrease">−</button>
    <span class="count ${done ? "done" : ""}">${label}${t.targetLabel ? " " + esc(t.targetLabel) : ""}</span>
    <button type="button" data-step="${t.id}|1" aria-label="increase">+</button>
  </div>`;
}

function renderList() {
  const list = filteredTrophies();
  const box = document.getElementById("trophyList");
  document.getElementById("shownCount").textContent = `${list.length} shown of 55`;
  box.innerHTML = list.map((t) => {
    const hidden = isHiddenFromReader(t);
    const name = hidden ? "Hidden trophy — story spoiler" : esc(t.name);
    const desc = hidden
      ? `<span class="spoiled">Hidden on PlayStation until earned. Reveal it from the detail panel, or earn it.</span>`
      : esc(t.description);
    return `<div class="trow ${isEarned(t) ? "earned" : ""} ${state.selected === t.id ? "sel" : ""}" data-select="${t.id}">
      <input type="checkbox" data-earn="${t.id}" ${isEarned(t) ? "checked" : ""} aria-label="mark earned">
      <div>
        <div class="tname"><span class="gdot ${t.grade}"></span>${name}</div>
        <div class="tdesc">${desc}</div>
        <div class="tflags">${flagTags(t)}</div>
      </div>
      ${stepperHtml(t)}
    </div>`;
  }).join("");
}

function renderNextUp() {
  const upcoming = trophies.filter((t) => !isEarned(t)).sort((a, b) => a.order - b.order).slice(0, 5);
  document.getElementById("nextUp").innerHTML = upcoming.map((t) =>
    `<li><a href="#" data-select="${t.id}">${esc(t.name)}</a> <span class="tag">${t.kind}</span>${t.missable ? ' <span class="tag miss">Missable</span>' : ""}${t.atRisk ? ' <span class="tag risk">At risk</span>' : ""}</li>`).join("")
    || `<li>All 55 earned — the platinum is yours.</li>`;
}

function renderDetail() {
  const t = trophyById(state.selected) || trophies[0];
  const panel = document.getElementById("detailPanel");
  if (isHiddenFromReader(t)) {
    panel.innerHTML = `
      <h2>Hidden trophy</h2>
      <p class="official">This trophy is hidden on PlayStation until you earn it. Its name and description would spoil the story, so the spoiler shield keeps them covered.</p>
      <p>Grade: <b>${t.grade}</b> &middot; Chapter ${t.chapter || "—"} &middot; Stage ${t.stage}</p>
      <button type="button" class="reveal-btn" data-reveal="${t.id}">Reveal this trophy</button>
      <p class="muted">Revealing is your choice and only affects this browser.</p>`;
    return;
  }
  const srcCounts = {};
  for (const step of t.steps) for (const n of step.srcs) srcCounts[n] = (srcCounts[n] || 0) + 1;
  const srcLines = Object.keys(srcCounts).sort((a, b) => a - b).map((n) => {
    const s = sourceByNumber(Number(n));
    return `<li><b>[${n}] ${esc(s.site)}</b> — ${srcCounts[n]} claim${srcCounts[n] > 1 ? "s" : ""} here &middot; <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a></li>`;
  }).join("");
  const dispute = t.disputed ? `<div class="callout differ"><h3>Sources differ — shown both ways</h3><p>${esc(t.dispute)}</p></div>` : "";
  const watch = t.missable
    ? `<div class="callout"><h3>Possibly missable — last chance: Chapter 1</h3><p>Do the balcony meditation in Chapter 1. Whether the trophy needs it is unconfirmed, but it costs a minute and removes the risk either way.</p></div>`
    : t.atRisk
      ? `<div class="callout"><h3>At risk — last chance: ${esc(t.lastChance || "")}</h3><p>Start this chain the moment it unlocks and keep a chapter-end save. TechWiser reports story-progress windows on these chains; PowerPyx says they stay available after the story.</p></div>`
      : "";
  panel.innerHTML = `
    <h2>${esc(t.name)}</h2>
    <div class="grade-line"><span class="grade-pill ${t.grade}">${t.grade}</span>${flagTags(t)}</div>
    <p class="official">&ldquo;${esc(t.description)}&rdquo;</p>
    <p class="guide-text">${esc(t.guide)}</p>
    ${watch}${dispute}
    <h3>How to earn it — ${t.steps.length} steps, in our own words, each with its sources</h3>
    <ol class="steps">${t.steps.map((s) => `<li>${esc(s.text)} ${citeLinks(s.srcs)}</li>`).join("")}</ol>
    ${t.target ? `<p class="muted">Your count: ${progressOf(t)} / ${t.target} ${esc(t.targetLabel || "")} — use the − / + buttons on the list; it marks itself earned at the target.</p>` : ""}
    <div class="srcbox"><h3>Sources for this guide — ${Object.keys(srcCounts).length}</h3><ul>${srcLines}</ul></div>`;
}

function currentStage() {
  for (let n = 1; n <= 3; n++) {
    const inStage = trophies.filter((t) => t.stage === n);
    if (inStage.some((t) => !isEarned(t))) return n;
  }
  return 3;
}

function renderRoadmap() {
  const earned = trophies.filter(isEarned).length;
  document.getElementById("roadmapSummary").textContent =
    `${earned}/55 earned · stage ${currentStage()} of 3 now · about 200 hours, one playthrough, 4/10 difficulty.`;
  document.getElementById("hoursCallout").innerHTML =
    `<h3>How long? Sources differ — shown both ways</h3><p>${esc(roadmapDoc.hoursNote)}</p>`;
  document.getElementById("stageCards").innerHTML = roadmapDoc.stages.map((st, i) => {
    const n = i + 1;
    const inStage = trophies.filter((t) => t.stage === n).sort((a, b) => a.order - b.order);
    const done = inStage.filter(isEarned).length;
    return `<div class="card stage">
      <h2><span class="stage-num">${n}</span>${esc(st.title)}</h2>
      <p class="stage-meta">${esc(st.hours)} hours &middot; ${inStage.length} trophies &middot; ${done}/${inStage.length} earned</p>
      <div class="bar"><div class="fill" style="width:${done / inStage.length * 100}%"></div></div>
      <p>${esc(st.note)}</p>
      <ol>${st.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      <p class="muted">${inStage.map((t) => esc(t.name)).join(" · ")}</p>
    </div>`;
  }).join("");
  document.querySelector("#checklistTable tbody").innerHTML = roadmapDoc.checklist.map((row) =>
    `<tr><td>${esc(row.item)}</td><td>${esc(row.checklist)}</td><td>${esc(row.trophy)}</td></tr>`).join("");
  document.getElementById("saveNote").textContent = roadmapDoc.saveNote;
}

function renderMissables() {
  const pma = trophyById(28);
  document.getElementById("missableHero").innerHTML = `
    <h3>Possibly missable — last chance: Chapter 1</h3>
    <p><b>${esc(pma.name)}</b> — ${esc(pma.description)}</p>
    <p>${esc(pma.guide)}</p>
    <p><a href="#" data-select="${pma.id}" data-goto-tab="tracker">Open the full guide &rarr;</a></p>`;
  const atRisk = trophies.filter((t) => t.atRisk && !t.missable).sort((a, b) => a.order - b.order);
  document.getElementById("riskGrid").innerHTML = atRisk.map((t) => `
    <div class="card">
      <h2>${esc(t.name)}</h2>
      <p class="muted">${esc(t.description)}</p>
      <p><span class="tag risk">At risk</span> <span class="tag">Last chance: ${esc(t.lastChance || "")}</span>${t.unconfirmed ? ' <span class="tag unconf">Unconfirmed</span>' : ""}</p>
      <p>${esc(t.guide)}</p>
      <p><a href="#" data-select="${t.id}" data-goto-tab="tracker">Open the full guide &rarr;</a></p>
    </div>`).join("");
  document.getElementById("storyGates").innerHTML = roadmapDoc.storyGates.map((g) => `
    <div class="gate"><h4>Ch ${g.chapter}</h4>
      <ul>${g.missions.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
      <p class="muted">${g.trophies.map((name) => esc(name)).join(" · ")}</p>
    </div>`).join("");
}

function renderSources() {
  document.querySelector("#sourceCounts tbody").innerHTML = sourcesDoc.sources.map((s) => `
    <tr><td><b>[${s.n}] ${esc(s.site)}</b></td><td>${esc(s.read)}</td><td>${esc(s.depth)}</td><td>${s.guides}</td><td>${s.claims}</td></tr>`).join("");
  document.getElementById("sourceList").innerHTML = sourcesDoc.sources.map((s) => `
    <li><span class="s-title">[${s.n}] ${esc(s.site)} — ${esc(s.title)}</span><br>
    <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a><br>
    <span class="s-meta">Read ${esc(s.read)} &middot; ${esc(s.depth)} &middot; cited by ${s.guides} guide${s.guides === 1 ? "" : "s"} &middot; ${s.claims} claim${s.claims === 1 ? "" : "s"}${s.hiddenFlags ? ` &middot; backs the hidden flags for all ${s.hiddenFlags} hidden trophies` : ""}</span><br>
    ${esc(s.covers)}</li>`).join("");
  document.getElementById("disputeList").innerHTML = sourcesDoc.disputes.map((d) => `
    <div class="dispute"><h4>${d.id} — ${esc(d.topic)}</h4>
    <p><b>A:</b> ${esc(d.a)}</p>
    <p><b>B:</b> ${esc(d.b)}</p>
    <p><b>Our call:</b> ${esc(d.call)}</p></div>`).join("");
}

function renderAll() {
  renderAuditStrip();
  renderProgress();
  renderChips();
  renderList();
  renderNextUp();
  renderDetail();
  renderRoadmap();
  renderMissables();
  renderSources();
  document.getElementById("spoilerToggle").checked = state.spoiler;
}

function showTab(tab) {
  state.tab = tab;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tabpanel").forEach((p) => { p.hidden = p.id !== `tab-${tab}`; });
  if (location.hash !== `#${tab}`) history.replaceState(null, "", `#${tab}`);
}

function exportProgress() {
  const blob = new Blob([JSON.stringify({
    app: "sunset-ledger", version: 1,
    exportedAt: new Date().toISOString(),
    earned: [...state.earned].sort((a, b) => a - b),
    progress: state.progress,
  }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "sunset-ledger-progress.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function importProgress(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const ids = new Set(trophies.map((t) => t.id));
      state.earned = new Set((data.earned || []).filter((id) => ids.has(id)));
      state.progress = {};
      for (const [k, v] of Object.entries(data.progress || {})) {
        const id = Number(k);
        const t = trophyById(id);
        if (t && t.target && Number.isFinite(v)) state.progress[id] = Math.max(0, Math.min(t.target, Math.floor(v)));
      }
      saveState();
      renderAll();
      document.getElementById("savedNote").textContent = "✓ Imported — saved in this browser";
    } catch (e) {
      document.getElementById("savedNote").textContent = "Import failed — not a Sunset Ledger file";
    }
  };
  reader.readAsText(file);
}

function wireEvents() {
  document.getElementById("tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (btn) showTab(btn.dataset.tab);
  });
  document.getElementById("kindChips").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-kind]");
    if (!btn) return;
    state.kind = btn.dataset.kind;
    renderChips(); renderList();
  });
  document.getElementById("flagChips").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-flag]");
    if (!btn) return;
    state.flag = btn.dataset.flag;
    renderChips(); renderList();
  });
  document.getElementById("searchBox").addEventListener("input", (e) => { state.search = e.target.value; renderList(); });
  document.getElementById("sortBox").addEventListener("change", (e) => { state.sort = e.target.value; renderList(); });
  document.getElementById("spoilerToggle").addEventListener("change", (e) => {
    state.spoiler = e.target.checked; saveState(); renderList(); renderDetail();
  });
  document.getElementById("exportBtn").addEventListener("click", exportProgress);
  document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change", (e) => {
    if (e.target.files[0]) importProgress(e.target.files[0]);
    e.target.value = "";
  });

  document.addEventListener("click", (e) => {
    const earn = e.target.closest("[data-earn]");
    if (earn) {
      e.stopPropagation();
      const id = Number(earn.dataset.earn);
      if (earn.checked) state.earned.add(id); else state.earned.delete(id);
      saveState(); renderProgress(); renderList(); renderNextUp(); renderDetail(); renderRoadmap();
      return;
    }
    const step = e.target.closest("[data-step]");
    if (step) {
      const [id, delta] = step.dataset.step.split("|");
      const t = trophyById(Number(id));
      if (!t || !t.target) return;
      const next = Math.max(0, Math.min(t.target, progressOf(t) + Number(delta)));
      state.progress[t.id] = next;
      if (next >= t.target) state.earned.add(t.id);
      saveState(); renderProgress(); renderList(); renderNextUp(); renderDetail(); renderRoadmap();
      return;
    }
    const reveal = e.target.closest("[data-reveal]");
    if (reveal) {
      state.revealed.add(Number(reveal.dataset.reveal));
      saveState(); renderList(); renderDetail();
      return;
    }
    const goto = e.target.closest("[data-goto-tab]");
    if (goto) {
      e.preventDefault();
      state.selected = Number(goto.dataset.select);
      showTab(goto.dataset.gotoTab);
      renderList(); renderDetail();
      return;
    }
    const sel = e.target.closest("[data-select]");
    if (sel) {
      e.preventDefault();
      state.selected = Number(sel.dataset.select);
      renderList(); renderDetail();
      const panel = document.getElementById("detailPanel");
      if (panel && window.innerWidth < 1150) panel.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const src = e.target.closest("[data-goto-source]");
    if (src) {
      e.preventDefault();
      showTab("sources");
      const el = document.getElementById("sourceList");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  });
}

async function init() {
  loadState();
  seedDemoIfRequested();
  await loadData();
  const hash = location.hash.replace("#", "");
  if (["tracker", "roadmap", "missables", "sources"].includes(hash)) state.tab = hash;
  renderAll();
  showTab(state.tab);
  wireEvents();
}

init();

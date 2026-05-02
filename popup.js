// popup.js — XBoring

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const DEFAULT_PATTERNS = [
  "what are you building",
  "what are you working on",
  "what's everyone building",
  "what are you shipping",
  "i want to connect",
  "looking to connect",
  "let's connect",
  "want to connect with",
  "would love to connect",
  "dm me to connect",
  "drop your",
  "comment below and i'll",
  "retweet if you",
  "follow for follow",
  "follow back",
  "i'll follow everyone who",
  "share this if",
  "tag someone who",
  "who else is building",
  "total?",
  "like and retweet",
  "rt and follow",
  "gm gm",
  "just hit",
  "we just crossed",
  "excited to announce",
  "thrilled to share",
  "humbled to",
  "blessed to",
];

const MAX_PATTERN_LENGTH = 200;
const MAX_PATTERN_COUNT  = 500;

// ─── STATE ────────────────────────────────────────────────────────────────────

let patterns = [];
let enabled  = true;

// ─── VALIDATION ───────────────────────────────────────────────────────────────

function sanitizePatterns(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(p => typeof p === "string")
    .map(p => p.trim().toLowerCase().slice(0, MAX_PATTERN_LENGTH))
    .filter(p => p.length > 0)
    .slice(0, MAX_PATTERN_COUNT);
}

// ─── TABS ─────────────────────────────────────────────────────────────────────

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    const isActive = btn.id === `tab-${tab}`;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive);
  });
  document.querySelectorAll(".tab-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === `panel-${tab}`);
  });
}

// ─── RENDER ───────────────────────────────────────────────────────────────────

function renderFilters() {
  const keywords = patterns.filter(p => !p.startsWith("@"));
  const accounts  = patterns.filter(p =>  p.startsWith("@"));

  document.getElementById("count-keywords").textContent = keywords.length;
  document.getElementById("count-accounts").textContent  = accounts.length;

  renderList("list-keywords", keywords);
  renderList("list-accounts",  accounts);
}

/**
 * Construit la liste DOM sans innerHTML pour éviter tout XSS.
 * Suppression par valeur (indexOf au moment du clic) plutôt que
 * par index stocké au rendu — robuste aux modifications concurrentes.
 */
function renderList(containerId, items) {
  const list = document.getElementById(containerId);
  list.textContent = "";

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className   = "empty-state";
    empty.textContent = "Nothing here yet";
    list.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach(p => {
    const row = document.createElement("div");
    row.className = "filter-row";

    const pip = document.createElement("div");
    pip.className = "filter-pip";

    const text = document.createElement("span");
    text.className   = "filter-text";
    text.textContent = p;
    text.title       = p;

    const del = document.createElement("button");
    del.className   = "filter-del";
    del.type        = "button";
    del.title       = "Remove";
    del.textContent = "✕";
    del.addEventListener("click", () => {
      const idx = patterns.indexOf(p);
      if (idx !== -1) patterns.splice(idx, 1);
      saveAndSync();
      renderFilters();
    });

    row.appendChild(pip);
    row.appendChild(text);
    row.appendChild(del);
    fragment.appendChild(row);
  });

  list.appendChild(fragment);
}

// ─── ADD ──────────────────────────────────────────────────────────────────────

function addFilter(tab) {
  const input = document.getElementById(`input-${tab}`);
  let val = input.value.trim().toLowerCase().slice(0, MAX_PATTERN_LENGTH);
  if (!val) return;

  if (tab === "accounts") {
    val = "@" + val.replace(/^@+/, "");
  }

  if (patterns.length >= MAX_PATTERN_COUNT || patterns.includes(val)) {
    flashInput(input);
    return;
  }

  patterns.push(val);
  saveAndSync();
  renderFilters();
  input.value = "";
  input.focus();
}

function flashInput(input) {
  input.style.borderColor = "#ff5252";
  setTimeout(() => { input.style.borderColor = ""; }, 800);
}

// ─── TOGGLE UI ────────────────────────────────────────────────────────────────

function updateToggleUI() {
  const label = document.getElementById("toggle-label");
  label.textContent = enabled ? "ON" : "OFF";
  label.classList.toggle("on", enabled);
}

// ─── STORAGE + SYNC ───────────────────────────────────────────────────────────

function saveAndSync() {
  chrome.storage.sync.set({ patterns }, () => {
    sendToActiveTab({ action: "updatePatterns", patterns });
  });
}

function sendToActiveTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
    }
  });
}

// ─── COUNT ────────────────────────────────────────────────────────────────────

/**
 * Affiche le total = posts cachés sessions précédentes (storage.local)
 * + posts cachés dans l'onglet actif depuis son dernier chargement (mémoire).
 * Les deux sont additionnés, pas écrasés l'un par l'autre.
 */
function loadCount() {
  const el = document.getElementById("hidden-count");

  chrome.storage.local.get("hiddenCount", (result) => {
    const persisted = result.hiddenCount || 0;

    // Affichage immédiat avec le persisté, mis à jour si l'onglet répond
    el.textContent = persisted;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: "getCount" }, (resp) => {
        if (chrome.runtime.lastError) return;
        if (resp?.count !== undefined) {
          // Additionner : persisté (sessions passées) + live (session courante)
          el.textContent = persisted + resp.count;
        }
      });
    });
  });
}

// ─── RESET CONFIRM ────────────────────────────────────────────────────────────

const confirmWrap = document.getElementById("confirm-wrap");

function showConfirm() {
  confirmWrap.classList.add("visible");
}

function hideConfirm() {
  confirmWrap.classList.remove("visible");
}

document.getElementById("reset-btn").addEventListener("click", showConfirm);
document.getElementById("confirm-no").addEventListener("click", hideConfirm);
document.getElementById("confirm-yes").addEventListener("click", () => {
  hideConfirm();
  patterns = [...DEFAULT_PATTERNS];
  saveAndSync();
  renderFilters();
});

// ─── EVENTS ───────────────────────────────────────────────────────────────────

["keywords", "accounts"].forEach(tab => {
  document.getElementById(`input-${tab}`).addEventListener("keydown", (e) => {
    if (e.key === "Enter") addFilter(tab);
  });
  document.getElementById(`tab-${tab}`).addEventListener("click", () => switchTab(tab));
  document.getElementById(`add-${tab}`).addEventListener("click", () => addFilter(tab));
});

document.getElementById("main-toggle").addEventListener("change", (e) => {
  enabled = e.target.checked;
  chrome.storage.sync.set({ enabled });
  updateToggleUI();
  sendToActiveTab({ action: "toggle", enabled });
});

// ─── INIT ─────────────────────────────────────────────────────────────────────

chrome.storage.sync.get(["patterns", "enabled"], (result) => {
  patterns = result.patterns != null
    ? sanitizePatterns(result.patterns)
    : [...DEFAULT_PATTERNS];

  enabled = result.enabled !== false;
  document.getElementById("main-toggle").checked = enabled;
  updateToggleUI();
  renderFilters();
  loadCount();
});
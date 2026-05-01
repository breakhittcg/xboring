// popup.js — XBoring

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
  "excited to announce",
  "thrilled to share",
  "humbled to",
  "blessed to",
];

let patterns = [];
let enabled = true;

// ─── TABS ─────────────────────────────────────────────────────────────────────

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");
  document.getElementById(`panel-${tab}`).classList.add("active");
}

// ─── RENDER ──────────────────────────────────────────────────────────────────

function renderFilters() {
  const keywords = patterns.filter(p => !p.startsWith("@"));
  const accounts = patterns.filter(p => p.startsWith("@"));

  document.getElementById("count-keywords").textContent = keywords.length;
  document.getElementById("count-accounts").textContent = accounts.length;

  renderList("list-keywords", keywords);
  renderList("list-accounts", accounts);
}

function renderList(containerId, items) {
  const list = document.getElementById(containerId);
  list.innerHTML = "";

  if (items.length === 0) {
    list.innerHTML = `<div class="empty-state">Nothing here yet</div>`;
    return;
  }

  items.forEach((p) => {
    const globalIndex = patterns.indexOf(p);
    const item = document.createElement("div");
    item.className = "filter-row";
    item.innerHTML = `
      <div class="filter-pip"></div>
      <span class="filter-text" title="${p}">${p}</span>
      <button class="filter-del" data-index="${globalIndex}" title="Remove">✕</button>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll(".filter-del").forEach(btn => {
    btn.addEventListener("click", () => {
      patterns.splice(parseInt(btn.dataset.index), 1);
      saveAndSync();
      renderFilters();
    });
  });
}

// ─── ADD ─────────────────────────────────────────────────────────────────────

function addFilter(tab) {
  const input = document.getElementById(`input-${tab}`);
  let val = input.value.trim().toLowerCase();
  if (!val) return;

  if (tab === "accounts") {
    val = "@" + val.replace(/^@+/, "");
  }

  if (patterns.includes(val)) {
    input.style.borderColor = "#ff5252";
    setTimeout(() => input.style.borderColor = "", 800);
    return;
  }

  patterns.push(val);
  saveAndSync();
  renderFilters();
  input.value = "";
  input.focus();
}

// Enter key
["keywords", "accounts"].forEach(tab => {
  document.getElementById(`input-${tab}`).addEventListener("keydown", (e) => {
    if (e.key === "Enter") addFilter(tab);
  });
  document.getElementById(`tab-${tab}`).addEventListener("click", () => switchTab(tab));
  document.getElementById(`add-${tab}`).addEventListener("click", () => addFilter(tab));
});

// ─── TOGGLE UI ───────────────────────────────────────────────────────────────

function updateToggleUI() {
  const label = document.getElementById("toggle-label");
  label.textContent = enabled ? "ON" : "OFF";
  label.className = enabled ? "toggle-label on" : "toggle-label";
}

// ─── STORAGE + SYNC ──────────────────────────────────────────────────────────

function saveAndSync() {
  chrome.storage.sync.set({ patterns }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "updatePatterns", patterns }).catch(() => {});
      }
    });
  });
}

// ─── COUNT ───────────────────────────────────────────────────────────────────

function loadCount() {
  chrome.storage.sync.get(["hiddenCount"], (result) => {
    if (result.hiddenCount) document.getElementById("hidden-count").textContent = result.hiddenCount;
  });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "getCount" }, (resp) => {
        if (resp && resp.count !== undefined) document.getElementById("hidden-count").textContent = resp.count;
      });
    }
  });
}

// ─── INIT ────────────────────────────────────────────────────────────────────

chrome.storage.sync.get(["patterns", "enabled"], (result) => {
  patterns = result.patterns || [...DEFAULT_PATTERNS];
  enabled = result.enabled !== false;
  document.getElementById("main-toggle").checked = enabled;
  updateToggleUI();
  renderFilters();
  loadCount();
});

// ─── EVENTS ──────────────────────────────────────────────────────────────────

document.getElementById("main-toggle").addEventListener("change", (e) => {
  enabled = e.target.checked;
  chrome.storage.sync.set({ enabled });
  updateToggleUI();
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "toggle", enabled }).catch(() => {});
  });
});

document.getElementById("reset-btn").addEventListener("click", () => {
  if (confirm("Reset all filters to defaults?")) {
    patterns = [...DEFAULT_PATTERNS];
    saveAndSync();
    renderFilters();
  }
});

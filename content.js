// XBoring - content.js

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

let activePatterns = [...DEFAULT_PATTERNS];
let hiddenCount = 0;
let observer = null;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getTweetText(article) {
  const textEl = article.querySelector('[data-testid="tweetText"]');
  return textEl ? textEl.innerText : article.innerText;
}

function getAuthorHandle(article) {
  const link = article.querySelector('a[href*="/status/"]');
  if (link) {
    const match = link.href.match(/x\.com\/([^/]+)\/status/);
    if (match) return "@" + match[1].toLowerCase();
  }
  return null;
}

// ─── HIDE LOGIC ───────────────────────────────────────────────────────────────

function collapseArticle(article) {
  article.dataset.xfiltered = "hidden";
  article.style.transition = "opacity 0.3s ease, max-height 0.4s ease";
  article.style.overflow = "hidden";
  article.style.opacity = "0";
  setTimeout(() => {
    article.style.maxHeight = "0";
    article.style.padding = "0";
    article.style.margin = "0";
    article.style.border = "0";
  }, 300);
  hiddenCount++;
  chrome.storage.sync.set({ hiddenCount });
}

function shouldHideTweet(article) {
  const text = getTweetText(article).toLowerCase();
  const author = getAuthorHandle(article);
  return activePatterns.some(p => {
    if (p.startsWith("@")) return author === p;
    return text.includes(p.toLowerCase());
  });
}

// ─── FILTER ───────────────────────────────────────────────────────────────────

function processTweet(article) {
  if (article.dataset.xfiltered === "hidden") return;
  if (article.dataset.xfiltered === "checked") return;
  article.dataset.xfiltered = "checked";
  if (shouldHideTweet(article)) collapseArticle(article);
}

function filterTweets() {
  document.querySelectorAll('article[data-testid="tweet"]').forEach(processTweet);
}

// ─── OBSERVER ─────────────────────────────────────────────────────────────────

function startFiltering() {
  filterTweets();
  if (observer) observer.disconnect();
  observer = new MutationObserver(() => filterTweets());
  observer.observe(document.body, { childList: true, subtree: true });
}

function stopFiltering() {
  if (observer) { observer.disconnect(); observer = null; }
  document.querySelectorAll('[data-xfiltered]').forEach(article => {
    article.style.opacity = "1";
    article.style.maxHeight = "";
    article.style.padding = "";
    article.style.margin = "";
    article.style.border = "";
    article.style.overflow = "";
    delete article.dataset.xfiltered;
  });
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────

function loadPatterns() {
  chrome.storage.sync.get(["patterns", "enabled", "hiddenCount"], (result) => {
    if (result.patterns) activePatterns = result.patterns;
    if (result.hiddenCount) hiddenCount = result.hiddenCount;
    if (result.enabled !== false) startFiltering();
  });
}

// ─── MESSAGES ─────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toggle") message.enabled ? startFiltering() : stopFiltering();
  if (message.action === "updatePatterns") { activePatterns = message.patterns; filterTweets(); }
  if (message.action === "getCount") sendResponse({ count: hiddenCount });
});

// ─── INIT ─────────────────────────────────────────────────────────────────────

loadPatterns();

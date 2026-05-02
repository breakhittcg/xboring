// XBoring - content.js

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

let activePatterns = [...DEFAULT_PATTERNS];

// Compteur de session : repart à 0 à chaque chargement de page.
// Le popup additionne ce compteur avec le total persisté dans storage.local
// pour afficher le grand total toutes sessions confondues.
let hiddenCount = 0;

let observer   = null;
let rafPending = false;

// WeakMap : zéro attribut DOM, zéro fingerprinting, survit aux reloads SPA.
// Set compagnon pour pouvoir itérer les articles cachés dans stopFiltering.
const visitedArticles = new WeakMap(); // article → "checked" | "hidden"
const hiddenArticles  = new Set();     // articles actuellement cachés

// Patterns compilés — mis à jour via compilePatterns()
let keywordRegex = null;
let accountSet   = new Set();

// ─── VALIDATION ───────────────────────────────────────────────────────────────

function sanitizePatterns(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(p => typeof p === "string")
    .map(p => p.trim().toLowerCase().slice(0, MAX_PATTERN_LENGTH))
    .filter(p => p.length > 0)
    .slice(0, MAX_PATTERN_COUNT);
}

// ─── PATTERN COMPILATION ──────────────────────────────────────────────────────

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Compile les patterns en une RegExp unique et un Set de comptes.
 * Appelé à chaque mise à jour des patterns pour amortir le coût
 * sur toutes les évaluations suivantes (O(n×m) → O(n) par passe).
 */
function compilePatterns(patterns) {
  const keywords = patterns.filter(p => !p.startsWith("@"));
  const accounts  = patterns.filter(p =>  p.startsWith("@"));

  keywordRegex = keywords.length
    ? new RegExp(keywords.map(escapeRegExp).join("|"), "i")
    : null;

  accountSet = new Set(accounts);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getTweetText(article) {
  const textEl = article.querySelector('[data-testid="tweetText"]');
  return textEl ? textEl.innerText : article.innerText;
}

function getAuthorHandle(article) {
  const link = article.querySelector('a[href*="/status/"]');
  if (!link) return null;
  const match = link.href.match(/x\.com\/([^/]+)\/status/);
  return match ? "@" + match[1].toLowerCase() : null;
}

// ─── HIDE LOGIC ───────────────────────────────────────────────────────────────

function collapseArticle(article) {
  visitedArticles.set(article, "hidden");
  hiddenArticles.add(article);

  article.style.transition = "opacity 0.3s ease, max-height 0.4s ease";
  article.style.overflow   = "hidden";
  article.style.opacity    = "0";

  setTimeout(() => {
    article.style.maxHeight = "0";
    article.style.padding   = "0";
    article.style.margin    = "0";
    article.style.border    = "0";
  }, 300);

  // Compteur session (lu par getCount, combiné avec le persisté dans le popup)
  hiddenCount++;

  // Compteur historique persisté — indépendant de hiddenCount
  chrome.storage.local.get("hiddenCount", (res) => {
    chrome.storage.local.set({ hiddenCount: (res.hiddenCount || 0) + 1 });
  });
}

function shouldHideTweet(article) {
  const author = getAuthorHandle(article);
  if (author && accountSet.has(author)) return true;
  if (!keywordRegex) return false;
  return keywordRegex.test(getTweetText(article));
}

// ─── FILTER ───────────────────────────────────────────────────────────────────

function processTweet(article) {
  if (visitedArticles.has(article)) return;
  visitedArticles.set(article, "checked");
  if (shouldHideTweet(article)) collapseArticle(article);
}

function filterTweets() {
  document.querySelectorAll('article[data-testid="tweet"]').forEach(processTweet);
}

// ─── OBSERVER ─────────────────────────────────────────────────────────────────

/**
 * Tente d'observer le conteneur du feed plutôt que document.body
 * pour réduire le nombre de mutations reçues (sidebar, notifications...).
 * Fallback sur document.body si le sélecteur n'est pas encore dans le DOM.
 */
function getObserverRoot() {
  return document.querySelector('[data-testid="primaryColumn"]') || document.body;
}

function startFiltering() {
  filterTweets();
  if (observer) observer.disconnect();

  observer = new MutationObserver(() => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      filterTweets();
      rafPending = false;
    });
  });

  observer.observe(getObserverRoot(), { childList: true, subtree: true });
}

function stopFiltering() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }

  hiddenArticles.forEach(article => {
    article.style.opacity   = "1";
    article.style.maxHeight = "";
    article.style.padding   = "";
    article.style.margin    = "";
    article.style.border    = "";
    article.style.overflow  = "";
    visitedArticles.delete(article);
  });

  hiddenArticles.clear();
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────

/**
 * hiddenCount repart de 0 à chaque chargement — c'est le compteur de session.
 * Le total historique vit dans storage.local et est géré indépendamment.
 */
function loadPatterns() {
  chrome.storage.sync.get(["patterns", "enabled"], (syncResult) => {
    if (syncResult.patterns) {
      activePatterns = sanitizePatterns(syncResult.patterns);
    }
    compilePatterns(activePatterns);
    if (syncResult.enabled !== false) startFiltering();
  });
}

// ─── MESSAGES ─────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.action !== "string") return;

  switch (message.action) {
    case "toggle":
      message.enabled ? startFiltering() : stopFiltering();
      break;

    case "updatePatterns":
      activePatterns = sanitizePatterns(message.patterns);
      compilePatterns(activePatterns);
      filterTweets();
      break;

    case "getCount":
      sendResponse({ count: hiddenCount });
      break;
  }
});

// ─── INIT ─────────────────────────────────────────────────────────────────────

loadPatterns();
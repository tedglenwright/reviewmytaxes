// ReviewMyTaxes — Shared State Management (loaded on all pages)

// ═══════════════════════════════════════════════════════════════
// ACTIVITY LOG — captures user actions for debugging
// ═══════════════════════════════════════════════════════════════
const MAX_LOG_ENTRIES = 200;

function rlog(action, detail) {
  try {
    const logs = JSON.parse(localStorage.getItem('rmt_log') || '[]');
    logs.push({
      t: new Date().toISOString(),
      a: action,
      d: typeof detail === 'object' ? JSON.stringify(detail) : String(detail || ''),
      url: window.location.href.substring(0, 200),
    });
    // Keep only last N entries
    if (logs.length > MAX_LOG_ENTRIES) logs.splice(0, logs.length - MAX_LOG_ENTRIES);
    localStorage.setItem('rmt_log', JSON.stringify(logs));
  } catch(e) {}
}

function getLog() {
  try { return JSON.parse(localStorage.getItem('rmt_log') || '[]'); } catch(e) { return []; }
}

function showDebugLog() {
  const logs = getLog();
  const logText = logs.map(l => `[${l.t}] ${l.a}: ${l.d}${l.url ? ' @ ' + l.url : ''}`).join('\n');
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;padding:20px';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `
    <div style="background:#1e293b;border:1px solid #475569;border-radius:12px;padding:20px;max-width:700px;width:100%;max-height:80vh;display:flex;flex-direction:column">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="color:#f8fafc;font-size:16px;margin:0">Activity Log (${logs.length} entries)</h3>
        <div style="display:flex;gap:8px">
          <button onclick="navigator.clipboard.writeText(this.closest('div').parentElement.querySelector('pre').textContent);this.textContent='Copied!'" style="padding:6px 12px;background:#3b82f6;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer">Copy</button>
          <button onclick="localStorage.removeItem('rmt_log');this.closest('div').closest('div').closest('div').remove()" style="padding:6px 12px;background:#ef4444;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer">Clear</button>
          <button onclick="this.closest('div').closest('div').closest('div').remove()" style="padding:6px 12px;background:#475569;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer">Close</button>
        </div>
      </div>
      <pre style="color:#94a3b8;font-size:11px;line-height:1.5;overflow:auto;flex:1;background:#0f172a;padding:12px;border-radius:8px;white-space:pre-wrap;word-break:break-all">${logText || 'No log entries yet'}</pre>
    </div>
  `;
  document.body.appendChild(modal);
}

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const APP_BUILD = document.querySelector('meta[name="build"]')?.content || 'BUILD_TOKEN';
const APP_VERSION = 'v1.0.' + APP_BUILD;
const GITHUB_REPO = 'https://github.com/tedglenwright/reviewmytaxes';
const GITHUB_SOURCE = GITHUB_REPO + '/blob/main/index.html';
const GITHUB_ISSUES = GITHUB_REPO + '/issues';
const GITHUB_LICENSE = GITHUB_REPO + '/blob/main/LICENSE';

// ═══════════════════════════════════════════════════════════════
// STRIPE CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51T8wONRsVTiXg9w7lAViMeXUo3BjYuVQ5CPjfHIFjPOCd0tVRqSehgbfpTT3xJwagQnuOgBNzE7r0e9HUr7f51pY00cUcmUkO6';
const STRIPE_PAYMENT_LINKS = {
  per_question: 'https://buy.stripe.com/8x25kFgIG38x1xubtB1Nu01',
};
let stripeInstance = null;
try {
  if (typeof Stripe !== 'undefined' && STRIPE_PUBLISHABLE_KEY && !STRIPE_PUBLISHABLE_KEY.includes('REPLACE')) {
    stripeInstance = Stripe(STRIPE_PUBLISHABLE_KEY);
  }
} catch(e) { console.warn('Stripe not loaded:', e); }

// Check for payment return from Stripe (with localStorage persistence)
let PAID_QUESTIONS = 0;
let PENDING_QUESTION_ID = null; // Question user was trying to answer before payment
try {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('paid')) {
    rlog('PAYMENT_RETURN', { paid: urlParams.get('paid'), url: window.location.href });
    // Add credit to existing balance (don't overwrite)
    const existing = JSON.parse(localStorage.getItem('rmt_payment') || '{}');
    const currentPaid = (existing.paidQuestions || 0);
    const currentUsed = (existing.usedQuestions || 0);
    localStorage.setItem('rmt_payment', JSON.stringify({
      paidQuestions: currentPaid + 1,
      usedQuestions: currentUsed,
      timestamp: Date.now()
    }));
    PAID_QUESTIONS = (currentPaid + 1) - currentUsed;
    rlog('CREDIT_ADDED', { newBalance: PAID_QUESTIONS, totalPaid: currentPaid + 1, totalUsed: currentUsed });
    // Restore the question they were trying to answer
    PENDING_QUESTION_ID = localStorage.getItem('rmt_pending_question') || null;
    rlog('PENDING_QUESTION', PENDING_QUESTION_ID || 'none');
    window.history.replaceState({}, '', window.location.pathname);
  } else {
    const stored = JSON.parse(localStorage.getItem('rmt_payment') || '{}');
    if (stored.timestamp && (Date.now() - stored.timestamp) < 24 * 60 * 60 * 1000) {
      PAID_QUESTIONS = (stored.paidQuestions || 0) - (stored.usedQuestions || 0);
      if (PAID_QUESTIONS < 0) PAID_QUESTIONS = 0;
    } else if (stored.timestamp) {
      localStorage.removeItem('rmt_payment');
    }
  }
} catch(e) { rlog('PAYMENT_ERROR', e.message); }

rlog('PAGE_LOAD', { version: APP_VERSION, credits: PAID_QUESTIONS, page: window.location.pathname });

// Track version for "What's New" indicator
const LAST_SEEN_VERSION = localStorage.getItem('rmt_last_version') || '';
const HAS_NEW_VERSION = LAST_SEEN_VERSION !== APP_VERSION && LAST_SEEN_VERSION !== '';
function markVersionSeen() { localStorage.setItem('rmt_last_version', APP_VERSION); }

// ═══════════════════════════════════════════════════════════════
// APPLICATION STATE
// ═══════════════════════════════════════════════════════════════
let STATE = {
  screen: 'upload',
  files: [],
  parsedDocs: [],
  taxData: null,
  result: null,
  tab: 'return',
  answeredQs: new Set((() => { try { return JSON.parse(localStorage.getItem('rmt_answered') || '[]'); } catch(e) { return []; } })()),
  ocrProgress: 0,
  ocrLogs: [],
  ocrCurrentFile: 0,
  ocrTotalFiles: 0,
  networkRequests: 0,
  networkSafe: true,
  originalResult: null,
};

// ═══════════════════════════════════════════════════════════════
// CROSS-PAGE STATE PERSISTENCE
// ═══════════════════════════════════════════════════════════════
function saveTaxData() {
  try {
    localStorage.setItem('rmt_taxData', JSON.stringify(STATE.taxData));
    // Only persist 'review' — never save transient states like 'parsing'
    localStorage.setItem('rmt_screen', STATE.screen === 'review' ? 'review' : 'upload');
  } catch(e) { console.warn('Could not save state:', e); }
}

function loadTaxData() {
  try {
    const data = localStorage.getItem('rmt_taxData');
    if (data) {
      STATE.taxData = JSON.parse(data);
      return true;
    }
  } catch(e) { console.warn('Could not load state:', e); }
  return false;
}

function saveAnswered() {
  try {
    localStorage.setItem('rmt_answered', JSON.stringify([...STATE.answeredQs]));
  } catch(e) {}
}

function loadAnswered() {
  try {
    const stored = localStorage.getItem('rmt_answered');
    if (stored) STATE.answeredQs = new Set(JSON.parse(stored));
  } catch(e) {}
}

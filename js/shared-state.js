// ReviewMyTaxes — Shared State Management (loaded on all pages)

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const APP_BUILD = document.querySelector('meta[name="build"]')?.content || 'dev';
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
    // Restore the question they were trying to answer
    PENDING_QUESTION_ID = localStorage.getItem('rmt_pending_question') || null;
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
} catch(e) {}

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
    localStorage.setItem('rmt_screen', STATE.screen);
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

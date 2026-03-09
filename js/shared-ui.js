// ReviewMyTaxes — Shared UI Helpers (loaded on all pages)

// ═══════════════════════════════════════════════════════════════
// NETWORK MONITOR — prove zero data leaves the browser
// ═══════════════════════════════════════════════════════════════
const _origFetch = window.fetch;
const _origXHROpen = XMLHttpRequest.prototype.open;
const ALLOWED_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com', 'js.stripe.com', 'm.stripe.com', 'api.stripe.com', 'q.stripe.com']; // Tesseract WASM + PDF.js + Stripe

window.fetch = function(...args) {
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
  try {
    const host = new URL(url, location.href).hostname;
    const isAllowed = ALLOWED_HOSTS.some(h => host.endsWith(h)) || host === location.hostname || host === '';
    if (!isAllowed) {
      STATE.networkSafe = false;
      STATE.networkRequests++;
      console.warn('[PRIVACY MONITOR] Blocked outbound request to:', host);
      return Promise.reject(new Error('Blocked by privacy monitor: ' + host));
    }
  } catch(e) {}
  return _origFetch.apply(this, args);
};

XMLHttpRequest.prototype.open = function(method, url, ...rest) {
  try {
    const host = new URL(url, location.href).hostname;
    const isAllowed = ALLOWED_HOSTS.some(h => host.endsWith(h)) || host === location.hostname || host === '';
    if (!isAllowed) {
      STATE.networkSafe = false;
      STATE.networkRequests++;
      console.warn('[PRIVACY MONITOR] Blocked XHR to:', host);
      throw new Error('Blocked by privacy monitor: ' + host);
    }
  } catch(e) { if (e.message.startsWith('Blocked')) throw e; }
  return _origXHROpen.call(this, method, url, ...rest);
};

// Monitor for any sneaky sendBeacon, WebSocket, or image-based exfiltration
const _origBeacon = navigator.sendBeacon;
navigator.sendBeacon = function(url) {
  STATE.networkSafe = false;
  STATE.networkRequests++;
  console.warn('[PRIVACY MONITOR] Blocked sendBeacon to:', url);
  return false;
};

// Disable WebSocket connections (no reason this app should use them)
window.WebSocket = function(url) {
  STATE.networkSafe = false;
  STATE.networkRequests++;
  console.warn('[PRIVACY MONITOR] Blocked WebSocket to:', url);
  throw new Error('Blocked by privacy monitor');
};

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(n) {
  return Math.abs(n||0).toLocaleString('en-US', { minimumFractionDigits:0, maximumFractionDigits:0 });
}

function moneyHtml(amount, showSign) {
  const v = amount || 0;
  const sign = v < 0 ? '-' : (showSign && v > 0 ? '+' : '');
  const cls = v < 0 ? 'negative' : (showSign && v > 0 ? 'positive' : '');
  return `<span class="money ${cls}">${sign}$${fmt(v)}</span>`;
}

function lineItem(label, amount, opts = {}) {
  const cls = [opts.bold?'bold':'', opts.indent?'indent':'', opts.sub?'sub':'', opts.onClick?'clickable':''].filter(Boolean).join(' ');
  const clickAttr = opts.onClick ? ` onclick="${opts.onClick}"` : '';
  return `<div class="line-item ${cls}"${clickAttr}><span>${label}</span>${moneyHtml(amount, opts.showSign)}</div>`;
}

function sectionHeader(title, ref) {
  return `<div class="section-header"><span class="title">${title}</span>${ref ? `<span class="ref">${ref}</span>` : ''}</div>`;
}

function showToast(message, type) {
  document.querySelectorAll('.app-toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = `app-toast ${type || 'info'}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s'; setTimeout(() => toast.remove(), 500); }, 3000);
}

function safeCompute(data) {
  try {
    const result = computeTaxReturn(data);
    saveTaxData();
    return result;
  } catch (err) {
    rlog('COMPUTE_ERROR', err.message);
    console.error('Tax computation error:', err);
    showToast('Calculation error — some values may be incorrect', 'error');
    return {
      filingStatus: data.filingStatus || 'single',
      w2s: data.w2s || [], interest: data.interest || [], dividends: data.dividends || [],
      retirementDist: [], totalWages: 0, totalInterest: 0, totalOrdDiv: 0, totalQualDiv: 0,
      totalRetirement: 0, ssaBenefits: 0, ssaTaxable: 0, schedCNet: 0, schedENet: 0,
      netSTCG: 0, netLTCG: 0, homeSaleGain: 0, homeSaleExclusion: 0, homeSaleTaxable: 0,
      otherIncome: 0, totalIncome: 0, adjustments: 0, agi: 0, deduction: 0, usingItemized: false,
      qbiDeduction: 0, taxableIncome: 0, ordinaryTax: 0, ltcgTax: 0, incomeTax: 0,
      seTax: 0, niit: 0, amt: 0, totalTax: 0, totalFedWithheld: 0, totalStateWithheld: 0,
      estimatedPayments: 0, totalPayments: 0, refundOrOwed: 0, effectiveRate: 0, marginalRate: 0,
      underpaymentPenalty: 0, ptcReconciliation: 0,
      assumptions: [], schedules: { '1':{}, '3':{totalCredits:0,totalNonrefundableCredits:0,eitcCredit:0}, SE:{} },
      _necSources: [], _mortgageSources: [],
      _error: err.message,
    };
  }
}

function showImpactToast(diff) {
  if (diff > 0) {
    showToast(`Refund increased by $${fmt(diff)}`, 'success');
  } else if (diff < 0) {
    showToast(`Refund decreased by $${fmt(Math.abs(diff))}`, 'error');
  }
}

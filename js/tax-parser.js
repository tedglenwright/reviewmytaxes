// ReviewMyTaxes — Document Parser (only loaded on upload page)

// ═══════════════════════════════════════════════════════════════
// LAZY-LOAD TESSERACT.JS (only when OCR is actually needed)
// ═══════════════════════════════════════════════════════════════
let _tesseractLoading = null;
async function ensureTesseract() {
  if (typeof Tesseract !== 'undefined') return;
  if (_tesseractLoading) return _tesseractLoading;
  _tesseractLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Tesseract.js OCR engine'));
    document.head.appendChild(script);
  });
  return _tesseractLoading;
}

// ═══════════════════════════════════════════════════════════════
// LAZY-LOAD HEIC2ANY (only when HEIC files are uploaded)
// ═══════════════════════════════════════════════════════════════
let _heicLoading = null;
async function ensureHeic2Any() {
  if (typeof heic2any !== 'undefined') return;
  if (_heicLoading) return _heicLoading;
  _heicLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load HEIC converter'));
    document.head.appendChild(script);
  });
  return _heicLoading;
}

function isHEIC(file) {
  const ext = file.name.toLowerCase().split('.').pop();
  return ext === 'heic' || ext === 'heif' || file.type === 'image/heic' || file.type === 'image/heif';
}

async function convertHEICtoJPEG(file) {
  await ensureHeic2Any();
  const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  // heic2any may return array for multi-image HEIC
  const result = Array.isArray(blob) ? blob[0] : blob;
  return new File([result], file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'), { type: 'image/jpeg' });
}

// ═══════════════════════════════════════════════════════════════
// LAZY-LOAD SHEETJS (only when Excel/CSV files are uploaded)
// ═══════════════════════════════════════════════════════════════
let _sheetjsLoading = null;
async function ensureSheetJS() {
  if (typeof XLSX !== 'undefined') return;
  if (_sheetjsLoading) return _sheetjsLoading;
  _sheetjsLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load SheetJS Excel parser'));
    document.head.appendChild(script);
  });
  return _sheetjsLoading;
}

function isSpreadsheet(file) {
  const ext = file.name.toLowerCase().split('.').pop();
  const spreadsheetExts = ['xlsx', 'xls', 'csv', 'tsv', 'ods', 'gsheet'];
  const spreadsheetTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/tab-separated-values',
    'application/vnd.oasis.opendocument.spreadsheet',
  ];
  return spreadsheetExts.includes(ext) || spreadsheetTypes.includes(file.type);
}

// ═══════════════════════════════════════════════════════════════
// OCR DOCUMENT PARSER
// ═══════════════════════════════════════════════════════════════
class TaxDocumentParser {
  constructor(onLog, onProgress) {
    this.onLog = onLog || (()=>{});
    this.onProgress = onProgress || (()=>{});
  }

  async parseFile(file) {
    this.onLog(`Parsing: ${file.name}`);

    // Convert HEIC/HEIF to JPEG before processing
    if (isHEIC(file)) {
      this.onLog('HEIC image detected — converting to JPEG...');
      try {
        file = await convertHEICtoJPEG(file);
        this.onLog('HEIC conversion complete');
      } catch (e) {
        this.onLog('⚠ HEIC conversion failed: ' + (e.message || e));
        throw new Error('Could not convert HEIC image. Try converting to JPEG or PNG first.');
      }
    }

    // Route by file type
    if (isSpreadsheet(file)) {
      return this.parseSpreadsheet(file);
    }

    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPDF) {
      return this.parsePDF(file);
    } else {
      return this.parseImage(file);
    }
  }

  async parsePDF(file) {
    this.onLog('Detected PDF — extracting text with layout awareness...');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    this.onLog(`PDF has ${numPages} page(s)`);

    let allText = '';

    for (let i = 1; i <= numPages; i++) {
      this.onLog(`Processing page ${i} of ${numPages}...`);
      this.onProgress(Math.round((i - 1) / numPages * 30));

      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Layout-aware text extraction: use positional data to preserve columns
      const pageText = this.extractWithLayout(textContent.items);

      if (pageText.trim().length > 50) {
        this.onLog(`Page ${i}: extracted ${pageText.length} chars with layout preservation`);
        allText += pageText + '\n';
      } else {
        // Scanned/image PDF — render to canvas and OCR
        this.onLog(`Page ${i}: scanned/image PDF detected — running OCR...`);
        const scale = 3.0; // Higher scale for better OCR accuracy on image-only PDFs
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        await page.render({ canvasContext: ctx, viewport }).promise;

        const imageDataUrl = canvas.toDataURL('image/png');
        await ensureTesseract();
        const ocrResult = await Tesseract.recognize(imageDataUrl, 'eng', {
          logger: m => {
            if (m.status === 'recognizing text') {
              const pagePct = 30 + ((i - 1) / numPages * 70) + (m.progress / numPages * 70);
              this.onProgress(Math.round(Math.min(pagePct, 99)));
            }
          }
        });
        this.onLog(`Page ${i}: OCR extracted ${ocrResult.data.text.length} chars`);
        allText += ocrResult.data.text + '\n';

        canvas.width = 0;
        canvas.height = 0;
      }
    }

    this.onLog(`Total extracted: ${allText.length} characters from ${numPages} page(s)`);
    this.onProgress(100);

    if (allText.trim().length < 10) {
      this.onLog('⚠ Very little text extracted — the PDF may be encrypted or image-quality too low');
      return null;
    }

    return this.classifyAndExtract(allText, file.name);
  }

  // Layout-aware text extraction: groups items into rows by Y-coordinate,
  // sorts by X within each row, and inserts tab separators between columns.
  // This preserves the W-2 box layout where labels and values are in separate columns.
  extractWithLayout(items) {
    if (!items || items.length === 0) return '';

    // Extract position from each item's transform matrix: [scaleX, skewY, skewX, scaleY, x, y]
    // Width must be scaled by the transform's scaleX to get page-space width
    const positioned = items
      .filter(item => item.str && item.str.trim().length > 0)
      .map(item => {
        const scaleX = item.transform ? Math.abs(item.transform[0]) : 1;
        const fontSize = scaleX;
        return {
          text: item.str,
          x: item.transform ? item.transform[4] : 0,
          y: item.transform ? item.transform[5] : 0,
          width: (item.width || 0) * scaleX,
          fontSize,
        };
      });

    if (positioned.length === 0) return items.map(i => i.str).join(' ');

    // Compute median font size for dynamic gap threshold
    const fontSizes = positioned.map(p => p.fontSize).filter(f => f > 0).sort((a, b) => a - b);
    const medianFontSize = fontSizes.length > 0 ? fontSizes[Math.floor(fontSizes.length / 2)] : 10;
    // A column gap should be wider than ~3 characters; use 3x font size as threshold
    const tabGapThreshold = medianFontSize * 3;

    // Group items into rows: items within half a font size of same Y are on the same line
    const rowTolerance = Math.max(medianFontSize * 0.5, 3);
    positioned.sort((a, b) => b.y - a.y || a.x - b.x); // top-to-bottom, left-to-right

    const rows = [];
    let currentRow = [positioned[0]];
    let currentY = positioned[0].y;

    for (let i = 1; i < positioned.length; i++) {
      const item = positioned[i];
      if (Math.abs(item.y - currentY) <= rowTolerance) {
        currentRow.push(item);
      } else {
        rows.push(currentRow);
        currentRow = [item];
        currentY = item.y;
      }
    }
    rows.push(currentRow);

    // Build text: sort each row by X, insert tabs for large X gaps (column separators)
    const lines = rows.map(row => {
      row.sort((a, b) => a.x - b.x);
      let line = '';
      for (let i = 0; i < row.length; i++) {
        if (i > 0) {
          const prevEnd = row[i-1].x + row[i-1].width;
          const gap = row[i].x - prevEnd;
          line += gap > tabGapThreshold ? '\t' : (gap > medianFontSize * 0.3 ? ' ' : '');
        }
        line += row[i].text;
      }
      return line;
    });

    let result = lines.join('\n');

    // Reassemble numbers that got split by spaces during extraction:
    // "97, 100.00" → "97,100.00", "12 ,400.00" → "12,400.00", "97 ,100 .00" → "97,100.00"
    result = result.replace(/(\d)\s*,\s*(\d)/g, '$1,$2');
    result = result.replace(/(\d)\s+\.(\d)/g, '$1.$2');
    // Handle cases like "97 100.00" where comma was lost — rejoin digits before decimal amounts
    result = result.replace(/(\d)\s+(\d{3}\.\d{2})\b/g, '$1,$2');

    return result;
  }

  async parseImage(file) {
    this.onLog('Processing image file with OCR...');
    const url = URL.createObjectURL(file);
    try {
      this.onLog('Loading Tesseract OCR engine...');
      await ensureTesseract();
      this.onLog('Initializing Tesseract OCR engine...');
      const result = await Tesseract.recognize(url, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            this.onProgress(Math.round(m.progress * 100));
          }
        }
      });
      const text = result.data.text;
      this.onLog(`OCR complete — ${text.length} characters extracted`);
      return this.classifyAndExtract(text, file.name);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async parseSpreadsheet(file) {
    this.onLog('Spreadsheet detected — loading Excel parser...');
    await ensureSheetJS();
    this.onLog('Parsing spreadsheet...');
    this.onProgress(20);

    const arrayBuffer = await file.arrayBuffer();
    const ext = file.name.toLowerCase().split('.').pop();

    let workbook;
    try {
      workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    } catch (e) {
      this.onLog('⚠ Could not parse spreadsheet: ' + (e.message || e));
      return null;
    }

    this.onLog(`Found ${workbook.SheetNames.length} sheet(s): ${workbook.SheetNames.join(', ')}`);

    // Try each sheet — some workbooks have a summary sheet + detail sheets
    let allDocs = [];
    for (let si = 0; si < workbook.SheetNames.length; si++) {
      const sheetName = workbook.SheetNames[si];
      const sheet = workbook.Sheets[sheetName];
      this.onProgress(20 + Math.round((si / workbook.SheetNames.length) * 60));

      // Convert sheet to text in two ways for best classification:
      // 1) Tab-separated text (preserves layout for classifyAndExtract)
      const textRows = XLSX.utils.sheet_to_csv(sheet, { FS: '\t', RS: '\n', blankrows: false });
      // 2) Also try as flat text with labels
      const jsonRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const flatText = jsonRows.map(row => row.join(' ')).join('\n');

      const combinedText = sheetName + '\n' + textRows + '\n' + flatText;

      this.onLog(`Sheet "${sheetName}": ${jsonRows.length} rows, ${combinedText.length} chars`);

      if (combinedText.trim().length < 20) continue;

      // Try to classify this sheet
      const doc = this.classifyAndExtract(combinedText, file.name);
      if (doc) {
        this.onLog(`Sheet "${sheetName}": Detected ${doc.type}`);
        allDocs.push(doc);
      }
    }

    this.onProgress(90);

    if (allDocs.length === 0) {
      // Fall back: combine all sheets and try once more
      this.onLog('No forms detected per-sheet — trying combined extraction...');
      let allText = '';
      for (const name of workbook.SheetNames) {
        const sheet = workbook.Sheets[name];
        allText += name + '\n' + XLSX.utils.sheet_to_csv(sheet, { FS: '\t', RS: '\n', blankrows: false }) + '\n\n';
      }
      const doc = this.classifyAndExtract(allText, file.name);
      this.onProgress(100);
      if (doc) {
        this.onLog(`Detected: ${doc.type} from combined sheets`);
        return doc;
      }
      this.onLog('⚠ Could not identify any tax forms in this spreadsheet');
      return null;
    }

    this.onProgress(100);

    // If multiple docs found (e.g. a workbook with 1099-INT on one sheet and 1099-DIV on another)
    // Return the first one; the others will need separate handling
    if (allDocs.length > 1) {
      this.onLog(`Found ${allDocs.length} tax forms in this workbook — using first: ${allDocs[0].type}`);
    }
    return allDocs[0];
  }

  classifyAndExtract(text, filename) {
    const upper = text.toUpperCase();
    const fname = filename.toUpperCase();

    // W-2 detection
    if (upper.includes('W-2') || upper.includes('WAGE AND TAX') || fname.includes('W2') || fname.includes('W-2')) {
      return this.parseW2(text);
    }
    // 1099-INT
    if (upper.includes('1099-INT') || upper.includes('INTEREST INCOME') || fname.includes('1099INT') || fname.includes('1099-INT')) {
      return this.parse1099INT(text);
    }
    // 1099-DIV
    if (upper.includes('1099-DIV') || upper.includes('DIVIDENDS AND DISTRIBUTIONS') || fname.includes('1099DIV') || fname.includes('1099-DIV')) {
      return this.parse1099DIV(text);
    }
    // 1099-NEC
    if (upper.includes('1099-NEC') || upper.includes('NONEMPLOYEE COMPENSATION') || fname.includes('1099NEC') || fname.includes('1099-NEC')) {
      return this.parse1099NEC(text);
    }
    // 1099-B
    if (upper.includes('1099-B') || upper.includes('PROCEEDS FROM BROKER') || fname.includes('1099B') || fname.includes('1099-B')) {
      return this.parse1099B(text);
    }
    // 1099-MISC
    if (upper.includes('1099-MISC') || upper.includes('MISCELLANEOUS') || fname.includes('1099MISC')) {
      return this.parse1099MISC(text);
    }
    // 1099-R
    if (upper.includes('1099-R') || upper.includes('DISTRIBUTIONS FROM PENSIONS') || upper.includes('RETIREMENT') || fname.includes('1099R') || fname.includes('1099-R')) {
      return this.parse1099R(text);
    }
    // SSA-1099
    if (upper.includes('SSA-1099') || upper.includes('SOCIAL SECURITY BENEFIT') || fname.includes('SSA') || fname.includes('1099SSA')) {
      return this.parseSSA1099(text);
    }
    // 1099-SA
    if (upper.includes('1099-SA') || (upper.includes('HSA') && upper.includes('DISTRIBUTION')) || fname.includes('1099SA') || fname.includes('1099-SA')) {
      return this.parse1099SA(text);
    }
    // 1099-G (Government Payments — unemployment, state tax refund)
    if (upper.includes('1099-G') || upper.includes('GOVERNMENT PAYMENTS') || upper.includes('UNEMPLOYMENT COMPENSATION') || fname.includes('1099G') || fname.includes('1099-G')) {
      return this.parse1099G(text);
    }
    // 1098 Mortgage
    if (upper.includes('1098') || upper.includes('MORTGAGE INTEREST') || fname.includes('1098')) {
      return this.parse1098(text);
    }

    this.onLog('⚠ Could not classify document type — attempting best-effort extraction');
    return this.parseBestEffort(text);
  }

  // Money extraction helpers
  findMoney(text, patterns) {
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        const val = parseFloat(m[1].replace(/[,$\s]/g, ''));
        if (!isNaN(val) && val > 0) return val;
      }
    }
    return 0;
  }

  findAllMoney(text) {
    const amounts = [];
    // Require .XX decimal to distinguish dollar amounts from zip codes, EINs, SSNs
    const re = /\$\s?(\d{1,3}(?:,?\d{3})*\.\d{2})\b|(?<!\d[-\d])\b(\d{1,3}(?:,?\d{3})*\.\d{2})\b/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const raw = m[1] || m[2];
      const val = parseFloat(raw.replace(/,/g, ''));
      if (!isNaN(val) && val > 0) amounts.push(val);
    }
    return amounts;
  }

  findEmployer(text) {
    // Try to find employer name — usually near top, or after "Employer"
    const m = text.match(/employer['s]*\s*name[:\s]*([A-Z][A-Za-z\s&.,]+)/i);
    if (m) return m[1].trim().substring(0, 40);
    // Try EIN pattern — name is usually nearby
    const ein = text.match(/(\d{2}-\d{7})/);
    return ein ? 'Employer (EIN: ' + ein[1] + ')' : 'Employer';
  }

  findPayer(text) {
    const m = text.match(/payer['s]*\s*name[:\s]*([A-Z][A-Za-z\s&.,]+)/i);
    if (m) return m[1].trim().substring(0, 40);
    return 'Financial Institution';
  }

  parseW2(text) {
    this.onLog('Detected: Form W-2 (Wage and Tax Statement)');

    // Normalize: collapse runs of spaces (but preserve tabs and newlines from layout extraction)
    const norm = text.replace(/\r\n/g, '\n').replace(/ {2,}/g, ' ');
    const employer = this.findEmployer(norm);

    // Extract state code from Box 15 (2-letter state abbreviation)
    const stateCodeMatch = norm.match(/(?:box\s*15|state\s*(?:\/\s*)?(?:employer|payer)?\s*(?:state\s*)?(?:ID|code|no)?)[\s:]*([A-Z]{2})\b/i)
      || norm.match(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\s*\d{2,}/);
    const w2StateCode = stateCodeMatch ? stateCodeMatch[1].toUpperCase() : undefined;

    // Log first ~500 chars of extracted text for diagnostics
    this.onLog('--- Extracted text preview ---');
    const preview = norm.substring(0, 500).replace(/\t/g, ' → ');
    this.onLog(preview);
    this.onLog('--- End preview ---');

    // Strategy 1: Tab-separated layout (from layout-aware PDF extraction)
    const tabResult = this.parseW2TabLayout(norm);
    if (tabResult.wages > 0) {
      this.onLog(`  [Strategy: tab-layout] Wages: $${tabResult.wages.toLocaleString()}, Fed withheld: $${tabResult.fedWithheld.toLocaleString()}, State withheld: $${tabResult.stateWithheld.toLocaleString()}`);
      return { type: 'w2', employer, stateCode: w2StateCode, ...tabResult };
    }

    // Strategy 2: Line-by-line label matching (value on same line or next line after label)
    const lineResult = this.parseW2Lines(norm);
    if (lineResult.wages > 0) {
      this.onLog(`  [Strategy: line-match] Wages: $${lineResult.wages.toLocaleString()}, Fed withheld: $${lineResult.fedWithheld.toLocaleString()}, State withheld: $${lineResult.stateWithheld.toLocaleString()}`);
      return { type: 'w2', employer, stateCode: w2StateCode, ...lineResult };
    }

    // Strategy 3: Broad regex patterns across the full text
    const regexResult = this.parseW2Regex(norm);
    if (regexResult.wages > 0) {
      this.onLog(`  [Strategy: regex] Wages: $${regexResult.wages.toLocaleString()}, Fed withheld: $${regexResult.fedWithheld.toLocaleString()}, State withheld: $${regexResult.stateWithheld.toLocaleString()}`);
      return { type: 'w2', employer, stateCode: w2StateCode, ...regexResult };
    }

    // Strategy 4: Smart fallback using W-2 structure knowledge
    // On a W-2, Box 5 (Medicare wages) >= Box 1 (Wages) >= Box 2 (Fed withheld).
    // Box 1 is wages AFTER pre-tax deductions (401k, health insurance).
    // Box 5 is wages BEFORE those deductions. So Box 1 <= Box 5.
    // Fed withheld is typically 10-40% of wages.
    // We look for the most-repeated amounts (since W-2 PDFs often have multiple copies).
    const all = this.findAllMoney(norm);
    if (all.length >= 1) {
      // Count frequency of each amount (multiple W-2 copies = repeated values)
      const freq = {};
      all.forEach(v => { const k = v.toFixed(2); freq[k] = (freq[k] || 0) + 1; });
      // Get unique amounts sorted by frequency (most repeated first), then by value
      const unique = [...new Set(all.map(v => v.toFixed(2)))].map(Number);
      unique.sort((a, b) => (freq[b.toFixed(2)] || 0) - (freq[a.toFixed(2)] || 0) || b - a);
      this.onLog(`  [Strategy: fallback] Top amounts by frequency: ${unique.slice(0, 8).map(v => `$${v.toLocaleString()}(x${freq[v.toFixed(2)]})`).join(', ')}`);

      // Find likely wages: the second-largest unique amount (largest is usually Medicare wages Box 5)
      const descByValue = [...unique].sort((a, b) => b - a);
      let wages = 0, fedWithheld = 0, stateWithheld = 0;

      if (descByValue.length >= 2 && descByValue[0] > descByValue[1]) {
        // Largest is likely Medicare wages (Box 5), second largest is likely wages (Box 1)
        wages = descByValue[1];
        // Fed withheld should be < wages and typically 10-40% of wages
        const candidates = descByValue.filter(v => v < wages && v > wages * 0.05);
        if (candidates.length >= 1) fedWithheld = candidates[0]; // largest that's less than wages
        // State withheld is usually smaller than fed withheld
        const stateCandidates = descByValue.filter(v => v < (fedWithheld || wages) && v > 100 && v !== fedWithheld);
        if (stateCandidates.length >= 1) stateWithheld = stateCandidates[0];
      } else {
        // Can't distinguish — use largest
        wages = descByValue[0] || 0;
        fedWithheld = descByValue[1] || 0;
        stateWithheld = descByValue[2] || 0;
      }

      this.onLog(`  [Strategy: fallback] Wages: $${wages.toLocaleString()}, Fed withheld: $${fedWithheld.toLocaleString()}, State withheld: $${stateWithheld.toLocaleString()}`);
      return { type: 'w2', employer, stateCode: w2StateCode, wages, fedWithheld, stateWithheld };
    }

    this.onLog('⚠ Could not extract any W-2 amounts');
    return { type: 'w2', employer, stateCode: w2StateCode, wages: 0, fedWithheld: 0, stateWithheld: 0 };
  }

  // Strategy 1: Parse tab-separated layout where box labels and values are separated by tabs
  parseW2TabLayout(text) {
    const lines = text.split('\n');
    let wages = null, fedWithheld = null, stateWithheld = null;
    const moneyRe = /(?<!\d)\$?\s?(\d{1,3}(?:,?\d{3})*\.\d{2})\b/;

    for (const line of lines) {
      if (!line.includes('\t')) continue;
      const lower = line.toLowerCase();

      // Find all money amounts on this tab-separated line
      const amounts = [];
      const amtRe = /(?<!\d)\$?\s?(\d{1,3}(?:,?\d{3})*\.\d{2})\b/g;
      let amtMatch;
      while ((amtMatch = amtRe.exec(line)) !== null) {
        amounts.push(parseFloat(amtMatch[1].replace(/,/g, '')));
      }
      if (amounts.length === 0) continue;
      // Use the last (rightmost) amount on the line — that's typically the value column
      const amount = amounts[amounts.length - 1];

      if (wages === null && (/\b1\b/.test(lower) && /wage|tip|comp/i.test(lower) || /wages.*tips.*other/i.test(lower))) {
        wages = amount;
      } else if (fedWithheld === null && (/\b2\b/.test(lower) && /federal|fed|tax|withheld/i.test(lower) || /federal.*(?:income\s*)?tax\s*withheld/i.test(lower))) {
        fedWithheld = amount;
      } else if (stateWithheld === null && (/\b17\b/.test(lower) && /state|tax|withheld/i.test(lower) || /state.*(?:income\s*)?tax\s*withheld/i.test(lower))) {
        stateWithheld = amount;
      }
    }
    return { wages: wages || 0, fedWithheld: fedWithheld || 0, stateWithheld: stateWithheld || 0 };
  }

  // Strategy 2: Parse line-by-line, matching labels then looking for money on same or next line
  parseW2Lines(text) {
    const lines = text.split('\n');
    let wages = null, fedWithheld = null, stateWithheld = null;
    const moneyReG = /(?<!\d)\$?\s?(\d{1,3}(?:,?\d{3})*\.\d{2})\b/g;

    // W-2 label patterns, grouped by pair (Box 1+2 share a line, Box 16+17 share a line)
    const wageLabels = [
      /(?:box\s*1\b|(?:^|\s)1\s+wages|wages[,.\s]*tips[,.\s]*other\s*comp)/i,
      /wages\s*[,.]?\s*(?:tips|t.ps|l.ps)/i,
      /\b1\s+w.{0,4}g.{0,4}s?\b/i,
    ];
    const fedLabels = [
      /(?:box\s*2\b|(?:^|\s)2\s+federal|federal\s*(?:income\s*)?tax\s*withheld)/i,
      /fed\w*\s*income\s*(?:tax|lax)/i,
      /\b2\s+f.{0,6}(?:l|t)\s*(?:inc|tax|lax|w.t)/i,
    ];
    const stateLabels = [
      /(?:box\s*17\b|(?:^|\s)17\s+state|state\s*(?:income\s*)?tax\s*withheld)/i,
      /(?:state|slate)\s*income\s*(?:tax|lax)/i,
      /\b17\s+s[tl].{0,4}\s*(?:inc|tax|lax|w.t)/i,
    ];
    // Pattern for "16 State wages" paired with "17 State income tax" on same line
    const stateWagesLabels = [
      /(?:16\s+state\s*wages|state\s*wages[,.\s]*tips)/i,
    ];
    // Pattern for state ID line: "CA 418-9711-7 21971.16 854.00" (last amount is state tax)
    const stateIdLineLabels = [
      /\b[A-Z]{2}\s+\d{2,3}-\d{3,4}-\d/,
    ];

    const matchesAny = (line, patterns) => patterns.some(p => p.test(line));

    // Find all money amounts on a line or the next several lines
    // W-2 PDFs may have many lines of employer info between labels and values
    const findAmountsNearby = (startIdx) => {
      const amounts = [];
      for (let j = startIdx; j < Math.min(startIdx + 10, lines.length); j++) {
        let m;
        const re = new RegExp(moneyReG.source, 'g');
        while ((m = re.exec(lines[j])) !== null) {
          amounts.push(parseFloat(m[1].replace(/,/g, '')));
        }
        if (amounts.length > 0) return amounts;
      }
      return amounts;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const hasWageLabel = wages === null && matchesAny(line, wageLabels);
      const hasFedLabel = fedWithheld === null && matchesAny(line, fedLabels);
      const hasStateLabel = stateWithheld === null && matchesAny(line, stateLabels);
      const hasStateWagesLabel = matchesAny(line, stateWagesLabels);
      const hasStateIdLine = stateWithheld === null && matchesAny(line, stateIdLineLabels);

      if (!hasWageLabel && !hasFedLabel && !hasStateLabel && !hasStateIdLine) continue;

      // Get all dollar amounts on this line and nearby lines
      const amounts = findAmountsNearby(i);
      if (amounts.length === 0) continue;

      // W-2 layout: Box 1 (wages) is LEFT, Box 2 (fed withheld) is RIGHT on same row
      // If BOTH labels appear on the same line, first amount = wages, second = fed withheld
      if (hasWageLabel && hasFedLabel && amounts.length >= 2) {
        if (wages === null) wages = amounts[0];
        if (fedWithheld === null) fedWithheld = amounts[1];
      } else if (hasWageLabel && amounts.length >= 1) {
        if (wages === null) wages = amounts[0];
        // If there's a second amount on the same line, it's likely fed withheld
        if (fedWithheld === null && amounts.length >= 2) fedWithheld = amounts[1];
      } else if (hasFedLabel && amounts.length >= 1) {
        // Fed label alone — but be careful: the first amount might be wages from same line
        // Use the LAST amount if there are multiple (fed withheld is on the right)
        if (fedWithheld === null) fedWithheld = amounts.length >= 2 ? amounts[1] : amounts[0];
      }

      // State tax handling
      if (hasStateLabel && amounts.length >= 1) {
        if (hasStateWagesLabel && amounts.length >= 2) {
          // Both "16 State wages" and "17 State income tax" on same line:
          // first amount = state wages (Box 16), second = state tax (Box 17)
          if (stateWithheld === null) stateWithheld = amounts[1];
        } else {
          // Box 17 alone: state tax is FIRST amount (left column); Box 18 (local) is right
          if (stateWithheld === null) stateWithheld = amounts[0];
        }
      }

      // State ID line pattern: "CA 418-9711-7 21971.16 854.00" — last amount is state tax
      if (hasStateIdLine && amounts.length >= 2) {
        if (stateWithheld === null) stateWithheld = amounts[amounts.length - 1];
      }
    }
    return { wages: wages || 0, fedWithheld: fedWithheld || 0, stateWithheld: stateWithheld || 0 };
  }

  // Strategy 3: Broad regex patterns across the full text
  parseW2Regex(text) {
    const wages = this.findMoney(text, [
      /(?:box\s*1\b)[^A-Za-z\d$]*(?:wages[^$\d]{0,40})?[$\s]*(\d{1,3}(?:,?\d{3})*\.\d{2})/i,
      /wages[,.\s]*tips[,.\s]*other\s*comp\w*[^$\d]{0,30}[$\s]*(\d{1,3}(?:,?\d{3})*\.\d{2})/i,
      /wages[:\s$]+(\d{1,3}(?:,?\d{3})*\.\d{2})/i,
      // OCR-lenient: "Wages," or "Wages " followed within 80 chars by a dollar amount
      /wages\W{1,80}?(\d{1,3}(?:,?\d{3})*\.\d{2})/i,
    ]);
    const fedWithheld = this.findMoney(text, [
      /(?:box\s*2\b)[^A-Za-z\d$]*(?:federal[^$\d]{0,40})?[$\s]*(\d{1,3}(?:,?\d{3})*\.\d{2})/i,
      /federal\s*(?:income\s*)?tax\s*withheld[^$\d]{0,30}[$\s]*(\d{1,3}(?:,?\d{3})*\.\d{2})/i,
      /(?:fed(?:eral)?)\s*(?:with(?:held|holding)|w\/h)[:\s$]*(\d{1,3}(?:,?\d{3})*\.\d{2})/i,
      // OCR-lenient: "Federal" or "Ftdenll" near "income" or "tax"
      /f.{0,6}(?:l|t)\s*(?:income|tax|lax).{0,40}?(\d{1,3}(?:,?\d{3})*\.\d{2})/i,
    ]);
    const stateWithheld = this.findMoney(text, [
      /(?:box\s*17\b)[^A-Za-z\d$]*(?:state[^$\d]{0,40})?[$\s]*(\d{1,3}(?:,?\d{3})*\.\d{2})/i,
      /state\s*(?:income\s*)?tax\s*withheld[^$\d]{0,30}[$\s]*(\d{1,3}(?:,?\d{3})*\.\d{2})/i,
      /(?:state)\s*(?:with(?:held|holding)|w\/h)[:\s$]*(\d{1,3}(?:,?\d{3})*\.\d{2})/i,
      // OCR-lenient
      /state\s*(?:income\s*)?(?:tax|lax).{0,40}?(\d{1,3}(?:,?\d{3})*\.\d{2})/i,
    ]);
    return { wages, fedWithheld, stateWithheld };
  }

  parse1099INT(text) {
    this.onLog('Detected: Form 1099-INT (Interest Income)');
    const amount = this.findMoney(text, [
      /(?:box\s*1|interest\s*income)\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
    ]);
    const payer = this.findPayer(text);
    if (amount === 0) {
      const all = this.findAllMoney(text);
      if (all.length) return { type: '1099int', payer, amount: all[0] };
    }
    this.onLog(`  Interest income: $${amount.toLocaleString()}`);
    return { type: '1099int', payer, amount };
  }

  parse1099DIV(text) {
    this.onLog('Detected: Form 1099-DIV (Dividends)');
    const ordinary = this.findMoney(text, [
      /(?:box\s*1a|total\s*ordinary\s*dividends)\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
      /ordinary\s*dividends\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
    ]);
    const qualified = this.findMoney(text, [
      /(?:box\s*1b|qualified\s*dividends)\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
    ]);
    const payer = this.findPayer(text);
    this.onLog(`  Ordinary: $${ordinary.toLocaleString()}, Qualified: $${qualified.toLocaleString()}`);
    return { type: '1099div', payer, ordinary, qualified: qualified || ordinary };
  }

  parse1099NEC(text) {
    this.onLog('Detected: Form 1099-NEC (Nonemployee Compensation)');
    const amount = this.findMoney(text, [
      /(?:box\s*1|nonemployee\s*compensation)\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
    ]);
    const payer = this.findPayer(text);
    if (amount === 0) {
      const all = this.findAllMoney(text);
      if (all.length) return { type: '1099nec', payer, amount: all[0] };
    }
    this.onLog(`  NEC income: $${amount.toLocaleString()}`);
    return { type: '1099nec', payer, amount };
  }

  parse1099B(text) {
    this.onLog('Detected: Form 1099-B (Brokerage Proceeds)');
    const transactions = [];
    // Try to find individual transaction lines
    const lines = text.split('\n');
    for (const line of lines) {
      const m = line.match(/(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)\s+.*?(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/);
      if (m) {
        const v1 = parseFloat(m[1].replace(/,/g,''));
        const v2 = parseFloat(m[2].replace(/,/g,''));
        if (v1 > 100 && v2 > 100) {
          const proceeds = Math.max(v1, v2);
          const basis = Math.min(v1, v2);
          transactions.push({
            description: 'Security (from 1099-B)',
            dateAcquired: 'Various', dateSold: '2025',
            proceeds, basis, longTerm: true,
          });
        }
      }
    }
    // Fallback: summary amounts
    if (transactions.length === 0) {
      const proceeds = this.findMoney(text, [
        /(?:proceeds|gross\s*proceeds)\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
      ]);
      const basis = this.findMoney(text, [
        /(?:cost.*basis|basis)\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
      ]);
      if (proceeds > 0) {
        transactions.push({
          description: 'Securities (1099-B summary)',
          dateAcquired: 'Various', dateSold: '2025',
          proceeds, basis: basis || proceeds * 0.7,
          longTerm: text.toUpperCase().includes('LONG') || !text.toUpperCase().includes('SHORT'),
        });
      }
    }
    this.onLog(`  Found ${transactions.length} transaction(s)`);
    return { type: '1099b', transactions };
  }

  parse1099MISC(text) {
    this.onLog('Detected: Form 1099-MISC');
    const rents = this.findMoney(text, [/(?:box\s*1|rents)\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i]);
    const other = this.findMoney(text, [/(?:box\s*3|other\s*income)\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i]);
    const payer = this.findPayer(text);
    return { type: '1099misc', payer, rents, otherIncome: other };
  }

  parse1099R(text) {
    this.onLog('Detected: Form 1099-R (Retirement Distribution)');
    const grossDist = this.findMoney(text, [
      /(?:box\s*1|gross\s*distribution)\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
    ]);
    const taxableAmount = this.findMoney(text, [
      /(?:box\s*2a|taxable\s*amount)\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
    ]);
    const fedWithheld = this.findMoney(text, [
      /(?:box\s*4|federal.*(?:tax|withheld|w\/h))\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
    ]);
    const stateWithheld = this.findMoney(text, [
      /(?:box\s*12|state.*(?:tax|withheld|w\/h))\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
    ]);
    const payer = this.findPayer(text);
    this.onLog(`  Gross distribution: $${grossDist.toLocaleString()}, Taxable: $${(taxableAmount || grossDist).toLocaleString()}, Fed WH: $${fedWithheld.toLocaleString()}`);
    return { type: '1099r', payer, grossDistribution: grossDist, taxableAmount: taxableAmount || grossDist, fedWithheld, stateWithheld };
  }

  parse1098(text) {
    this.onLog('Detected: Form 1098 (Mortgage Interest)');
    const interest = this.findMoney(text, [
      /(?:box\s*1|mortgage\s*interest)\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
    ]);
    const propertyTax = this.findMoney(text, [
      /(?:box\s*10|property\s*tax)\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
    ]);
    this.onLog(`  Mortgage interest: $${interest.toLocaleString()}`);
    return { type: '1098', mortgageInterest: interest, propertyTax };
  }

  parseSSA1099(text) {
    this.onLog('Detected: SSA-1099 (Social Security Benefits)');
    // Box 5 is the net benefits
    const netBenefits = this.findMoney(text, [
      /(?:box\s*5|net\s*benefits)\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
      /(?:total.*?benefits.*?paid)\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
    ]);
    // Box 6 is voluntary federal tax withheld
    const fedWithheld = this.findMoney(text, [
      /(?:box\s*6|voluntary.*(?:federal|tax).*withheld)\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
    ]);
    this.onLog(`  Net SS benefits: $${netBenefits.toLocaleString()}, Fed WH: $${fedWithheld.toLocaleString()}`);
    return { type: 'ssa1099', netBenefits, fedWithheld };
  }

  parse1099SA(text) {
    this.onLog('Detected: Form 1099-SA (HSA/FSA/Archer MSA Distribution)');
    const grossDist = this.findMoney(text, [
      /(?:box\s*1|gross\s*distribution)\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
    ]);
    const earnings = this.findMoney(text, [
      /(?:box\s*2|earnings)\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
    ]);
    const distributionCode = text.match(/(?:box\s*3|distribution\s*code)\D*(\d)/i)?.[1] || '1';
    this.onLog(`  Gross distribution: $${grossDist.toLocaleString()}, Code: ${distributionCode}`);
    // Code 1 = normal distribution (not taxable if used for qualified medical expenses)
    // Code 2 = excess contributions
    return { type: '1099sa', grossDistribution: grossDist, earnings, distributionCode };
  }

  parse1099G(text) {
    this.onLog('Detected: Form 1099-G (Government Payments)');
    // Box 1: Unemployment compensation
    const unemployment = this.findMoney(text, [
      /(?:box\s*1|unemployment\s*compensation)\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
    ]);
    // Box 2: State or local income tax refund
    const stateRefund = this.findMoney(text, [
      /(?:box\s*2|state.*refund|state.*tax\s*refund)\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
    ]);
    // Box 4: Federal income tax withheld
    const fedWithheld = this.findMoney(text, [
      /(?:box\s*4|federal.*(?:tax|income).*(?:withheld|withholding))\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
      /(?:federal.*withh?(?:eld|olding))\D*(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)/i,
    ]);
    const payer = text.match(/(?:payer|agency|department|state\s+of)\s*[:.]?\s*(.{5,50})/i)?.[1]?.trim() || 'Government Agency';
    this.onLog(`  Unemployment: $${unemployment.toLocaleString()}, State refund: $${stateRefund.toLocaleString()}, Fed withheld: $${fedWithheld.toLocaleString()}`);
    return { type: '1099g', unemployment, stateRefund, fedWithheld, payer };
  }

  parseBestEffort(text) {
    const amounts = this.findAllMoney(text);
    if (amounts.length === 0) return null;
    amounts.sort((a,b) => b - a);
    this.onLog(`  Found ${amounts.length} dollar amounts, largest: $${amounts[0].toLocaleString()}`);
    // Assume it's income of some kind
    return { type: 'unknown', amounts };
  }
}

// ═══════════════════════════════════════════════════════════════
// AGGREGATE PARSED DOCUMENTS INTO TAX DATA
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// DUPLICATE DETECTION HELPERS
// ═══════════════════════════════════════════════════════════════

// Normalize employer/payer names for comparison (strip whitespace, punctuation, case)
function normalizeName(name) {
  return (name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Check if two dollar amounts are "the same" (within 1% or $1 tolerance)
function amountsMatch(a, b) {
  if (a === 0 && b === 0) return true;
  if (a === 0 || b === 0) return false;
  const diff = Math.abs(a - b);
  return diff <= 1 || diff / Math.max(a, b) < 0.01;
}

// Check if a W-2 is a duplicate of an existing one
function isW2Duplicate(existing, candidate) {
  // Same employer name AND same wages → duplicate
  if (normalizeName(existing.employer) === normalizeName(candidate.employer) && amountsMatch(existing.wages, candidate.wages)) {
    return true;
  }
  // Same wages AND same fed withheld → likely duplicate even if employer name differs slightly
  if (amountsMatch(existing.wages, candidate.wages) && amountsMatch(existing.fedWithheld, candidate.fedWithheld) && existing.wages > 0) {
    return true;
  }
  return false;
}

// Check if a 1099-INT is a duplicate
function is1099IntDuplicate(existing, candidate) {
  return normalizeName(existing.payer) === normalizeName(candidate.payer) && amountsMatch(existing.amount, candidate.amount);
}

// Check if a 1099-DIV is a duplicate
function is1099DivDuplicate(existing, candidate) {
  return normalizeName(existing.payer) === normalizeName(candidate.payer) && amountsMatch(existing.ordinary, candidate.ordinary);
}

// Generic duplicate check for docs with payer + single amount field
function isPayerAmountDuplicate(existing, candidate, amountField) {
  return normalizeName(existing.payer) === normalizeName(candidate.payer) && amountsMatch(existing[amountField] || 0, candidate[amountField] || 0);
}

function aggregateParsedDocs(docs) {
  const data = { w2s: [], interest: [], dividends: [], capitalGains: [], estimatedPayments: 0 };
  let necTotal = 0;
  let necSources = [];
  let mortgageInterest = 0;
  let propertyTax = 0;
  let dupsSkipped = 0;

  for (const doc of docs) {
    if (!doc) continue;
    switch (doc.type) {
      case 'w2': {
        const w2Entry = { employer: doc.employer, wages: doc.wages, fedWithheld: doc.fedWithheld, stateWithheld: doc.stateWithheld, stateCode: doc.stateCode, _sourceURL: doc._sourceURL, _sourceFileName: doc._sourceFileName };
        if (data.w2s.some(existing => isW2Duplicate(existing, w2Entry))) {
          dupsSkipped++;
          rlog('DUPLICATE_SKIPPED', { type: 'w2', employer: doc.employer, wages: doc.wages });
        } else {
          data.w2s.push(w2Entry);
        }
        break;
      }
      case '1099int': {
        const entry = { payer: doc.payer, amount: doc.amount, _sourceURL: doc._sourceURL, _sourceFileName: doc._sourceFileName };
        if (data.interest.some(existing => is1099IntDuplicate(existing, entry))) {
          dupsSkipped++;
          rlog('DUPLICATE_SKIPPED', { type: '1099int', payer: doc.payer, amount: doc.amount });
        } else {
          data.interest.push(entry);
        }
        break;
      }
      case '1099div': {
        const entry = { payer: doc.payer, ordinary: doc.ordinary, qualified: doc.qualified, _sourceURL: doc._sourceURL, _sourceFileName: doc._sourceFileName };
        if (data.dividends.some(existing => is1099DivDuplicate(existing, entry))) {
          dupsSkipped++;
          rlog('DUPLICATE_SKIPPED', { type: '1099div', payer: doc.payer, ordinary: doc.ordinary });
        } else {
          data.dividends.push(entry);
        }
        break;
      }
      case '1099nec': {
        const necKey = normalizeName(doc.payer || doc._sourceFileName) + '_' + (doc.amount || 0).toFixed(0);
        if (!necSources.some(s => normalizeName(s.payer || s._sourceFileName) + '_' + (s.amount || 0).toFixed(0) === necKey)) {
          necTotal += doc.amount;
          necSources.push({ _sourceURL: doc._sourceURL, _sourceFileName: doc._sourceFileName, amount: doc.amount, payer: doc.payer });
        } else {
          dupsSkipped++;
          rlog('DUPLICATE_SKIPPED', { type: '1099nec', amount: doc.amount });
        }
        break;
      }
      case '1099b':
        doc.transactions.forEach(t => { t._sourceURL = doc._sourceURL; t._sourceFileName = doc._sourceFileName; });
        data.capitalGains.push(...doc.transactions);
        break;
      case '1099r': {
        if (!data.retirementDist) data.retirementDist = [];
        const rEntry = { payer: doc.payer, grossDistribution: doc.grossDistribution, taxableAmount: doc.taxableAmount, fedWithheld: doc.fedWithheld || 0, stateWithheld: doc.stateWithheld || 0, _sourceURL: doc._sourceURL, _sourceFileName: doc._sourceFileName };
        if (data.retirementDist.some(existing => isPayerAmountDuplicate(existing, rEntry, 'grossDistribution'))) {
          dupsSkipped++;
          rlog('DUPLICATE_SKIPPED', { type: '1099r', payer: doc.payer, grossDistribution: doc.grossDistribution });
        } else {
          data.retirementDist.push(rEntry);
        }
        break;
      }
      case '1098':
        mortgageInterest += doc.mortgageInterest || 0;
        propertyTax += doc.propertyTax || 0;
        if (doc._sourceURL) data._mortgageSources = (data._mortgageSources || []).concat({ _sourceURL: doc._sourceURL, _sourceFileName: doc._sourceFileName, mortgageInterest: doc.mortgageInterest, propertyTax: doc.propertyTax });
        break;
      case 'ssa1099':
        data.ssaBenefits = (data.ssaBenefits || 0) + (doc.netBenefits || 0);
        data.ssaWithheld = (data.ssaWithheld || 0) + (doc.fedWithheld || 0);
        if (doc._sourceURL) data._ssaSources = (data._ssaSources || []).concat({ _sourceURL: doc._sourceURL, _sourceFileName: doc._sourceFileName, netBenefits: doc.netBenefits });
        break;
      case '1099sa':
        data.hsaDistributions = (data.hsaDistributions || 0) + (doc.grossDistribution || 0);
        data.hsaDistributionCode = doc.distributionCode;
        break;
      case '1099g':
        data.unemploymentIncome = (data.unemploymentIncome || 0) + (doc.unemployment || 0);
        data.stateRefund1099G = (data.stateRefund1099G || 0) + (doc.stateRefund || 0);
        if (doc.fedWithheld) {
          data.estimatedPayments = (data.estimatedPayments || 0) + doc.fedWithheld;
        }
        if (doc._sourceURL) data._govSources = (data._govSources || []).concat({ _sourceURL: doc._sourceURL, _sourceFileName: doc._sourceFileName, unemployment: doc.unemployment, payer: doc.payer });
        break;
    }
  }

  if (dupsSkipped > 0) {
    rlog('DUPLICATES_REMOVED', { count: dupsSkipped });
  }

  if (necSources.length > 0) {
    data._necSources = necSources;
  }

  // Auto-detect state from W-2s
  const w2WithState = data.w2s.find(w => w.stateCode);
  if (w2WithState) {
    data.stateCode = w2WithState.stateCode;
  }

  // If NEC income found, create a Schedule C
  if (necTotal > 0) {
    data.scheduleC = {
      businessName: 'Self-Employment (from 1099-NEC)',
      grossReceipts: necTotal, cogs: 0,
      advertising: 0, carExpense: 0, insurance: 0,
      legalProfessional: 0, officeExpense: 0, rent: 0,
      supplies: 0, travel: 0, meals: 0, utilities: 0, otherExpenses: 0,
    };
  }

  // If mortgage/property tax found, set up itemized
  if (mortgageInterest > 0 || propertyTax > 0) {
    data.itemized = { medical: 0, stateTaxes: 0, propertyTaxes: propertyTax, mortgageInterest, charitableCash: 0, charitableNonCash: 0 };
  }

  // Infer filing status: only assume MFJ if W-2s have DIFFERENT employers
  // (same employer or duplicate uploads should not trigger MFJ)
  if (data.w2s.length >= 2) {
    const uniqueEmployers = new Set(data.w2s.map(w => normalizeName(w.employer)));
    if (uniqueEmployers.size >= 2) {
      // Two genuinely different W-2s — could be MFJ or single with two jobs
      // Default to single; user can change in the assumptions tab
      data.filingStatus = 'single';
    } else {
      data.filingStatus = 'single';
    }
  } else {
    data.filingStatus = 'single';
  }

  return data;
}

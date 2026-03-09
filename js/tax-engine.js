// ReviewMyTaxes — Tax Engine (shared across all pages)

const TAX = {
  year: 2025,
  brackets: {
    single: [[11925,.10],[48475,.12],[103425,.22],[196050,.24],[249325,.32],[626350,.35],[Infinity,.37]],
    mfj: [[23850,.10],[96950,.12],[206850,.22],[392100,.24],[498650,.32],[751600,.35],[Infinity,.37]],
    mfs: [[11925,.10],[48475,.12],[103425,.22],[196050,.24],[249325,.32],[375800,.35],[Infinity,.37]],
    hoh: [[15950,.10],[60975,.12],[122925,.22],[196050,.24],[236100,.32],[626350,.35],[Infinity,.37]]
  },
  standardDeduction: { single:15750, mfj:31500, mfs:15750, hoh:23625 },
  ltcgBrackets: {
    single: [[48350,0],[533400,.15],[Infinity,.20]],
    mfj: [[96700,0],[600050,.15],[Infinity,.20]],
    mfs: [[48350,0],[300025,.15],[Infinity,.20]],
    hoh: [[64850,0],[566700,.15],[Infinity,.20]]
  },
  ssWageBase: 176100, ssRate: .124, medicareRate: .029,
  additionalMedicareRate: .009,
  additionalMedicareThreshold: { single:200000, mfj:250000, mfs:125000, hoh:200000 },
  niitRate: .038,
  niitThreshold: { single:200000, mfj:250000, mfs:125000, hoh:200000 },
  saltCap: { single:40000, mfj:40000, mfs:20000, hoh:40000 },
  capitalLossLimit: 3000,
  schedBThreshold: 1500,
  medicalExpenseFloor: .075,
  qbiRate: .20,
  qbiThreshold: { single:197300, mfj:394600, mfs:197300, hoh:197300 },
};

const FS_LABELS = { single:"Single", mfj:"Married Filing Jointly", mfs:"Married Filing Separately", hoh:"Head of Household" };

// ═══════════════════════════════════════════════════════════════
// 2025 STATE INCOME TAX DATA (all 50 states + DC)
// ═══════════════════════════════════════════════════════════════
// Format: { name, type: 'none'|'flat'|'progressive', rate (flat), brackets: { single, mfj } (progressive)
//   stdDed: { single, mfj }, personalExemption: { single, mfj } }
// Brackets: [[upperLimit, rate], ...] — same format as federal
// Most states use federal AGI as starting point
const STATE_TAX = {
  '': { name: '— Select your state —', type: 'none' },
  AL: { name:'Alabama', type:'progressive',
    brackets:{ single:[[500,.02],[3000,.04],[Infinity,.05]], mfj:[[1000,.02],[6000,.04],[Infinity,.05]] },
    stdDed:{ single:2500, mfj:7500, mfs:2500, hoh:4700 }, exemption:{ single:1500, mfj:3000, mfs:1500, hoh:1500 } },
  AK: { name:'Alaska', type:'none' },
  AZ: { name:'Arizona', type:'flat', rate:.025, stdDed:{ single:14600, mfj:29200, mfs:14600, hoh:21900 } },
  AR: { name:'Arkansas', type:'progressive',
    brackets:{ single:[[5100,.02],[10300,.04],[Infinity,.044]], mfj:[[5100,.02],[10300,.04],[Infinity,.044]] },
    stdDed:{ single:2340, mfj:4680, mfs:2340, hoh:2340 } },
  CA: { name:'California', type:'progressive',
    brackets:{ single:[[10756,.01],[25499,.02],[40242,.04],[55866,.06],[70606,.08],[360659,.093],[432787,.103],[721314,.113],[Infinity,.123]],
      mfj:[[21512,.01],[50998,.02],[80484,.04],[111732,.06],[141212,.08],[721318,.093],[865574,.103],[1442628,.113],[Infinity,.123]] },
    stdDed:{ single:5540, mfj:11080, mfs:5540, hoh:11080 }, exemption:{ single:144, mfj:288, mfs:144, hoh:144 } },
  CO: { name:'Colorado', type:'flat', rate:.044, stdDed:{ single:15750, mfj:31500, mfs:15750, hoh:23625 } },
  CT: { name:'Connecticut', type:'progressive',
    brackets:{ single:[[10000,.02],[50000,.045],[100000,.055],[200000,.06],[250000,.065],[500000,.069],[Infinity,.0699]],
      mfj:[[20000,.02],[100000,.045],[200000,.055],[400000,.06],[500000,.065],[1000000,.069],[Infinity,.0699]] },
    stdDed:{ single:0, mfj:0, mfs:0, hoh:0 }, exemption:{ single:15000, mfj:24000, mfs:15000, hoh:19000 } },
  DE: { name:'Delaware', type:'progressive',
    brackets:{ single:[[2000,0],[5000,.022],[10000,.039],[20000,.048],[25000,.052],[60000,.055],[Infinity,.066]],
      mfj:[[2000,0],[5000,.022],[10000,.039],[20000,.048],[25000,.052],[60000,.055],[Infinity,.066]] },
    stdDed:{ single:3250, mfj:6500, mfs:3250, hoh:3250 }, exemption:{ single:110, mfj:220, mfs:110, hoh:110 } },
  FL: { name:'Florida', type:'none' },
  GA: { name:'Georgia', type:'flat', rate:.0549, stdDed:{ single:12000, mfj:24000, mfs:12000, hoh:18000 } },
  HI: { name:'Hawaii', type:'progressive',
    brackets:{ single:[[2400,.014],[4800,.032],[9600,.055],[14400,.064],[19200,.068],[24000,.072],[36000,.076],[48000,.079],[150000,.0825],[175000,.09],[200000,.10],[Infinity,.11]],
      mfj:[[4800,.014],[9600,.032],[19200,.055],[28800,.064],[38400,.068],[48000,.072],[72000,.076],[96000,.079],[300000,.0825],[350000,.09],[400000,.10],[Infinity,.11]] },
    stdDed:{ single:2200, mfj:4400, mfs:2200, hoh:3212 } },
  ID: { name:'Idaho', type:'flat', rate:.058, stdDed:{ single:14600, mfj:29200, mfs:14600, hoh:21900 } },
  IL: { name:'Illinois', type:'flat', rate:.0495, stdDed:{ single:0, mfj:0, mfs:0, hoh:0 }, exemption:{ single:2625, mfj:5250, mfs:2625, hoh:2625 } },
  IN: { name:'Indiana', type:'flat', rate:.0305, stdDed:{ single:0, mfj:0, mfs:0, hoh:0 }, exemption:{ single:1000, mfj:2000, mfs:1000, hoh:1000 } },
  IA: { name:'Iowa', type:'flat', rate:.038, stdDed:{ single:14600, mfj:29200, mfs:14600, hoh:21900 } },
  KS: { name:'Kansas', type:'progressive',
    brackets:{ single:[[15000,.031],[30000,.0525],[Infinity,.057]], mfj:[[30000,.031],[60000,.0525],[Infinity,.057]] },
    stdDed:{ single:3500, mfj:8000, mfs:3500, hoh:6000 } },
  KY: { name:'Kentucky', type:'flat', rate:.04, stdDed:{ single:3160, mfj:6320, mfs:3160, hoh:3160 } },
  LA: { name:'Louisiana', type:'progressive',
    brackets:{ single:[[12500,.0185],[50000,.035],[Infinity,.0425]], mfj:[[25000,.0185],[100000,.035],[Infinity,.0425]] },
    stdDed:{ single:0, mfj:0, mfs:0, hoh:0 }, exemption:{ single:4500, mfj:9000, mfs:4500, hoh:4500 } },
  ME: { name:'Maine', type:'progressive',
    brackets:{ single:[[26050,.058],[61600,.0675],[Infinity,.0715]], mfj:[[52100,.058],[123200,.0675],[Infinity,.0715]] },
    stdDed:{ single:14600, mfj:29200, mfs:14600, hoh:21900 } },
  MD: { name:'Maryland', type:'progressive',
    brackets:{ single:[[1000,.02],[2000,.03],[3000,.04],[100000,.0475],[125000,.05],[150000,.0525],[250000,.055],[Infinity,.0575]],
      mfj:[[1000,.02],[2000,.03],[3000,.04],[150000,.0475],[175000,.05],[225000,.0525],[300000,.055],[Infinity,.0575]] },
    stdDed:{ single:2550, mfj:5150, mfs:2550, hoh:2550 }, exemption:{ single:3200, mfj:6400, mfs:3200, hoh:3200 } },
  MA: { name:'Massachusetts', type:'flat', rate:.05, stdDed:{ single:0, mfj:0, mfs:0, hoh:0 }, exemption:{ single:4400, mfj:8800, mfs:4400, hoh:4400 },
    note:'9% surtax on income over $1M' },
  MI: { name:'Michigan', type:'flat', rate:.0425, stdDed:{ single:0, mfj:0, mfs:0, hoh:0 }, exemption:{ single:5600, mfj:11200, mfs:5600, hoh:5600 } },
  MN: { name:'Minnesota', type:'progressive',
    brackets:{ single:[[31690,.0535],[104090,.068],[183340,.0785],[Infinity,.0985]],
      mfj:[[46330,.0535],[184040,.068],[321450,.0785],[Infinity,.0985]] },
    stdDed:{ single:14575, mfj:29150, mfs:14575, hoh:21400 } },
  MS: { name:'Mississippi', type:'flat', rate:.047, stdDed:{ single:2300, mfj:4600, mfs:2300, hoh:3400 }, exemption:{ single:6000, mfj:12000, mfs:6000, hoh:8000 } },
  MO: { name:'Missouri', type:'progressive',
    brackets:{ single:[[1207,.02],[2414,.025],[3621,.03],[4828,.035],[6035,.04],[7242,.045],[8449,.05],[Infinity,.048]],
      mfj:[[1207,.02],[2414,.025],[3621,.03],[4828,.035],[6035,.04],[7242,.045],[8449,.05],[Infinity,.048]] },
    stdDed:{ single:14600, mfj:29200, mfs:14600, hoh:21900 } },
  MT: { name:'Montana', type:'progressive',
    brackets:{ single:[[20500,.047],[Infinity,.059]], mfj:[[20500,.047],[Infinity,.059]] },
    stdDed:{ single:14600, mfj:29200, mfs:14600, hoh:21900 } },
  NE: { name:'Nebraska', type:'progressive',
    brackets:{ single:[[3700,.0246],[22170,.0351],[35730,.0501],[Infinity,.0584]],
      mfj:[[7390,.0246],[44350,.0351],[71500,.0501],[Infinity,.0584]] },
    stdDed:{ single:8250, mfj:16500, mfs:8250, hoh:12150 } },
  NV: { name:'Nevada', type:'none' },
  NH: { name:'New Hampshire', type:'none' },
  NJ: { name:'New Jersey', type:'progressive',
    brackets:{ single:[[20000,.014],[35000,.0175],[40000,.035],[75000,.05525],[500000,.0637],[1000000,.0897],[Infinity,.1075]],
      mfj:[[20000,.014],[50000,.0175],[70000,.0245],[80000,.035],[150000,.05525],[500000,.0637],[1000000,.0897],[Infinity,.1075]] },
    stdDed:{ single:0, mfj:0, mfs:0, hoh:0 }, exemption:{ single:1000, mfj:2000, mfs:1000, hoh:1000 } },
  NM: { name:'New Mexico', type:'progressive',
    brackets:{ single:[[5500,.017],[11000,.032],[16000,.047],[210000,.049],[315000,.052],[Infinity,.059]],
      mfj:[[8000,.017],[16000,.032],[24000,.047],[315000,.049],[420000,.052],[Infinity,.059]] },
    stdDed:{ single:14600, mfj:29200, mfs:14600, hoh:21900 } },
  NY: { name:'New York', type:'progressive',
    brackets:{ single:[[8500,.04],[11700,.045],[13900,.0525],[80650,.055],[215400,.06],[1077550,.0685],[5000000,.0965],[25000000,.103],[Infinity,.109]],
      mfj:[[17150,.04],[23600,.045],[27900,.0525],[161550,.055],[323200,.06],[2155350,.0685],[5000000,.0965],[25000000,.103],[Infinity,.109]] },
    stdDed:{ single:8000, mfj:16050, mfs:8000, hoh:11200 } },
  NC: { name:'North Carolina', type:'flat', rate:.045, stdDed:{ single:12750, mfj:25500, mfs:12750, hoh:19125 } },
  ND: { name:'North Dakota', type:'flat', rate:.0195, stdDed:{ single:14600, mfj:29200, mfs:14600, hoh:21900 },
    note:'Most residents owe $0 — ND eliminated tax for income under $44,725 single / $74,750 MFJ' },
  OH: { name:'Ohio', type:'progressive',
    brackets:{ single:[[26050,0],[46100,.02765],[100000,.03226],[Infinity,.0357]],
      mfj:[[26050,0],[46100,.02765],[100000,.03226],[Infinity,.0357]] },
    stdDed:{ single:0, mfj:0, mfs:0, hoh:0 }, exemption:{ single:2400, mfj:4800, mfs:2400, hoh:2400 } },
  OK: { name:'Oklahoma', type:'progressive',
    brackets:{ single:[[1000,.0025],[2500,.0075],[3750,.0175],[4900,.0275],[7200,.0375],[Infinity,.0475]],
      mfj:[[2000,.0025],[5000,.0075],[7500,.0175],[9800,.0275],[12200,.0375],[Infinity,.0475]] },
    stdDed:{ single:6350, mfj:12700, mfs:6350, hoh:9350 } },
  OR: { name:'Oregon', type:'progressive',
    brackets:{ single:[[4300,.0475],[10750,.0675],[125000,.0875],[Infinity,.099]],
      mfj:[[8600,.0475],[21500,.0675],[250000,.0875],[Infinity,.099]] },
    stdDed:{ single:2745, mfj:5495, mfs:2745, hoh:4430 } },
  PA: { name:'Pennsylvania', type:'flat', rate:.0307, stdDed:{ single:0, mfj:0, mfs:0, hoh:0 } },
  RI: { name:'Rhode Island', type:'progressive',
    brackets:{ single:[[73450,.0375],[166950,.0475],[Infinity,.0599]],
      mfj:[[73450,.0375],[166950,.0475],[Infinity,.0599]] },
    stdDed:{ single:10550, mfj:21150, mfs:10550, hoh:15800 } },
  SC: { name:'South Carolina', type:'progressive',
    brackets:{ single:[[3460,.03],[17330,.05],[Infinity,.064]],
      mfj:[[3460,.03],[17330,.05],[Infinity,.064]] },
    stdDed:{ single:14600, mfj:29200, mfs:14600, hoh:21900 } },
  SD: { name:'South Dakota', type:'none' },
  TN: { name:'Tennessee', type:'none' },
  TX: { name:'Texas', type:'none' },
  UT: { name:'Utah', type:'flat', rate:.0465, stdDed:{ single:0, mfj:0, mfs:0, hoh:0 },
    note:'Utah offers a taxpayer credit that effectively creates a standard deduction' },
  VT: { name:'Vermont', type:'progressive',
    brackets:{ single:[[45400,.0335],[110450,.066],[229550,.076],[Infinity,.0875]],
      mfj:[[76050,.0335],[184200,.066],[229550,.076],[Infinity,.0875]] },
    stdDed:{ single:14600, mfj:29200, mfs:14600, hoh:21900 } },
  VA: { name:'Virginia', type:'progressive',
    brackets:{ single:[[3000,.02],[5000,.03],[17000,.05],[Infinity,.0575]],
      mfj:[[3000,.02],[5000,.03],[17000,.05],[Infinity,.0575]] },
    stdDed:{ single:4700, mfj:9400, mfs:4700, hoh:4700 }, exemption:{ single:930, mfj:1860, mfs:930, hoh:930 } },
  WA: { name:'Washington', type:'none', note:'7% tax on long-term capital gains over $270,000' },
  WV: { name:'West Virginia', type:'progressive',
    brackets:{ single:[[10000,.0236],[25000,.0315],[40000,.0354],[60000,.0472],[Infinity,.0512]],
      mfj:[[10000,.0236],[25000,.0315],[40000,.0354],[60000,.0472],[Infinity,.0512]] },
    stdDed:{ single:0, mfj:0, mfs:0, hoh:0 }, exemption:{ single:2000, mfj:4000, mfs:2000, hoh:2000 } },
  WI: { name:'Wisconsin', type:'progressive',
    brackets:{ single:[[14320,.0354],[28640,.0465],[315310,.0530],[Infinity,.0765]],
      mfj:[[19110,.0354],[38220,.0465],[420420,.0530],[Infinity,.0765]] },
    stdDed:{ single:13230, mfj:24470, mfs:12280, hoh:16680 } },
  WY: { name:'Wyoming', type:'none' },
  DC: { name:'District of Columbia', type:'progressive',
    brackets:{ single:[[10000,.04],[40000,.06],[60000,.065],[250000,.085],[500000,.0925],[1000000,.0975],[Infinity,.1075]],
      mfj:[[10000,.04],[40000,.06],[60000,.065],[250000,.085],[500000,.0925],[1000000,.0975],[Infinity,.1075]] },
    stdDed:{ single:14600, mfj:29200, mfs:14600, hoh:21900 } },
};

function computeStateTax(stateCode, federalResult, taxData) {
  const st = STATE_TAX[stateCode];
  if (!st || st.type === 'none') {
    return { stateCode, stateName: st?.name || 'Unknown', tax: 0, type: 'none', effectiveRate: 0,
      taxableIncome: 0, deduction: 0, exemption: 0, withheld: federalResult.totalStateWithheld || 0,
      refundOrOwed: federalResult.totalStateWithheld || 0, note: st?.note || '' };
  }

  const fs = federalResult.filingStatus;
  const fsKey = (fs === 'hoh') ? 'single' : fs; // Most states treat HOH same as single for brackets

  // Start from federal AGI
  let stateAGI = federalResult.agi;

  // State standard deduction
  const stdDed = (st.stdDed && st.stdDed[fs]) || (st.stdDed && st.stdDed.single) || 0;
  const exemption = (st.exemption && st.exemption[fs]) || (st.exemption && st.exemption.single) || 0;
  const deduction = stdDed + exemption;
  const taxableIncome = Math.max(0, stateAGI - deduction);

  let tax = 0;
  if (st.type === 'flat') {
    tax = Math.round(taxableIncome * st.rate);
  } else if (st.type === 'progressive') {
    const brackets = (st.brackets[fsKey]) || st.brackets.single;
    tax = Math.round(calcBracketTax(taxableIncome, brackets));
  }

  const withheld = federalResult.totalStateWithheld || 0;
  const effectiveRate = stateAGI > 0 ? (tax / stateAGI * 100) : 0;
  const refundOrOwed = withheld - tax;

  return { stateCode, stateName: st.name, tax, type: st.type, rate: st.rate,
    taxableIncome, stateAGI, deduction, stdDed, exemption, effectiveRate,
    withheld, refundOrOwed, note: st.note || '' };
}

function calcBracketTax(income, brackets) {
  let tax = 0, prev = 0;
  for (const [limit, rate] of brackets) {
    const chunk = Math.min(income, limit) - prev;
    if (chunk <= 0) break;
    tax += chunk * rate;
    prev = limit;
  }
  return Math.round(tax);
}

function calcLTCGTax(ltcg, ordIncome, brackets) {
  if (ltcg <= 0) return 0;
  let tax = 0, filled = ordIncome, remaining = ltcg;
  for (const [limit, rate] of brackets) {
    const room = Math.max(0, limit - filled);
    const chunk = Math.min(remaining, room);
    if (chunk > 0) { tax += chunk * rate; remaining -= chunk; }
    filled = Math.max(filled, limit);
    if (remaining <= 0) break;
  }
  return Math.round(tax);
}

function computeTaxReturn(data) {
  const fs = data.filingStatus || 'single';
  const assumptions = [];
  const schedules = {};

  // Wages
  const totalWages = (data.w2s||[]).reduce((s,w) => s + (w.wages||0), 0);
  let totalFedWithheld = (data.w2s||[]).reduce((s,w) => s + (w.fedWithheld||0), 0);
  let totalStateWithheld = (data.w2s||[]).reduce((s,w) => s + (w.stateWithheld||0), 0);

  // Interest & Dividends
  const totalInterest = (data.interest||[]).reduce((s,i) => s + (i.amount||0), 0);
  const totalOrdDiv = (data.dividends||[]).reduce((s,d) => s + (d.ordinary||0), 0);
  const totalQualDiv = (data.dividends||[]).reduce((s,d) => s + (d.qualified||0), 0);

  if (totalInterest >= TAX.schedBThreshold || totalOrdDiv >= TAX.schedBThreshold) {
    schedules.B = { interestItems: data.interest||[], totalInterest, dividendItems: data.dividends||[], totalOrdDiv, totalQualDiv };
  }

  // Schedule C
  let schedCNet = 0, seTax = 0, seDeduction = 0;
  if (data.scheduleC) {
    const c = data.scheduleC;
    const gross = (c.grossReceipts||0) - (c.cogs||0);
    const exp = (c.advertising||0) + (c.carExpense||0) + (c.insurance||0) + (c.legalProfessional||0) +
      (c.officeExpense||0) + (c.rent||0) + (c.supplies||0) + (c.travel||0) + (c.meals||0)*0.5 +
      (c.utilities||0) + (c.otherExpenses||0);
    schedCNet = gross - exp;
    assumptions.push({ id:'sched_c_method', text:'Used cash method of accounting for Schedule C', impact:'medium' });
    if (data.scheduleC.grossReceipts > 0 && exp === 0) {
      assumptions.push({ id:'sched_c_expenses', text:'No business expenses detected — you may have deductible expenses that would reduce your tax', impact:'high' });
    }
    schedules.C = { businessName: c.businessName||'Self-Employment', grossReceipts: c.grossReceipts||0, cogs: c.cogs||0, grossIncome: gross, totalExpenses: exp, netProfit: schedCNet };

    if (schedCNet >= 400) {
      const seEarnings = schedCNet * 0.9235;
      // Coordinate SS wage base with W-2 wages: only remaining base is subject to SS tax
      const ssWageBaseRemaining = Math.max(0, TAX.ssWageBase - totalWages);
      const ssSE = Math.min(seEarnings, ssWageBaseRemaining) * TAX.ssRate;
      const medSE = seEarnings * TAX.medicareRate;
      // Additional Medicare: SE earnings above the threshold minus W-2 wages already counted
      const addlMedThresholdRemaining = Math.max(0, TAX.additionalMedicareThreshold[fs] - totalWages);
      const addlMed = Math.max(0, seEarnings - addlMedThresholdRemaining) * TAX.additionalMedicareRate;
      seTax = Math.round(ssSE + medSE + addlMed);
      seDeduction = Math.round(seTax / 2);
      schedules.SE = { netEarnings: Math.round(seEarnings), ssTax: Math.round(ssSE), medicareTax: Math.round(medSE), additionalMedicare: Math.round(addlMed), totalSETax: seTax, deduction: seDeduction };
    }
  }

  // Capital Gains
  let netSTCG = 0, netLTCG = 0, capitalLossCarryover = 0;
  if (data.capitalGains && data.capitalGains.length > 0) {
    const st = data.capitalGains.filter(t => !t.longTerm);
    const lt = data.capitalGains.filter(t => t.longTerm);
    netSTCG = st.reduce((s,t) => s + ((t.proceeds||0) - (t.basis||0)), 0);
    netLTCG = lt.reduce((s,t) => s + ((t.proceeds||0) - (t.basis||0)), 0);
    const totalNet = netSTCG + netLTCG;
    if (totalNet < 0) {
      const usable = Math.min(Math.abs(totalNet), TAX.capitalLossLimit);
      capitalLossCarryover = Math.abs(totalNet) - usable;
      if (netSTCG < 0 && netLTCG < 0) { netSTCG = -usable; netLTCG = 0; }
      else if (netSTCG < 0) { netSTCG = Math.max(netSTCG, -usable); netLTCG = 0; }
      else { netLTCG = -usable; netSTCG = 0; }
    }
    schedules.D = { shortTermGains: st, longTermGains: lt, netSTCG, netLTCG, totalNetGain: netSTCG + netLTCG, capitalLossCarryover };
    schedules.form8949 = data.capitalGains;
    assumptions.push({ id:'cost_basis', text:'Used cost basis as reported on 1099-B; did not adjust for wash sales', impact:'high' });
  }

  // Home sale exclusion (Section 121)
  let homeSaleGain = 0, homeSaleExclusion = 0, homeSaleTaxable = 0;
  if (data.homeSale) {
    const gain = (data.homeSale.salePrice || 0) - (data.homeSale.basis || 0);
    homeSaleGain = Math.max(0, gain);
    const maxExclusion = fs === 'mfj' ? 500000 : 250000;
    homeSaleExclusion = Math.min(homeSaleGain, maxExclusion);
    homeSaleTaxable = homeSaleGain - homeSaleExclusion;
    if (homeSaleTaxable > 0) {
      // Add taxable portion to LTCG
      netLTCG += homeSaleTaxable;
      assumptions.push({ id:'home_sale', text:'Home sale gain of $' + homeSaleGain.toLocaleString() + ': excluded $' + homeSaleExclusion.toLocaleString() + ' (Section 121), $' + homeSaleTaxable.toLocaleString() + ' is taxable', impact:'high' });
    } else if (homeSaleGain > 0) {
      assumptions.push({ id:'home_sale', text:'Home sale gain of $' + homeSaleGain.toLocaleString() + ' fully excluded under Section 121 ($' + (fs === 'mfj' ? '500,000' : '250,000') + ' limit)', impact:'low' });
    }
  }

  // 1031 Like-Kind Exchange (Form 8824)
  let exchange1031Deferred = 0, exchange1031Boot = 0;
  if (data.exchange1031) {
    const ex = data.exchange1031;
    const relinquishedFMV = ex.relinquishedFMV || 0;
    const relinquishedBasis = ex.relinquishedBasis || 0;
    const replacementFMV = ex.replacementFMV || 0;
    const realizedGain = Math.max(0, relinquishedFMV - relinquishedBasis);
    // Boot = cash or non-like-kind property received
    exchange1031Boot = Math.max(0, relinquishedFMV - replacementFMV + (ex.bootReceived || 0) - (ex.bootPaid || 0));
    exchange1031Boot = Math.min(exchange1031Boot, realizedGain); // Can't recognize more than realized gain
    exchange1031Deferred = realizedGain - exchange1031Boot;
    if (exchange1031Boot > 0) {
      // Boot is taxable as capital gain
      netLTCG += exchange1031Boot;
    }
    if (exchange1031Deferred > 0) {
      assumptions.push({ id:'1031_deferred', text:'1031 exchange deferred gain of $' + exchange1031Deferred.toLocaleString() + ' — basis of replacement property reduced accordingly', impact:'high' });
    }
    if (exchange1031Boot > 0) {
      assumptions.push({ id:'1031_boot', text:'1031 exchange boot received: $' + exchange1031Boot.toLocaleString() + ' is recognized as taxable gain', impact:'high' });
    }
    schedules.form8824 = { relinquishedFMV, relinquishedBasis, replacementFMV, realizedGain, deferredGain: exchange1031Deferred, recognizedGain: exchange1031Boot, bootReceived: ex.bootReceived || 0, bootPaid: ex.bootPaid || 0, description: ex.description || '1031 Like-Kind Exchange' };
  }

  // Retirement Distributions (1099-R)
  let totalRetirement = 0, retirementFedWithheld = 0, retirementStateWithheld = 0;
  if (data.retirementDist && data.retirementDist.length > 0) {
    totalRetirement = data.retirementDist.reduce((s, d) => s + (d.taxableAmount || 0), 0);
    retirementFedWithheld = data.retirementDist.reduce((s, d) => s + (d.fedWithheld || 0), 0);
    retirementStateWithheld = data.retirementDist.reduce((s, d) => s + (d.stateWithheld || 0), 0);
    totalFedWithheld += retirementFedWithheld;
    totalStateWithheld += retirementStateWithheld;
    assumptions.push({ id:'1099r_taxable', text:'Assumed entire 1099-R distribution is taxable (Box 2a)', impact:'high' });
  }

  const qcd = Math.min(data.qcd || 0, totalRetirement, 105000);
  if (qcd > 0) {
    totalRetirement -= qcd;
    assumptions.push({ id:'qcd_applied', text:'QCD of $' + qcd.toLocaleString() + ' excluded from retirement income', impact:'high' });
  }

  // Other income (Schedule 1 Part I)
  const priorRefund = data.priorRefund || 0;
  const gamblingIncome = data.gamblingIncome || 0;
  const alimonyReceived = data.alimonyReceived || 0;
  const rentalIncome = data.rentalIncome || 0;
  const otherMiscIncome = data.otherMiscIncome || 0;
  const unemploymentIncome = data.unemploymentIncome || 0;
  const otherIncome = priorRefund + gamblingIncome + alimonyReceived + rentalIncome + otherMiscIncome + unemploymentIncome;

  // Schedule E — Rental Income
  let schedENet = 0;
  if (data.scheduleE && data.scheduleE.length > 0) {
    data.scheduleE.forEach(prop => {
      const grossRent = prop.rents || 0;
      const expenses = (prop.advertising||0) + (prop.insurance||0) + (prop.repairs||0) +
        (prop.taxes||0) + (prop.utilities||0) + (prop.mortgage||0) + (prop.depreciation||0) + (prop.other||0);
      prop._netIncome = grossRent - expenses;
      schedENet += prop._netIncome;
    });
    schedules.E = { properties: data.scheduleE, totalNet: schedENet };
  }

  const capGainIncome = Math.max(netSTCG + netLTCG, -TAX.capitalLossLimit);

  // Social Security Benefits (SSA-1099)
  let ssaTaxable = 0, ssaFedWithheld = 0;
  if (data.ssaBenefits > 0) {
    ssaFedWithheld = data.ssaWithheld || 0;
    totalFedWithheld += ssaFedWithheld;
    // Determine taxable portion of SS benefits
    // Provisional income = AGI (without SS) + tax-exempt interest + half of SS benefits
    const halfSS = data.ssaBenefits / 2;
    const provisionalIncome = (totalWages + totalInterest + totalOrdDiv + schedCNet + capGainIncome + totalRetirement + otherIncome - seDeduction) + halfSS;
    const base1 = fs === 'mfj' ? 32000 : 25000;
    const base2 = fs === 'mfj' ? 44000 : 34000;
    if (provisionalIncome > base2) {
      ssaTaxable = Math.min(data.ssaBenefits * 0.85, 0.85 * (provisionalIncome - base2) + Math.min(halfSS, 0.5 * (base2 - base1)));
    } else if (provisionalIncome > base1) {
      ssaTaxable = Math.min(halfSS, 0.5 * (provisionalIncome - base1));
    }
    ssaTaxable = Math.round(Math.min(ssaTaxable, data.ssaBenefits * 0.85));
    assumptions.push({ id:'ssa_taxable', text:`${Math.round(ssaTaxable / data.ssaBenefits * 100)}% of Social Security benefits ($${ssaTaxable.toLocaleString()} of $${data.ssaBenefits.toLocaleString()}) included in income`, impact:'high' });
  }

  // Total Income (exclude manual rentalIncome from otherIncome if Schedule E is used to avoid double-counting)
  const schedEAdjustedOther = (data.scheduleE && data.scheduleE.length > 0) ? (otherIncome - rentalIncome) : otherIncome;
  const totalIncome = totalWages + totalInterest + totalOrdDiv + schedCNet + capGainIncome + totalRetirement + schedEAdjustedOther + ssaTaxable + schedENet;

  // Additional adjustments from user input
  const hsaDed = Math.min(data.hsaContribution || 0, fs === 'mfj' ? 8550 : 4300);
  const iraDed = Math.min(data.iraContribution || 0, 7000);
  const studentLoanDed = Math.min(data.studentLoanInterest || 0, 2500);
  const educatorDed = Math.min(data.educatorExpenses || 0, 300);
  const alimonyPaid = data.alimonyPaid || 0;
  const movingExpenses = data.movingExpenses || 0;

  // Adjustments
  const adjustments = seDeduction + hsaDed + iraDed + studentLoanDed + educatorDed + alimonyPaid + movingExpenses;
  schedules['1'] = { seDeduction, hsaDed, iraDed, studentLoanDed, educatorDed, alimonyPaid, movingExpenses, otherIncome, priorRefund, gamblingIncome, alimonyReceived, rentalIncome, otherMiscIncome, unemploymentIncome, totalAdjustments: adjustments };

  if (unemploymentIncome > 0) {
    assumptions.push({ id:'unemployment', text:`Unemployment compensation of $${unemploymentIncome.toLocaleString()} included in income (fully taxable for tax year ${TAX.year})`, impact:'medium' });
  }

  // AGI
  const agi = totalIncome - adjustments;

  // Deductions
  let itemizedTotal = 0, usingItemized = false;
  const stdDed = TAX.standardDeduction[fs];

  if (data.itemized) {
    const it = data.itemized;
    const medExcess = Math.max(0, (it.medical||0) - agi * TAX.medicalExpenseFloor);
    const saltDed = Math.min((it.stateTaxes||0) + (it.propertyTaxes||0) + totalStateWithheld, TAX.saltCap[fs]);
    const mortInt = it.mortgageInterest || 0;
    const charCash = it.charitableCash || 0;
    const charNon = it.charitableNonCash || 0;
    itemizedTotal = medExcess + saltDed + mortInt + charCash + charNon;

    if (itemizedTotal > stdDed) {
      usingItemized = true;
      schedules.A = {
        medical: it.medical||0, medicalThreshold: Math.round(agi * TAX.medicalExpenseFloor), medicalDeduction: medExcess,
        stateTaxes: (it.stateTaxes||0) + totalStateWithheld, propertyTaxes: it.propertyTaxes||0,
        saltBeforeCap: (it.stateTaxes||0) + (it.propertyTaxes||0) + totalStateWithheld, saltDeduction: saltDed,
        mortgageInterest: mortInt, charitableCash: charCash, charitableNonCash: charNon,
        totalItemized: itemizedTotal,
      };
    }
  }

  if (!usingItemized) {
    assumptions.push({ id:'std_deduction', text:`Used standard deduction of $${stdDed.toLocaleString()} (${FS_LABELS[fs]})`, impact:'high' });
  }
  const deduction = usingItemized ? itemizedTotal : stdDed;

  // QBI
  let qbiDeduction = 0;
  if (schedCNet > 0 && agi <= TAX.qbiThreshold[fs]) {
    qbiDeduction = Math.round(schedCNet * TAX.qbiRate);
    assumptions.push({ id:'qbi', text:`Applied 20% QBI deduction of $${qbiDeduction.toLocaleString()} on self-employment income`, impact:'medium' });
  }

  // Taxable Income
  const taxableIncome = Math.max(0, agi - deduction - qbiDeduction);

  // Tax
  const ordinaryIncome = Math.max(0, taxableIncome - Math.max(0, netLTCG) - totalQualDiv);
  const ordinaryTax = calcBracketTax(ordinaryIncome, TAX.brackets[fs]);
  const ltcgTaxable = Math.max(0, netLTCG) + totalQualDiv;
  const ltcgTax = calcLTCGTax(ltcgTaxable, ordinaryIncome, TAX.ltcgBrackets[fs]);
  const incomeTax = ordinaryTax + ltcgTax;

  // NIIT
  let niit = 0;
  if (agi > TAX.niitThreshold[fs]) {
    const investIncome = totalInterest + totalOrdDiv + Math.max(0, netSTCG + netLTCG);
    niit = Math.round(Math.min(investIncome, agi - TAX.niitThreshold[fs]) * TAX.niitRate);
  }

  // Alternative Minimum Tax (AMT)
  let amt = 0;
  const amtExemption = { single: 88100, mfj: 137000, mfs: 68500, hoh: 88100 };
  const amtPhaseout = { single: 609350, mfj: 1252700, mfs: 626350, hoh: 609350 };
  const amti = agi + (data.itemized ? Math.min((data.itemized.stateTaxes||0) + (data.itemized.propertyTaxes||0) + totalStateWithheld, TAX.saltCap[fs]) : 0);
  let exemption = amtExemption[fs];
  if (amti > amtPhaseout[fs]) {
    exemption = Math.max(0, exemption - (amti - amtPhaseout[fs]) * 0.25);
  }
  const amtIncome = Math.max(0, amti - exemption);
  const amtTax = amtIncome <= 239100 ? amtIncome * 0.26 : 239100 * 0.26 + (amtIncome - 239100) * 0.28;
  const tentativeMinTax = Math.round(amtTax);
  amt = Math.max(0, tentativeMinTax - incomeTax);

  // Credits
  const numChildren = data.numChildren || 0;
  const numOtherDeps = data.numOtherDeps || 0;
  const childTaxCredit = numChildren * 2000;
  const otherDepCredit = numOtherDeps * 500;
  let educationCredit = data.educationCredit || 0;
  if (educationCredit === 0 && data.tuitionPaid > 0 && data.numStudents > 0) {
    const perStudent = Math.min(data.tuitionPaid / data.numStudents, 4000);
    const aotcPerStudent = Math.min(perStudent, 2000) + Math.min(Math.max(0, perStudent - 2000), 2000) * 0.25;
    educationCredit = Math.round(aotcPerStudent * data.numStudents);
    // Make 40% refundable
    const refundableEdu = Math.round(educationCredit * 0.4);
    // We'll handle this in credits section
  }
  // Earned Income Tax Credit (EITC) - auto-calculate
  let eitcCredit = 0;
  const earnedIncome = totalWages + Math.max(0, schedCNet);
  const numQualifyingChildren = data.numChildren || 0;

  // 2025 EITC parameters (approximate)
  const eitcParams = {
    0: { maxCredit: 649, phaseInRate: 0.0765, phaseInEnd: 8490, phaseOutStart: { single: 10330, mfj: 17450 }, phaseOutRate: 0.0765 },
    1: { maxCredit: 3733, phaseInRate: 0.34, phaseInEnd: 10980, phaseOutStart: { single: 21560, mfj: 28640 }, phaseOutRate: 0.1598 },
    2: { maxCredit: 6164, phaseInRate: 0.40, phaseInEnd: 15410, phaseOutStart: { single: 21560, mfj: 28640 }, phaseOutRate: 0.2106 },
    3: { maxCredit: 6935, phaseInRate: 0.45, phaseInEnd: 15410, phaseOutStart: { single: 21560, mfj: 28640 }, phaseOutRate: 0.2106 },
  };
  const eitcKids = Math.min(numQualifyingChildren, 3);
  const ep = eitcParams[eitcKids];
  if (ep && earnedIncome > 0) {
    // Investment income limit: $11,600 for 2025
    const investmentIncome = totalInterest + totalOrdDiv + Math.max(0, netSTCG + netLTCG);
    if (investmentIncome <= 11600) {
      const phaseIn = Math.min(earnedIncome * ep.phaseInRate, ep.maxCredit);
      const phaseOutStart = ep.phaseOutStart[fs === 'mfj' ? 'mfj' : 'single'];
      const phaseOutIncome = Math.max(agi, earnedIncome);
      const phaseOut = Math.max(0, (phaseOutIncome - phaseOutStart) * ep.phaseOutRate);
      eitcCredit = Math.max(0, Math.round(phaseIn - phaseOut));
    }
  }
  if (data.eitc > 0) eitcCredit = data.eitc; // Manual override
  const childCareCredit = data.childCareCredit || 0;
  const saversCredit = data.saversCredit || 0;
  const energyCredit = data.energyCredit || 0;
  const totalNonrefundableCredits = Math.min(incomeTax, childTaxCredit + otherDepCredit + educationCredit + childCareCredit + saversCredit + energyCredit);
  const totalRefundableCredits = eitcCredit;
  const totalCredits = totalNonrefundableCredits + totalRefundableCredits;

  schedules['2'] = { seTax, niit, amt, totalAdditionalTax: seTax + niit + amt };
  schedules['3'] = { childTaxCredit, otherDepCredit, educationCredit, eitcCredit, childCareCredit, saversCredit, energyCredit, totalNonrefundableCredits, totalRefundableCredits, totalCredits };

  // Premium Tax Credit (Form 8962)
  let ptcReconciliation = 0;
  if (data.premiumTaxCredit) {
    const ptc = data.premiumTaxCredit;
    const annualSLCSP = (ptc.slcspPremium || 0) * 12;
    const advancePTC = ptc.advancePTC || 0;
    const fplSize = 1 + (data.dependents || 0) + (fs === 'mfj' || fs === 'mfs' ? 1 : 0);
    const fpl = 15060 + (fplSize - 1) * 5380;
    const fplRatio = agi / fpl;
    let applicablePct = 0;
    if (fplRatio >= 1 && fplRatio <= 1.5) applicablePct = 0.02;
    else if (fplRatio <= 2) applicablePct = 0.04;
    else if (fplRatio <= 2.5) applicablePct = 0.06;
    else if (fplRatio <= 3) applicablePct = 0.08;
    else if (fplRatio <= 4) applicablePct = 0.085;
    const expectedContribution = Math.round(agi * applicablePct);
    const totalPTC = fplRatio >= 1 && fplRatio <= 4 ? Math.max(0, annualSLCSP - expectedContribution) : 0;
    ptcReconciliation = totalPTC - advancePTC;
    schedules['8962'] = { annualSLCSP, expectedContribution, totalPTC, advancePTC, reconciliation: ptcReconciliation, fplRatio: fplRatio.toFixed(1) };
  }

  const totalTax = Math.max(0, incomeTax - totalNonrefundableCredits) + seTax + niit + amt;
  const totalPayments = totalFedWithheld + (data.estimatedPayments||0) + totalRefundableCredits + ptcReconciliation;
  const refundOrOwed = totalPayments - totalTax;

  // Underpayment penalty estimate
  let underpaymentPenalty = 0;
  const requiredPayment = totalTax * 0.9; // Must pay 90% of current year tax
  if (refundOrOwed < -1000 && totalPayments < requiredPayment) {
    // Simplified penalty: ~8% annual rate on shortfall, prorated
    const shortfall = requiredPayment - totalPayments;
    underpaymentPenalty = Math.round(shortfall * 0.08 * 0.5); // ~6 months average
    assumptions.push({ id:'underpayment', text:'Estimated underpayment penalty of $' + underpaymentPenalty.toLocaleString() + ' may apply — you may owe more than $1,000 without sufficient withholding', impact:'high' });
  }

  // Default assumptions — always let user change filing status
  if (data.w2s && data.w2s.length >= 2) {
    assumptions.unshift({ id:'filing_status', text:`Assumed ${FS_LABELS[fs]} based on multiple W-2s — you can change this`, impact:'high' });
  } else {
    assumptions.unshift({ id:'filing_status', text:`Assumed ${FS_LABELS[fs]} filing status — you can change this`, impact:'high' });
  }
  if (!data.dependents) assumptions.push({ id:'dependents', text:'Assumed no dependents — child tax credit ($2,000/child) not applied', impact:'high' });
  if (!data.educationCredit && !data.eitc && eitcCredit === 0) assumptions.push({ id:'no_credits', text:'Did not apply education credits, child tax credit, or EITC', impact:'high' });
  if (!data.educationCredit && !data.eitc && eitcCredit > 0) assumptions.push({ id:'no_credits', text:'EITC of $' + eitcCredit.toLocaleString() + ' auto-calculated — education credits not applied', impact:'medium' });
  if (!data.childCareCredit && !data.saversCredit && !data.energyCredit) assumptions.push({ id:'other_credits', text:'Did not apply child care credit, retirement saver\'s credit, or energy credits', impact:'medium' });
  if ((data.estimatedPayments||0) === 0 && schedCNet > 0) assumptions.push({ id:'estimated_payments', text:'No estimated tax payments entered — if you made quarterly payments (1040-ES), add them to increase your refund', impact:'high' });
  if (!data.hsaContribution && !data.iraContribution && !data.studentLoanInterest) assumptions.push({ id:'no_hsa', text:'Did not account for HSA, IRA contributions, or student loan interest', impact:'medium' });
  if (data.hsaDistributions > 0) {
    assumptions.push({ id:'hsa_dist', text:'HSA distribution of $' + data.hsaDistributions.toLocaleString() + ' detected — assumed used for qualified medical expenses (not taxable). If not, this is taxable income + 20% penalty.', impact:'high' });
  }
  if (!data.educatorExpenses && !data.alimonyPaid && !data.movingExpenses) assumptions.push({ id:'other_deductions', text:'Did not include educator expenses, alimony paid, or moving expenses', impact:'low' });
  if (!data.gamblingIncome && !data.alimonyReceived && !data.rentalIncome && !data.otherMiscIncome) assumptions.push({ id:'other_income', text:'Did not include other income: gambling, alimony, rental, jury duty, etc.', impact:'medium' });
  if (!data.scheduleE || data.scheduleE.length === 0) {
    assumptions.push({ id:'schedule_e', text:'No rental/royalty income reported — add Schedule E if you have rental properties', impact:'medium' });
  }
  if (!data.priorRefund) assumptions.push({ id:'prior_refund', text:'Did not include prior-year state/local tax refund (taxable if you itemized last year)', impact:'medium' });
  if (!data.premiumTaxCredit) assumptions.push({ id:'ptc', text:'Did not calculate Premium Tax Credit — add if you had Marketplace health insurance', impact:'medium' });
  if (!data.homeSale) assumptions.push({ id:'no_home_sale', text:'No home sale reported — if you sold your primary residence, you may qualify for up to $' + (fs === 'mfj' ? '500,000' : '250,000') + ' exclusion', impact:'low' });
  if (!data.exchange1031) assumptions.push({ id:'exchange_1031', text:'No 1031 like-kind exchange reported — if you exchanged investment/business real property, gain may be deferred (Form 8824)', impact:'medium' });
  if (totalRetirement > 0 && !data.qcd) {
    assumptions.push({ id:'qcd', text:'No Qualified Charitable Distribution (QCD) reported — if you are 70½+ and donated from your IRA, up to $105,000 is excluded from income', impact:'medium' });
  }
  if (!data.studentLoanInterest && !data.tuitionPaid) {
    assumptions.push({ id:'education_expenses', text:'No education expenses reported — student loan interest (up to $2,500) and tuition may provide deductions or credits', impact:'medium' });
  }
  assumptions.push({ id:'crypto', text:'Assumed no digital asset transactions — if you sold, traded, or received crypto, this must be reported', impact:'medium' });

  // State tax
  let stateResult = null;
  if (data.stateCode && STATE_TAX[data.stateCode]) {
    const federalResult = { agi, filingStatus: fs, totalStateWithheld };
    stateResult = computeStateTax(data.stateCode, federalResult, data);
  } else {
    assumptions.push({ id:'select_state', text:'No state selected — select your state for a state tax estimate', impact:'medium' });
  }

  if (amt > 0) {
    assumptions.push({ id:'amt_applies', text:`Alternative Minimum Tax of $${amt.toLocaleString()} applies — SALT add-back and AMT exemption phaseout`, impact:'high' });
  } else {
    assumptions.push({ id:'no_amt', text:'AMT does not apply (regular tax exceeds tentative minimum tax)', impact:'low' });
  }

  // Sanity checks for suspiciously large parsed values
  if (totalWages > 1000000) {
    assumptions.push({ id:'high_wages', text:`Wages of $${totalWages.toLocaleString()} detected — verify this is correct (OCR may have misread your W-2)`, impact:'high' });
  }
  if (totalIncome > 5000000) {
    assumptions.push({ id:'high_income', text:`Total income over $5M detected — verify all amounts are correct`, impact:'high' });
  }

  return {
    filingStatus: fs,
    w2s: data.w2s || [],
    interest: data.interest || [],
    dividends: data.dividends || [],
    _necSources: data._necSources || [],
    _mortgageSources: data._mortgageSources || [],
    totalWages, totalInterest, totalOrdDiv, totalQualDiv, totalRetirement,
    ssaBenefits: data.ssaBenefits || 0, ssaTaxable, ssaFedWithheld,
    retirementDist: data.retirementDist || [],
    homeSaleGain, homeSaleExclusion, homeSaleTaxable,
    exchange1031Deferred, exchange1031Boot,
    schedCNet, schedENet, netSTCG, netLTCG, capitalLossCarryover,
    totalIncome, otherIncome, adjustments, agi, deduction, usingItemized,
    qbiDeduction, taxableIncome, ordinaryTax, ltcgTax, incomeTax,
    seTax, niit, amt, ptcReconciliation, totalTax, totalFedWithheld, totalStateWithheld,
    estimatedPayments: data.estimatedPayments||0,
    totalPayments, refundOrOwed, underpaymentPenalty, assumptions, schedules,
    stateResult,
    effectiveRate: totalIncome > 0 ? (totalTax / totalIncome * 100) : 0,
    marginalRate: (TAX.brackets[fs].find(([l]) => taxableIncome <= l)?.[1] * 100) || 37,
  };
}

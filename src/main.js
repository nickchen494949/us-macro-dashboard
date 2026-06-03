import { MACRO_DATA } from './data.js';
import { renderSparkline } from './charts.js';

// Setup state
let currentRange = '5Y';
let currentTheme = localStorage.getItem('theme') || 'light';

// Document ready
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  renderDashboard();
  setupEventListeners();
});

// Theme Initialization
function initTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeButtonUI();
}

function updateThemeButtonUI() {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.innerHTML = currentTheme === 'dark' ? '☀️' : '🌙';
    btn.title = currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  }
}

// Main rendering orchestrator
function renderDashboard() {
  const data = MACRO_DATA;
  
  // 1. Calculate Statuses and Weather
  const analysis = performMacroAnalysis(data.series);
  
  // 2. Render Header/Weather Panel
  renderWeatherPanel(analysis);
  
  // 3. Render Card Sections
  renderSections(data.series, currentRange, currentTheme);
}

// Set up UI Event Listeners
function setupEventListeners() {
  // Range Selector
  const rangeBtns = document.querySelectorAll('.range-btn');
  rangeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      rangeBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentRange = e.target.dataset.range;
      renderDashboard(); // Re-render charts and cards
    });
  });

  // Theme Toggle
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      currentTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', currentTheme);
      localStorage.setItem('theme', currentTheme);
      updateThemeButtonUI();
      renderDashboard(); // Re-render charts with correct colors
    });
  }
}

// ----------------------------------------------------
// Section configurations and specific card information
// ----------------------------------------------------
const SECTIONS_CONFIG = {
  growth: {
    title: "Growth & Real Economy",
    icon: "📈",
    desc: "Measures the expansion rate of the real economy. Sustained positive growth shows expansion; rolling over indicates slowdown or recession risk."
  },
  labor: {
    title: "Labor Market",
    icon: "💼",
    desc: "Evaluates employment health. Tight labor markets support wage growth and consumer demand; rising unemployment signals economic distress."
  },
  inflation: {
    title: "Inflation Pressures",
    icon: "🏷️",
    desc: "Monitors price pressures relative to the Fed's 2.0% target. Deflation indicates depression; high inflation triggers restrictive monetary policy."
  },
  rates: {
    title: "Fed, Rates & Yield Curve",
    icon: "🏦",
    desc: "Shows borrowing costs and Treasury spread dynamics. Inverted yield curves are highly reliable leading indicators of economic recession."
  },
  liquidity: {
    title: "Liquidity, Banking & Money",
    icon: "💧",
    desc: "Tracks capital reserves and liquidity injections or drains. Declining liquidity indicates tightening financial conditions."
  },
  credit: {
    title: "Credit Stress",
    icon: "⚠️",
    desc: "Assesses systemic credit default and financing risk. Spiking credit spreads signal banking or financial system fractures."
  },
  housing: {
    title: "Housing & Rate-Sensitive Sector",
    icon: "🏠",
    desc: "Monitors real estate activity, which is highly sensitive to interest rate policy and serves as a major economic amplifier."
  }
};

// ----------------------------------------------------
// 1. MACRO STATUS LOGIC (V1 RULE ENGINE)
// ----------------------------------------------------

function performMacroAnalysis(series) {
  const analysis = {
    growth: { status: 'neutral', val: 'slowing', exp: 'Checking real economic growth data...' },
    labor: { status: 'neutral', val: 'cooling', exp: 'Checking employment rates and claims...' },
    inflation: { status: 'neutral', val: 'sticky', exp: 'Evaluating CPI and PCE index YoY trend...' },
    rates: { status: 'neutral', val: 'restrictive', exp: 'Analyzing interest rates and yield curve spread...' },
    credit: { status: 'neutral', val: 'calm', exp: 'Measuring high-yield defaults and financial stress...' },
    weather: 'Goldilocks'
  };

  // Safe checks if series exist
  const getLatestVal = (id) => series[id] ? series[id].latest.value : null;
  const getChange = (id, period) => {
    if (!series[id] || !series[id].changes) return 0;
    return series[id].changes[period] || 0;
  };
  const getHistory = (id) => series[id] ? series[id].history : [];

  // --- 1. Growth Status ---
  const gdpYoY = getLatestVal('GDPC1');
  const indproYoY = getLatestVal('INDPRO');
  const retailSalesYoY = getLatestVal('RSXFS');
  
  if (gdpYoY !== null) {
    if (gdpYoY < 0) {
      analysis.growth = {
        status: 'danger',
        val: 'contracting',
        exp: `Real GDP YoY is in contraction at ${gdpYoY.toFixed(1)}%. Real economic activity is shrinking.`
      };
    } else {
      // Check 3M or recent momentum
      const ipChange = getChange('INDPRO', 'change3m');
      if (gdpYoY < 2.0 || ipChange < 0 || (retailSalesYoY !== null && retailSalesYoY < 2.0)) {
        analysis.growth = {
          status: 'worsening',
          val: 'slowing',
          exp: `Economy is expanding but slowing down. GDP YoY is ${gdpYoY.toFixed(1)}% and industrial growth is losing steam.`
        };
      } else {
        analysis.growth = {
          status: 'improving',
          val: 'expanding',
          exp: `Robust real economic growth. GDP YoY is ${gdpYoY.toFixed(1)}% and consumer spending supports expansion.`
        };
      }
    }
  }

  // --- 2. Labor Market Status ---
  const unrate = getLatestVal('UNRATE');
  const payems3m = getLatestVal('PAYEMS'); // 3M Avg Net change
  const claims4w = getLatestVal('ICSA'); // 4W Avg Initial Claims
  
  if (unrate !== null) {
    // Sahm Rule: Rise > 0.5pp from 12M low
    const unrateHistory = getHistory('UNRATE');
    let low12m = 99.0;
    if (unrateHistory.length > 0) {
      const startIdx = Math.max(0, unrateHistory.length - 12);
      for (let i = startIdx; i < unrateHistory.length; i++) {
        if (unrateHistory[i].value < low12m) low12m = unrateHistory[i].value;
      }
    }
    const sahmDiff = unrate - low12m;

    if (sahmDiff >= 0.5 || (payems3m !== null && payems3m < 0)) {
      analysis.labor = {
        status: 'danger',
        val: 'cracking',
        exp: `Labor market shows recession signs. Unemployment is up ${sahmDiff.toFixed(2)}pp from its 12M low of ${low12m.toFixed(1)}%.`
      };
    } else if (sahmDiff >= 0.25 || (payems3m !== null && payems3m < 120) || (claims4w !== null && claims4w > 230000)) {
      analysis.labor = {
        status: 'worsening',
        val: 'cooling',
        exp: `Labor demand is moderating. Unemployment at ${unrate.toFixed(1)}% is creeping up; monthly jobs average is ${payems3m ? payems3m.toFixed(0) : 'N/A'}k.`
      };
    } else {
      analysis.labor = {
        status: 'improving',
        val: 'strong',
        exp: `Labor market remains tight. Unemployment is at ${unrate.toFixed(1)}% and payroll growth remains solid.`
      };
    }
  }

  // --- 3. Inflation Status ---
  const cpiYoY = getLatestVal('CPIAUCSL');
  const coreCpiYoY = getLatestVal('CPILFESL');
  
  if (cpiYoY !== null) {
    const cpiChange6m = getChange('CPIAUCSL', 'change12m'); // using changes
    // Check trend: Compare latest to 3 months ago
    const cpiHistory = getHistory('CPIAUCSL');
    let cpi3m = cpiYoY;
    if (cpiHistory.length > 3) {
      cpi3m = cpiHistory[cpiHistory.length - 4].value;
    }
    const trend3m = cpiYoY - cpi3m;

    if (cpiYoY > 3.5 && trend3m > 0.1) {
      analysis.inflation = {
        status: 'danger',
        val: 'reaccelerating',
        exp: `Inflation pressure is rising. CPI YoY has crept up to ${cpiYoY.toFixed(2)}% (+${trend3m.toFixed(2)}% over 3M).`
      };
    } else if (cpiYoY > 2.8) {
      analysis.inflation = {
        status: 'worsening',
        val: 'sticky',
        exp: `Inflation remains sticky above the Fed target. CPI YoY at ${cpiYoY.toFixed(2)}% is resisting further downward progress.`
      };
    } else {
      analysis.inflation = {
        status: 'improving',
        val: 'cooling',
        exp: `Inflation is moderating toward target. Latest CPI YoY is ${cpiYoY.toFixed(2)}% and PCE core trends lower.`
      };
    }
  }

  // --- 4. Fed / Rates Status ---
  const ffr = getLatestVal('FEDFUNDS');
  const spread10y2y = getLatestVal('T10Y2Y');
  
  if (ffr !== null) {
    // If spread inverted < 0, yield curve shows restrictive policy and recession warning
    if (spread10y2y !== null && spread10y2y < 0) {
      analysis.rates = {
        status: 'danger',
        val: 'restrictive',
        exp: `Yield curve inverted at ${spread10y2y.toFixed(2)}% under restrictive FFR of ${ffr.toFixed(2)}%. High recession risk.`
      };
    } else {
      const ffrHistory = getHistory('FEDFUNDS');
      let ffr3m = ffr;
      if (ffrHistory.length > 3) ffr3m = ffrHistory[ffrHistory.length - 4].value;
      
      if (ffr - ffr3m > 0.1) {
        analysis.rates = {
          status: 'danger',
          val: 'tightening',
          exp: `Fed is actively raising interest rates. Policy Rate is at ${ffr.toFixed(2)}%, increasing borrowing costs.`
        };
      } else if (ffr > 3.0) {
        analysis.rates = {
          status: 'neutral',
          val: 'restrictive',
          exp: `Policy Rate remains restrictive at ${ffr.toFixed(2)}% to suppress inflation pressure.`
        };
      } else {
        analysis.rates = {
          status: 'improving',
          val: 'easing',
          exp: `Fed is easing policy or rates are stimulative. FFR is low at ${ffr.toFixed(2)}%.`
        };
      }
    }
  }

  // --- 5. Credit / Liquidity Status ---
  const hySpread = getLatestVal('BAMLH0A0HYM2');
  const stressIndex = getLatestVal('STLFSI4');
  const reserves = getLatestVal('RESBALNS'); // trillion
  
  if (hySpread !== null) {
    if (hySpread > 5.5 || (stressIndex !== null && stressIndex > 1.2)) {
      analysis.credit = {
        status: 'danger',
        val: 'stress',
        exp: `Systemic financial system stress detected. High-yield spreads have surged to ${hySpread.toFixed(2)}%.`
      };
    } else if (hySpread > 4.2 || (reserves !== null && reserves < 3.0)) {
      analysis.credit = {
        status: 'worsening',
        val: 'tightening',
        exp: `Liquidity is draining and credit terms are tightening. Corporate HY spreads are moderate at ${hySpread.toFixed(2)}%.`
      };
    } else {
      analysis.credit = {
        status: 'improving',
        val: 'calm',
        exp: `Credit markets are calm. Corporate HY spreads are low at ${hySpread.toFixed(2)}%, indicating healthy capital access.`
      };
    }
  }

  // --- 6. Master Weather State Logic ---
  // Rules order of severity:
  if (analysis.labor.val === 'cracking' || (analysis.growth.val === 'contracting' && analysis.labor.val === 'cooling')) {
    analysis.weather = 'Recession Risk';
  } else if (analysis.credit.val === 'stress' || (hySpread !== null && hySpread > 5.0)) {
    analysis.weather = 'Credit Stress';
  } else if (analysis.inflation.val === 'reaccelerating' || (analysis.inflation.val === 'sticky' && analysis.rates.val === 'tightening')) {
    analysis.weather = 'Inflation Problem';
  } else if (analysis.growth.val === 'slowing' || analysis.labor.val === 'cooling' || (analysis.rates.val === 'restrictive' && spread10y2y < 0)) {
    analysis.weather = 'Slowdown';
  } else {
    analysis.weather = 'Goldilocks';
  }

  return analysis;
}

// ----------------------------------------------------
// 2. RENDER THE WEATHER / SUMMARY PANEL
// ----------------------------------------------------
function renderWeatherPanel(analysis) {
  // Update Master Weather Badge
  const badgeContainer = document.getElementById('weather-master-container');
  if (badgeContainer) {
    const weather = analysis.weather;
    const weatherClass = weather.toLowerCase().replace(' ', '-');
    badgeContainer.className = `weather-master-badge ${weatherClass}`;
    badgeContainer.innerHTML = `🌤️ US Macro Weather: ${weather}`;
  }

  // Render Pillars
  const pillarsGrid = document.getElementById('weather-pillars-grid');
  if (!pillarsGrid) return;

  const pillars = [
    { label: 'Growth', key: 'growth', title: 'Real Economy' },
    { label: 'Labor', key: 'labor', title: 'Employment' },
    { label: 'Inflation', key: 'inflation', title: 'Prices' },
    { label: 'Fed/Rates', key: 'rates', title: 'Monetary Policy' },
    { label: 'Credit/Liquidity', key: 'credit', title: 'Financial Channels' }
  ];

  pillarsGrid.innerHTML = pillars.map(p => {
    const state = analysis[p.key];
    const statusClass = state.status;
    return `
      <div class="pillar-card">
        <span class="pillar-label">${p.label}</span>
        <div class="pillar-value">
          <span class="status-pill ${statusClass}">${state.val}</span>
        </div>
        <p class="pillar-explanation">${state.exp}</p>
      </div>
    `;
  }).join('');
}

// ----------------------------------------------------
// 3. RENDER ALL INDIVIDUAL MACRO CARDS BY SECTION
// ----------------------------------------------------
function renderSections(allSeries, range, theme) {
  const container = document.getElementById('sections-container');
  if (!container) return;

  container.innerHTML = ''; // Clear container

  // Group series by section
  const sectionGroups = {};
  Object.keys(SECTIONS_CONFIG).forEach(s => {
    sectionGroups[s] = [];
  });

  Object.keys(allSeries).forEach(id => {
    const s = allSeries[id];
    if (sectionGroups[s.section]) {
      sectionGroups[s.section].push(s);
    }
  });

  // Render each section
  Object.keys(SECTIONS_CONFIG).forEach(secKey => {
    const secCfg = SECTIONS_CONFIG[secKey];
    const cards = sectionGroups[secKey] || [];

    if (cards.length === 0) return; // Skip empty sections

    const secWrapper = document.createElement('div');
    secWrapper.className = 'section-wrapper';
    secWrapper.id = `section-${secKey}`;

    secWrapper.innerHTML = `
      <h2 class="section-title"><i>${secCfg.icon}</i> ${secCfg.title}</h2>
      <p class="section-desc">${secCfg.desc}</p>
      <div class="cards-grid" id="grid-${secKey}"></div>
    `;

    container.appendChild(secWrapper);

    const grid = document.getElementById(`grid-${secKey}`);
    cards.forEach(cardData => {
      renderCard(grid, cardData, range, theme);
    });
  });
}

// Render individual card with Canvas Sparkline
function renderCard(gridElement, card, range, theme) {
  const cardElement = document.createElement('div');
  const cardStatus = calculateCardStatus(card.id, card);
  
  cardElement.className = `macro-card ${cardStatus.level}`;
  cardElement.id = `card-${card.id}`;

  const formattedVal = formatValue(card.latest.value, card.unit, card.id);
  const changesHTML = generateChangesHTML(card.changes, card.unit, card.id);
  const formattedDate = formatDate(card.latest.date, card.frequency);

  cardElement.innerHTML = `
    <div class="card-header">
      <div class="card-title-section">
        <span class="card-series-id">${card.id}</span>
        <h3 class="card-title">${card.name}</h3>
      </div>
      <span class="status-pill ${cardStatus.level}">${cardStatus.label}</span>
    </div>
    
    <div class="card-value-section">
      <div>
        <span class="card-value">${formattedVal.value}</span>
        <span class="card-unit">${formattedVal.unit}</span>
      </div>
      <span class="card-date">as of ${formattedDate}</span>
    </div>

    <!-- Sparkline canvas container -->
    <div class="chart-container">
      <canvas id="canvas-${card.id}"></canvas>
    </div>

    <!-- 1M, 3M, 12M Momentum changes -->
    <div class="changes-section">
      ${changesHTML}
    </div>

    <p class="card-explanation" id="exp-${card.id}">
      ${cardStatus.explanation}
    </p>
  `;

  gridElement.appendChild(cardElement);

  // Hook up Canvas Sparkline drawing with interactive Hover updates
  const canvas = document.getElementById(`canvas-${card.id}`);
  const explanationEl = document.getElementById(`exp-${card.id}`);
  const defaultExplanation = cardStatus.explanation;

  renderSparkline(canvas, card.history, range, theme, (hoverPoint) => {
    if (hoverPoint) {
      // Hovering: update card value & date text
      const valEl = cardElement.querySelector('.card-value');
      const dateEl = cardElement.querySelector('.card-date');
      const formatted = formatValue(hoverPoint.value, card.unit, card.id);
      
      valEl.textContent = formatted.value;
      dateEl.textContent = `on ${formatDate(hoverPoint.date, card.frequency)}`;
      
      // Update small visual indication in explanation area
      explanationEl.innerHTML = `<strong>Data Point:</strong> ${formatted.value}${formatted.unit} on ${hoverPoint.date}`;
    } else {
      // Reset to latest value
      const valEl = cardElement.querySelector('.card-value');
      const dateEl = cardElement.querySelector('.card-date');
      
      valEl.textContent = formattedVal.value;
      dateEl.textContent = `as of ${formattedDate}`;
      explanationEl.innerHTML = defaultExplanation;
    }
  });
}

// ----------------------------------------------------
// CARD STATUS RULES (improving / worsening / neutral / danger)
// ----------------------------------------------------
function calculateCardStatus(id, card) {
  const latest = card.latest.value;
  const changes = card.changes;

  // Setup returns
  let level = 'neutral';
  let label = 'Neutral';
  let explanation = '';

  switch (id) {
    // --- 1. Growth ---
    case 'GDPC1':
      if (latest < 0) {
        level = 'danger'; label = 'Contracting';
        explanation = `Real GDP is shrinking YoY at ${latest.toFixed(1)}%. Real output contraction indicates recession conditions.`;
      } else if (latest < 1.8) {
        level = 'worsening'; label = 'Slowing';
        explanation = `GDP YoY expansion is below-trend at ${latest.toFixed(1)}%. Real growth is cooling down.`;
      } else {
        level = 'improving'; label = 'Expanding';
        explanation = `Real GDP YoY is expanding solid at ${latest.toFixed(1)}%, indicating healthy output expansion.`;
      }
      break;

    case 'INDPRO':
      if (latest < -1.0) {
        level = 'danger'; label = 'Contracting';
        explanation = `Industrial production index is contracting YoY at ${latest.toFixed(1)}%, indicating manufacturing distress.`;
      } else if (latest < 1.0) {
        level = 'worsening'; label = 'Slowing';
        explanation = `Production output YoY is soft at ${latest.toFixed(1)}%, indicating stagnation.`;
      } else {
        level = 'improving'; label = 'Expanding';
        explanation = `Industrial production is expanding YoY at ${latest.toFixed(1)}%, driven by manufacturing strength.`;
      }
      break;

    case 'RSXFS':
      if (latest < 0) {
        level = 'danger'; label = 'Danger';
        explanation = `Nominal retail sales YoY is in negative territory (${latest.toFixed(1)}%). Retail consumption is shrinking.`;
      } else if (changes.change3m < 0) {
        level = 'worsening'; label = 'Slowing';
        explanation = `Retail sales YoY is positive at ${latest.toFixed(1)}% but spending momentum is slowing (-3M).`;
      } else {
        level = 'improving'; label = 'Strong';
        explanation = `Consumer retail spending remains robust, expanding YoY at ${latest.toFixed(1)}%.`;
      }
      break;

    case 'PCECC96':
      if (latest < 1.0) {
        level = 'danger'; label = 'Weak';
        explanation = `Real consumption spending YoY is dangerously weak at ${latest.toFixed(1)}%. Consumer demand is stalling.`;
      } else if (latest < 2.0) {
        level = 'worsening'; label = 'Cooling';
        explanation = `Consumer spending YoY is cooling at ${latest.toFixed(1)}%, representing modest demand expansion.`;
      } else {
        level = 'improving'; label = 'Strong';
        explanation = `Real personal consumption YoY is expanding robustly at ${latest.toFixed(1)}%, anchoring GDP.`;
      }
      break;

    // --- 2. Labor ---
    case 'UNRATE':
      // Fetch 12M history and calculate Sahm Rule
      let low12m = 99.0;
      card.history.slice(-12).forEach(pt => {
        if (pt.value < low12m) low12m = pt.value;
      });
      const sahmVal = latest - low12m;

      if (sahmVal >= 0.5) {
        level = 'danger'; label = 'Danger';
        explanation = `Unemployment has risen ${sahmVal.toFixed(2)}pp above 12M low (${low12m.toFixed(1)}%). Triggers Sahm Rule recession warning.`;
      } else if (changes.change3m > 0.2) {
        level = 'worsening'; label = 'Rising';
        explanation = `Unemployment rate at ${latest.toFixed(1)}% is creeping up (+${changes.change3m.toFixed(1)}pp over 3 months).`;
      } else {
        level = 'improving'; label = 'Low';
        explanation = `Unemployment remains historically low and stable at ${latest.toFixed(1)}%. Labor channels remain healthy.`;
      }
      break;

    case 'PAYEMS':
      if (latest < 0) {
        level = 'danger'; label = 'Net Losses';
        explanation = `Nonfarm payroll net jobs added is negative (${latest.toFixed(0)}k), signaling active workforce layoffs.`;
      } else if (latest < 120) {
        level = 'worsening'; label = 'Cooling';
        explanation = `Job additions average is cooling down at ${latest.toFixed(0)}k, trailing labor supply expansion.`;
      } else {
        level = 'improving'; label = 'Strong';
        explanation = `Robust job market expansion with ${latest.toFixed(0)}k net additions per month on average.`;
      }
      break;

    case 'ICSA':
      if (latest > 250) {
        level = 'danger'; label = 'Spiking';
        explanation = `Initial jobless claims 4W average is high at ${latest.toFixed(0)}k, indicating expanding corporate layoffs.`;
      } else if (changes.change3m > 20) {
        level = 'worsening'; label = 'Rising';
        explanation = `Claims 4W average has risen to ${latest.toFixed(0)}k, suggesting marginal labor market cracks.`;
      } else {
        level = 'improving'; label = 'Low';
        explanation = `Jobless claims remain low at ${latest.toFixed(0)}k, suggesting firm retention is still strong.`;
      }
      break;

    case 'JTSJOL':
      if (latest < 7.0) {
        level = 'worsening'; label = 'Cooling';
        explanation = `Job openings index is falling at ${latest.toFixed(2)}M, indicating reduced corporate hiring eagerness.`;
      } else {
        level = 'improving'; label = 'Strong';
        explanation = `Openings remain plentiful at ${latest.toFixed(2)}M, maintaining a labor-favorable supply spread.`;
      }
      break;

    // --- 3. Inflation ---
    case 'CPIAUCSL':
    case 'PCEPI':
      if (latest > 4.0) {
        level = 'danger'; label = 'High';
        explanation = `Inflation YoY remains uncomfortably high at ${latest.toFixed(2)}%, well above Fed target.`;
      } else if (latest > 2.5) {
        level = 'worsening'; label = 'Sticky';
        explanation = `Latest inflation rate is ${latest.toFixed(2)}%. YoY trend is sticky and resisting target return.`;
      } else {
        level = 'improving'; label = 'Target';
        explanation = `Inflation is cooling at ${latest.toFixed(2)}% YoY, moving into proximity of the Fed target.`;
      }
      break;

    case 'CPILFESL':
    case 'PCEPILFE':
      if (latest > 3.5) {
        level = 'danger'; label = 'High';
        explanation = `Core inflation YoY is high at ${latest.toFixed(2)}%. Underlying sticky pricing pressures remain.`;
      } else if (latest > 2.5) {
        level = 'worsening'; label = 'Sticky';
        explanation = `Core inflation YoY is sticky at ${latest.toFixed(2)}%, highlighting persistent services costs.`;
      } else {
        level = 'improving'; label = 'Cooling';
        explanation = `Core inflation YoY is moderating nicely at ${latest.toFixed(2)}%, validating policy cooling.`;
      }
      break;

    // --- 4. Rates ---
    case 'FEDFUNDS':
      if (latest > 5.0) {
        level = 'danger'; label = 'Highly Restrictive';
        explanation = `Effective Fed Funds rate is restrictive at ${latest.toFixed(2)}%, aggressively slowing credit expansion.`;
      } else if (latest > 3.0) {
        level = 'neutral'; label = 'Restrictive';
        explanation = `Monetary policy rates are moderately restrictive at ${latest.toFixed(2)}% to anchor inflation.`;
      } else {
        level = 'improving'; label = 'Easing';
        explanation = `Policy rates are stimulative or accommodative at ${latest.toFixed(2)}%.`;
      }
      break;

    case 'DGS2':
    case 'DGS10':
      if (latest > 4.5) {
        level = 'worsening'; label = 'High Yield';
        explanation = `Yield at ${latest.toFixed(2)}% increases financing costs for banks and corporations.`;
      } else {
        level = 'neutral'; label = 'Moderate';
        explanation = `Treasury yields are stable around ${latest.toFixed(2)}%, reflecting standard capital markets pricing.`;
      }
      break;

    case 'T10Y2Y':
      if (latest < -0.4) {
        level = 'danger'; label = 'Deep Inversion';
        explanation = `Spread is deeply inverted at ${latest.toFixed(2)}%. Yield inversion is a highly reliable leading indicator for recessions.`;
      } else if (latest < 0) {
        level = 'worsening'; label = 'Inverted';
        explanation = `The yield curve is inverted at ${latest.toFixed(2)}%, signaling that markets expect future growth cooling.`;
      } else if (changes.change3m > 0.3) {
        level = 'improving'; label = 'Steepening';
        explanation = `Yield curve is steepening toward positive spread (${latest.toFixed(2)}%), indicating recession approach or normalization.`;
      } else {
        level = 'improving'; label = 'Normal';
        explanation = `Spread is normal and positive at ${latest.toFixed(2)}%, mirroring expansion trends.`;
      }
      break;

    // --- 5. Liquidity ---
    case 'WALCL':
      if (changes.change12m < -400) {
        level = 'worsening'; label = 'Shrinking';
        explanation = `Fed assets are shrinking YoY (Quantitative Tightening), draining system liquidity.`;
      } else {
        level = 'improving'; label = 'Stable/QE';
        explanation = `Fed Balance Sheet total assets at $${(latest).toFixed(2)}T indicate liquid backing is stable.`;
      }
      break;

    case 'RESBALNS':
      if (latest < 3.0) {
        level = 'danger'; label = 'Ample Limit';
        explanation = `Bank reserves at $${(latest).toFixed(2)}T are close to the lowest safe ample reserves threshold.`;
      } else {
        level = 'improving'; label = 'Ample';
        explanation = `Reserves are high at $${(latest).toFixed(2)}T, ensuring liquidity in the commercial banking network.`;
      }
      break;

    case 'RRPONTSYD':
      if (latest < 0.2) {
        level = 'worsening'; label = 'Drained';
        explanation = `Reverse repo cash is mostly drained to $${(latest).toFixed(2)}T, removing a bank liquidity buffer.`;
      } else {
        level = 'improving'; label = 'High Cash';
        explanation = `Significant cash ($${(latest).toFixed(2)}T) sits in Reverse Repo, representing a latent banking buffer.`;
      }
      break;

    case 'WDTGAL':
      if (latest < 150) {
        level = 'worsening'; label = 'Low Balance';
        explanation = `Treasury General Account balance is low ($${(latest).toFixed(0)}B), indicating impending liquidity constraints.`;
      } else {
        level = 'neutral'; label = 'Comfortable';
        explanation = `Treasury cash buffer is stable at $${(latest).toFixed(0)}B, representing healthy government liquidity.`;
      }
      break;

    case 'M2SL':
      if (latest < -1.0) {
        level = 'danger'; label = 'Contraction';
        explanation = `M2 Money Supply is shrinking YoY at ${latest.toFixed(1)}%. Money contraction historically halts economic growth.`;
      } else if (latest < 1.0) {
        level = 'worsening'; label = 'Stagnant';
        explanation = `M2 growth is stagnant at ${latest.toFixed(1)}% YoY, mirroring overall credit demand slowdown.`;
      } else {
        level = 'improving'; label = 'Growing';
        explanation = `Money supply is expanding at ${latest.toFixed(1)}% YoY, reflecting standard bank credit issuance.`;
      }
      break;

    case 'TOTBKCR':
      if (latest < 0) {
        level = 'danger'; label = 'Credit Crunch';
        explanation = `Commercial bank credit YoY is contracting at ${latest.toFixed(1)}%, indicating a banking credit crunch.`;
      } else if (latest < 2.5) {
        level = 'worsening'; label = 'Tightening';
        explanation = `Bank credit expansion is slow at ${latest.toFixed(1)}% YoY. Banking sector is tightening terms.`;
      } else {
        level = 'improving'; label = 'Expanding';
        explanation = `Bank credit growth YoY is solid at ${latest.toFixed(1)}%, backing capital business investment.`;
      }
      break;

    // --- 6. Credit Stress ---
    case 'BAMLH0A0HYM2':
      if (latest > 5.0) {
        level = 'danger'; label = 'High Stress';
        explanation = `High-yield spreads at ${latest.toFixed(2)}% indicate market concerns about rising corporate defaults.`;
      } else if (latest > 4.2) {
        level = 'worsening'; label = 'Creeping';
        explanation = `High-yield credit spreads are creeping up to ${latest.toFixed(2)}%, indicating marginal financing tightening.`;
      } else {
        level = 'improving'; label = 'Calm';
        explanation = `Spreads remain compressed at ${latest.toFixed(2)}%, showing high confidence in corporate debt servicing.`;
      }
      break;

    case 'BAMLC0A0CM':
      if (latest > 2.0) {
        level = 'danger'; label = 'IG Stress';
        explanation = `Investment grade spread is high at ${latest.toFixed(2)}%, signaling liquidity constraints in top credits.`;
      } else {
        level = 'improving'; label = 'Calm';
        explanation = `IG credit spreads are tight at ${latest.toFixed(2)}%, suggesting institutional lending channels are open.`;
      }
      break;

    case 'STLFSI4':
      if (latest > 1.0) {
        level = 'danger'; label = 'Stress';
        explanation = `St. Louis Fed Stress Index is high at ${latest.toFixed(2)} pts, signaling rising stress in bank markets.`;
      } else if (latest > 0.0) {
        level = 'worsening'; label = 'Elevated';
        explanation = `Stress index is slightly elevated at ${latest.toFixed(2)} pts, reflecting market volatility.`;
      } else {
        level = 'improving'; label = 'Calm';
        explanation = `Stress index is below historical average at ${latest.toFixed(2)} pts, signaling quiet banking conditions.`;
      }
      break;

    // --- 7. Housing ---
    case 'HOUST':
      if (changes.change12m < -150) {
        level = 'danger'; label = 'Contracting';
        explanation = `Housing starts are falling YoY, signaling high borrowing costs are halting builder starts.`;
      } else {
        level = 'improving'; label = 'Expanding';
        explanation = `Starts average ${latest.toFixed(0)}k, indicating homebuilder sentiment remains resilient.`;
      }
      break;

    case 'PERMIT':
      if (changes.change12m < -150) {
        level = 'danger'; label = 'Slumping';
        explanation = `Building permits are slumping YoY, highlighting developer retreat from future builds.`;
      } else {
        level = 'improving'; label = 'Active';
        explanation = `Permits are stable at ${latest.toFixed(0)}k, signaling developers expect future demand.`;
      }
      break;

    case 'MORTGAGE30US':
      if (latest > 7.0) {
        level = 'danger'; label = 'High Rate';
        explanation = `30Y mortgage rate is high at ${latest.toFixed(2)}%, severely reducing home buyer affordability.`;
      } else if (latest > 5.5) {
        level = 'worsening'; label = 'Restrictive';
        explanation = `Mortgage rate is restrictive at ${latest.toFixed(2)}%, slowing transaction turnover volume.`;
      } else {
        level = 'improving'; label = 'Low Rate';
        explanation = `Mortgage rate is low at ${latest.toFixed(2)}%, boosting consumer homebuying demand.`;
      }
      break;

    case 'CSUSHPINSA':
      if (latest < 0) {
        level = 'danger'; label = 'Falling';
        explanation = `National home price index is declining YoY at ${latest.toFixed(1)}%, indicating asset devaluation.`;
      } else if (latest > 8.0) {
        level = 'danger'; label = 'Overheating';
        explanation = `Home prices YoY are inflating rapidly at ${latest.toFixed(1)}%, creating affordability blockages.`;
      } else {
        level = 'improving'; label = 'Appreciating';
        explanation = `Home prices are appreciating healthily at ${latest.toFixed(1)}% YoY, mirroring standard asset growth.`;
      }
      break;
  }

  return { level, label, explanation };
}

// ----------------------------------------------------
// UI FORMATTING UTILITIES
// ----------------------------------------------------
function formatValue(value, unit, id) {
  if (value === null || isNaN(value)) return { value: 'N/A', unit: '' };
  
  let formatted = value;
  
  if (id === 'ICSA') {
    // raw values in thousands (Claims 4W Avg has values like 209000). Show in thousands as 'k'
    formatted = (value / 1000).toFixed(1);
    return { value: formatted, unit: 'k' };
  }
  
  if (unit === '$T') {
    return { value: value.toFixed(3), unit: '$T' };
  }
  if (unit === '$B') {
    return { value: value.toFixed(1), unit: '$B' };
  }
  if (unit === 'M') {
    return { value: value.toFixed(2), unit: 'M' };
  }
  if (unit === 'k') {
    return { value: Math.round(value).toString(), unit: 'k' };
  }
  if (unit === 'pts') {
    return { value: value.toFixed(2), unit: ' pts' };
  }
  if (unit === '%') {
    const sign = value > 0 ? '+' : '';
    // Don't add plus to yields, but do to GDP or CPI changes if YoY
    const needPlus = ['GDPC1', 'INDPRO', 'RSXFS', 'PCECC96', 'CPIAUCSL', 'CPILFESL', 'PCEPI', 'PCEPILFE', 'M2SL', 'TOTBKCR', 'CSUSHPINSA'].includes(id);
    return { value: (needPlus ? sign : '') + value.toFixed(2), unit: '%' };
  }

  return { value: value.toString(), unit: unit || '' };
}

function generateChangesHTML(changes, unit, id) {
  if (!changes) return '';

  const renderBadge = (val, label) => {
    if (val === null || val === undefined) {
      return `
        <div class="change-badge">
          <span class="change-label">${label}</span>
          <span class="change-value">—</span>
        </div>
      `;
    }
    
    let formattedVal = val;
    let colorClass = '';

    if (id === 'ICSA') {
      formattedVal = (val / 1000).toFixed(1);
    }
    
    // Determine color coding based on whether increase is good or bad
    let isPositiveGood = true; // For growth/sales/employment, positive is good
    if (['UNRATE', 'ICSA', 'CPIAUCSL', 'CPILFESL', 'PCEPI', 'PCEPILFE', 'BAMLH0A0HYM2', 'BAMLC0A0CM', 'STLFSI4', 'MORTGAGE30US'].includes(id)) {
      isPositiveGood = false; // For inflation, claims, spreads, rate, yield, positive is bad
    }

    if (val > 0) {
      colorClass = isPositiveGood ? 'positive' : 'negative';
      formattedVal = '+' + formattedVal;
    } else if (val < 0) {
      colorClass = isPositiveGood ? 'negative' : 'positive';
    }

    const unitSuffix = (id === 'ICSA') ? 'k' : (unit === '%' ? 'pp' : unit);

    return `
      <div class="change-badge">
        <span class="change-label">${label}</span>
        <span class="change-value ${colorClass}">${formattedVal}${unitSuffix}</span>
      </div>
    `;
  };

  const c1m = renderBadge(changes.change1m, '1M');
  const c3m = renderBadge(changes.change3m, '3M');
  const c12m = renderBadge(changes.change12m, '12M');

  return c1m + c3m + c12m;
}

function formatDate(dateStr, frequency) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  if (frequency === 'quarterly') {
    // Show Q1/Q2/Q3/Q4 YYYY
    const month = d.getUTCMonth();
    let q = 'Q1';
    if (month >= 3 && month < 6) q = 'Q2';
    if (month >= 6 && month < 9) q = 'Q3';
    if (month >= 9) q = 'Q4';
    return `${q} ${d.getUTCFullYear()}`;
  }
  
  if (frequency === 'monthly') {
    return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  // Daily or weekly
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

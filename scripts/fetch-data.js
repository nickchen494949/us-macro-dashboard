const fs = require('fs');
const path = require('path');

// Configure FRED series and their transformations
const SERIES_CONFIG = {
  // 1. Growth / Real Economy
  GDPC1: { name: "Real GDP YoY", section: "growth", transform: "yoy_quarterly", unit: "%" },
  INDPRO: { name: "Industrial Production YoY", section: "growth", transform: "yoy_monthly", unit: "%" },
  RSXFS: { name: "Retail Sales YoY", section: "growth", transform: "yoy_monthly", unit: "%" },
  PCECC96: { name: "Real Personal Consumption YoY", section: "growth", transform: "yoy_monthly", unit: "%" },
  
  // 2. Labor Market
  UNRATE: { name: "Unemployment Rate", section: "labor", transform: "level", unit: "%" },
  PAYEMS: { name: "Nonfarm Payrolls (3M Avg Net Change)", section: "labor", transform: "monthly_change_3m_avg", unit: "k" },
  ICSA: { name: "Initial Jobless Claims (4W Avg)", section: "labor", transform: "weekly_4w_avg", unit: "k" },
  JTSJOL: { name: "Job Openings", section: "labor", transform: "level_millions", unit: "M" },
  
  // 3. Inflation Pressure
  CPIAUCSL: { name: "CPI Inflation YoY", section: "inflation", transform: "yoy_monthly", unit: "%" },
  CPILFESL: { name: "Core CPI Inflation YoY", section: "inflation", transform: "yoy_monthly", unit: "%" },
  PCEPI: { name: "PCE Inflation YoY", section: "inflation", transform: "yoy_monthly", unit: "%" },
  PCEPILFE: { name: "Core PCE Inflation YoY", section: "inflation", transform: "yoy_monthly", unit: "%" },
  
  // 4. Fed / Rates / Curve
  FEDFUNDS: { name: "Effective Fed Funds Rate", section: "rates", transform: "level", unit: "%" },
  DGS2: { name: "2Y Treasury Yield", section: "rates", transform: "level_daily", unit: "%" },
  DGS10: { name: "10Y Treasury Yield", section: "rates", transform: "level_daily", unit: "%" },
  T10Y2Y: { name: "10Y-2Y Treasury Spread", section: "rates", transform: "level_daily", unit: "%" },
  
  // 5. Liquidity / Money / Banking
  WALCL: { name: "Fed Balance Sheet (Total Assets)", section: "liquidity", transform: "level_trillions", unit: "$T" },
  RESBALNS: { name: "Bank Reserves", section: "liquidity", transform: "level_trillions", unit: "$T" },
  RRPONTSYD: { name: "Overnight Reverse Repo", section: "liquidity", transform: "level_trillions_daily", unit: "$T" },
  WDTGAL: { name: "Treasury General Account", section: "liquidity", transform: "level_billions_weekly", unit: "$B" },
  M2SL: { name: "M2 Money Supply YoY", section: "liquidity", transform: "yoy_monthly", unit: "%" },
  TOTBKCR: { name: "Commercial Bank Credit YoY", section: "liquidity", transform: "yoy_weekly", unit: "%" },
  
  // 6. Credit Stress
  BAMLH0A0HYM2: { name: "High Yield OAS", section: "credit", transform: "level_daily", unit: "%" },
  BAMLC0A0CM: { name: "Investment Grade OAS", section: "credit", transform: "level_daily", unit: "%" },
  STLFSI4: { name: "Financial Stress Index", section: "credit", transform: "level_weekly", unit: "pts" },
  
  // 7. Housing / Rate-Sensitive Economy
  HOUST: { name: "Housing Starts", section: "housing", transform: "level", unit: "k" },
  PERMIT: { name: "Building Permits", section: "housing", transform: "level", unit: "k" },
  MORTGAGE30US: { name: "30Y Fixed Mortgage Rate", section: "housing", transform: "level", unit: "%" },
  CSUSHPINSA: { name: "Case-Shiller Home Price Index YoY", section: "housing", transform: "yoy_monthly", unit: "%" }
};

// Parse raw FRED CSV string
function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/);
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < 2) continue;
    const date = parts[0];
    const valStr = parts[1];
    if (valStr === '.') continue; // Skip missing data represented as '.'
    const value = parseFloat(valStr);
    if (isNaN(value)) continue;
    data.push({ date, value });
  }
  // Sort chronologically just in case
  data.sort((a, b) => new RegExp(a.date) - new RegExp(b.date));
  return data;
}

// Transform raw series according to configuration
function applyTransformation(rawData, transform) {
  const data = [...rawData];
  const result = [];
  
  switch (transform) {
    case "level":
      return data;
      
    case "level_daily":
      // Sample daily data weekly (e.g., keep only Fridays or every 5th business day)
      // This reduces payload size from 260 points/year to ~52 points/year
      for (let i = 0; i < data.length; i++) {
        const d = new Date(data[i].date);
        const day = d.getUTCDay();
        if (day === 5 || i === data.length - 1) { // 5 is Friday
          result.push(data[i]);
        }
      }
      return result;
      
    case "level_weekly":
      return data;
      
    case "level_millions":
      // JTSJOL is in thousands, convert to millions
      return data.map(item => ({ date: item.date, value: item.value / 1000 }));
      
    case "level_trillions":
      // WALCL, RESBALNS are in millions, convert to trillions
      return data.map(item => ({ date: item.date, value: item.value / 1000000 }));
      
    case "level_trillions_daily":
      // RRPONTSYD is daily in millions, convert to trillions and filter weekly
      for (let i = 0; i < data.length; i++) {
        const d = new Date(data[i].date);
        const day = d.getUTCDay();
        if (day === 5 || i === data.length - 1) {
          result.push({ date: data[i].date, value: data[i].value / 1000000 });
        }
      }
      return result;
      
    case "level_billions_weekly":
      // WDTGAL is weekly in millions, convert to billions
      return data.map(item => ({ date: item.date, value: item.value / 1000 }));
      
    case "yoy_quarterly":
      // Compare current quarter with 4 quarters ago
      for (let i = 4; i < data.length; i++) {
        const prev = data[i - 4].value;
        if (prev === 0) continue;
        const yoy = ((data[i].value - prev) / prev) * 100;
        result.push({ date: data[i].date, value: parseFloat(yoy.toFixed(2)) });
      }
      return result;
      
    case "yoy_monthly":
      // Compare current month with 12 months ago
      for (let i = 12; i < data.length; i++) {
        const prev = data[i - 12].value;
        if (prev === 0) continue;
        const yoy = ((data[i].value - prev) / prev) * 100;
        result.push({ date: data[i].date, value: parseFloat(yoy.toFixed(2)) });
      }
      return result;
      
    case "yoy_weekly":
      // Compare current week with 52 weeks ago
      for (let i = 52; i < data.length; i++) {
        const prev = data[i - 52].value;
        if (prev === 0) continue;
        const yoy = ((data[i].value - prev) / prev) * 100;
        result.push({ date: data[i].date, value: parseFloat(yoy.toFixed(2)) });
      }
      return result;
      
    case "monthly_change_3m_avg":
      // Compute 1-month changes
      const changes = [];
      for (let i = 1; i < data.length; i++) {
        changes.push({ date: data[i].date, value: data[i].value - data[i - 1].value });
      }
      // Compute 3-month moving average of these changes
      for (let i = 2; i < changes.length; i++) {
        const avgChange = (changes[i].value + changes[i - 1].value + changes[i - 2].value) / 3;
        result.push({ date: changes[i].date, value: parseFloat(avgChange.toFixed(1)) });
      }
      return result;
      
    case "weekly_4w_avg":
      // Compute 4-week moving average of weekly values
      for (let i = 3; i < data.length; i++) {
        const avg = (data[i].value + data[i - 1].value + data[i - 2].value + data[i - 3].value) / 4;
        result.push({ date: data[i].date, value: parseFloat(avg.toFixed(1)) });
      }
      return result;
      
    default:
      return data;
  }
}

// Compute change metrics (1 month, 3 month, 12 month changes)
function computeChanges(transformedData, originalFrequency) {
  if (transformedData.length === 0) return { change1m: null, change3m: null, change12m: null };
  
  const latest = transformedData[transformedData.length - 1].value;
  
  let index1m = -1;
  let index3m = -1;
  let index12m = -1;
  
  // Approximate index differences based on frequency
  // Growth is quarterly or monthly, rates/spreads are daily/weekly
  // Let's search back in time to find the data point closest to 30, 90, and 365 days ago
  const latestDate = new Date(transformedData[transformedData.length - 1].date);
  
  const oneDay = 24 * 60 * 60 * 1000;
  
  for (let i = transformedData.length - 2; i >= 0; i--) {
    const itemDate = new Date(transformedData[i].date);
    const diffDays = (latestDate - itemDate) / oneDay;
    
    if (index1m === -1 && diffDays >= 28 && diffDays <= 45) {
      index1m = i;
    }
    if (index3m === -1 && diffDays >= 80 && diffDays <= 110) {
      index3m = i;
    }
    if (index12m === -1 && diffDays >= 350 && diffDays <= 380) {
      index12m = i;
    }
  }
  
  // Fallbacks using simple indices if dates are sparse (e.g. GDP is quarterly, so 1m doesn't exist, 3m is 1 index, 12m is 4 indices)
  if (originalFrequency === "quarterly") {
    // GDP YoY
    index3m = transformedData.length - 2; // ~3 months ago (1 quarter)
    index12m = transformedData.length - 5; // ~12 months ago (4 quarters)
    index1m = -1; // Not meaningful
  } else if (originalFrequency === "monthly") {
    if (index1m === -1) index1m = transformedData.length - 2;
    if (index3m === -1) index3m = transformedData.length - 4;
    if (index12m === -1) index12m = transformedData.length - 13;
  } else if (originalFrequency === "weekly") {
    if (index1m === -1) index1m = transformedData.length - 5;
    if (index3m === -1) index3m = transformedData.length - 14;
    if (index12m === -1) index12m = transformedData.length - 53;
  } else if (originalFrequency === "daily") {
    // Since we filtered to weekly
    if (index1m === -1) index1m = transformedData.length - 5;
    if (index3m === -1) index3m = transformedData.length - 14;
    if (index12m === -1) index12m = transformedData.length - 53;
  }
  
  const val1m = index1m >= 0 && index1m < transformedData.length ? transformedData[index1m].value : null;
  const val3m = index3m >= 0 && index3m < transformedData.length ? transformedData[index3m].value : null;
  const val12m = index12m >= 0 && index12m < transformedData.length ? transformedData[index12m].value : null;
  
  return {
    change1m: val1m !== null ? parseFloat((latest - val1m).toFixed(2)) : null,
    change3m: val3m !== null ? parseFloat((latest - val3m).toFixed(2)) : null,
    change12m: val12m !== null ? parseFloat((latest - val12m).toFixed(2)) : null
  };
}

// Detect original frequency from the series data
function detectFrequency(rawData) {
  if (rawData.length < 2) return "monthly";
  const d1 = new Date(rawData[rawData.length - 1].date);
  const d2 = new Date(rawData[rawData.length - 2].date);
  const diffDays = (d1 - d2) / (1000 * 60 * 60 * 24);
  
  if (diffDays <= 4) return "daily";
  if (diffDays <= 10) return "weekly";
  if (diffDays <= 45) return "monthly";
  return "quarterly";
}

// Fetch single series with timeout and retry logic
async function fetchWithTimeoutAndRetry(url, options = {}, retries = 3, timeoutMs = 8000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }
      return await response.text();
    } catch (err) {
      clearTimeout(id);
      const isAbort = err.name === 'AbortError';
      const errMsg = isAbort ? `Timeout after ${timeoutMs}ms` : err.message;
      console.warn(`[ATTEMPT ${attempt}/${retries}] Failed to fetch: ${errMsg}`);
      
      if (attempt === retries) {
        throw new Error(`Failed after ${retries} attempts. Last error: ${errMsg}`);
      }
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, attempt * 1500));
    }
  }
}

// Fetch single series
async function fetchSeries(seriesId, forceRefresh = false) {
  const cacheDir = path.join(__dirname, '../cache/fred');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  const cachePath = path.join(cacheDir, `${seriesId}.csv`);
  
  let csvText = '';
  let useCache = false;
  
  if (fs.existsSync(cachePath) && !forceRefresh) {
    const stats = fs.statSync(cachePath);
    const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
    if (ageHours < 24) {
      useCache = true;
    }
  }
  
  if (useCache) {
    console.log(`[CACHE] Using cached CSV for ${seriesId}`);
    csvText = fs.readFileSync(cachePath, 'utf8');
  } else {
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&cosd=2015-01-01`;
    console.log(`[FETCH] Fetching ${seriesId} from FRED...`);
    try {
      csvText = await fetchWithTimeoutAndRetry(url, {}, 3, 10000);
      fs.writeFileSync(cachePath, csvText, 'utf8');
    } catch (err) {
      console.warn(`[WARN] Failed to fetch ${seriesId}: ${err.message}. Trying cache fallback...`);
      if (fs.existsSync(cachePath)) {
        csvText = fs.readFileSync(cachePath, 'utf8');
      } else {
        throw err;
      }
    }
  }
  
  const rawData = parseCsv(csvText);
  if (rawData.length === 0) {
    throw new Error(`Parsed empty data for ${seriesId}`);
  }
  
  const frequency = detectFrequency(rawData);
  const config = SERIES_CONFIG[seriesId];
  const transformed = applyTransformation(rawData, config.transform);
  
  if (transformed.length === 0) {
    throw new Error(`Transformation produced empty data for ${seriesId}`);
  }
  
  const changes = computeChanges(transformed, frequency);
  const latestObj = transformed[transformed.length - 1];
  
  return {
    id: seriesId,
    name: config.name,
    section: config.section,
    unit: config.unit,
    frequency: frequency,
    latest: {
      date: latestObj.date,
      value: latestObj.value
    },
    changes: changes,
    history: transformed // Complete processed history
  };
}

// Generate the final static javascript data file
async function main() {
  const forceRefresh = process.argv.includes('--refresh');
  const compiledData = {
    lastUpdated: new Date().toISOString(),
    series: {}
  };
  
  const errors = [];
  const ids = Object.keys(SERIES_CONFIG);
  
  for (const id of ids) {
    try {
      const result = await fetchSeries(id, forceRefresh);
      compiledData.series[id] = result;
      console.log(`[SUCCESS] Processed ${id} (${result.history.length} data points, latest: ${result.latest.value}${result.unit} on ${result.latest.date})`);
    } catch (err) {
      console.error(`[ERROR] Failed to process ${id}:`, err.message);
      errors.push({ id, error: err.message });
    }
  }
  
  // Write to src/data.js
  const srcDir = path.join(__dirname, '../src');
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }
  
  const dataJsContent = `// Auto-generated US Macro Dashboard Data
// Generated at: ${compiledData.lastUpdated}
export const MACRO_DATA = ${JSON.stringify(compiledData, null, 2)};
`;
  
  fs.writeFileSync(path.join(srcDir, 'data.js'), dataJsContent, 'utf8');
  console.log(`\nWritten compiled data to src/data.js`);
  
  if (errors.length > 0) {
    console.error(`\nCompleted with ${errors.length} errors:`);
    errors.forEach(e => console.error(`- ${e.id}: ${e.error}`));
  } else {
    console.log(`\nAll series compiled successfully!`);
  }
}

main().catch(err => {
  console.error("Fatal error in main script:", err);
  process.exit(1);
});

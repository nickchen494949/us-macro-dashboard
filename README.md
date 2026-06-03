# US Macro Weather Dashboard

A premium, responsive, interactive static dashboard to monitor the US macroeconomic environment. This dashboard tracks real-time and historical trends across growth, labor, inflation, interest rates, banking system liquidity, credit stress, and housing to answer the question:

> **Is the US macroeconomy improving, slowing, overheating, tightening, or breaking?**

---

## Technical Architecture & Implementation
- **Frontend Stack:** Pure, dependency-free HTML5, Canvas, and vanilla ES modules.
- **Styling:** Premium Custom CSS Design with dynamic mesh gradient backdrops, high-DPI canvas charts, and light/dark theme toggles.
- **Interactivity:** Canvas sparklines support real-time cursor hover tracking, displaying values and dates on-demand and restoring defaults when pointer exits.
- **Data Engine:** Downloads public historical CSV files from FRED, processes transformations (e.g. YoY calculations, rolling averages), and compiles them into a static `src/data.js` database.
- **Robust Offline Fallback:** If FRED is unreachable due to rate limits or sandbox network restrictions, a mock generator script reconstructs realistic historical series to ensure a fully functional dashboard locally.

---

## System vs. Evidence View: How to Read the Dashboard

To prevent information overload and show the systemic flow of the economy, the dashboard is divided into two distinct conceptual layers:

### 1. Macro Transmission Map (System View)
The **Macro Transmission Map** represents the **systemic view** of the US economy. It models the causal, step-by-step transmission chain of monetary policy decisions:
* **How it works:** It starts with **Fed Policy** (the policy impulse), flows through **Financial Conditions** and **Credit/Liquidity** (the market channels), impacts the **Rate-sensitive Economy** (e.g., Housing), spreads to the broader **Real Economy**, and finally registers in the **Labor Market** (the lagging confirmation), which feeds back into **Inflation Feedback** and drives the **Fed Reaction** response.
* **Purpose:** It answers the question: *"Where is the US economic economic machine stuck or breaking?"* rather than just presenting disjointed metrics. It shows which parts of the transmission system are restrictive (red/orange) and which remain resilient (green).

### 2. Indicator Cards (Evidence View)
The **Supporting Indicator Evidence** cards represent the **factual/evidence view** of the dashboard.
* **How it works:** Located beneath the Transmission Map, these cards contain the actual raw data (e.g., Sahm Rule calculations, mortgage rate percentages, balance sheet numbers, jobless claims) and high-DPI interactive sparklines.
* **Purpose:** They act as the source of truth, providing historical verification and momentum indicators (1M, 3M, 12M trends) that prove the status of the nodes in the Transmission Map above. Users can click on any indicator in the Transmission Map to scroll directly to its evidence card.

---

## Section Explanations & FRED Series IDs

### 1. Growth / Real Economy
Tracks whether output and consumption are expanding or contractionary.
- **Real GDP YoY (`GDPC1`):** Total value of goods and services produced, adjusted for inflation. Tells us if the economy is actively expanding.
- **Industrial Production YoY (`INDPRO`):** Output of manufacturing, mining, and utilities. A highly cyclical indicator of hard economy activity.
- **Retail Sales YoY (`RSXFS`):** Consumer spending at retail stores, indicating household demand and consumption momentum.
- **Real Personal Consumption YoY (`PCECC96`):** Inflation-adjusted consumer spending, which accounts for ~70% of total US GDP.

### 2. Labor Market
Indicates whether employment is tight, moderating, or beginning to crack.
- **Unemployment Rate (`UNRATE`):** The percentage of the active labor force without a job. Key input for recession indicators like the Sahm Rule.
- **Nonfarm Payrolls Net Change (`PAYEMS`):** Rolling 3-month net job additions. Shows job creation velocity.
- **Initial Jobless Claims (`ICSA`):** Rolling 4-week average of weekly initial filings for unemployment benefits. A reliable leading indicator of labor layoffs.
- **Job Openings (`JTSJOL`):** Total unfilled jobs, showing employer demand for labor.

### 3. Inflation Pressure
Monitors price trends relative to the Federal Reserve's symmetric 2.0% target.
- **CPI Inflation YoY (`CPIAUCSL`):** Consumer Price Index tracking overall retail price changes.
- **Core CPI Inflation YoY (`CPILFESL`):** CPI excluding volatile food and energy costs to isolate underlying pricing trends.
- **PCE Inflation YoY (`PCEPI`):** Personal Consumption Expenditures price index. The Fed's preferred inflation metric.
- **Core PCE Inflation YoY (`PCEPILFE`):** PCE index excluding food and energy. Used to guide policy decisions.

### 4. Fed / Rates / Curve
Evaluates interest rates policy stance and yield-curve-based recession pressure.
- **Effective Fed Funds Rate (`FEDFUNDS`):** The policy rate set by the Fed. Dictates overall credit tightness.
- **2Y Treasury Yield (`DGS2`):** Reflects market expectations for short-term Fed policy over the next two years.
- **10Y Treasury Yield (`DGS10`):** Benchmark rate for long-term borrowing, mortgages, and economic growth expectations.
- **10Y minus 2Y Spread (`T10Y2Y`):** Yield curve spread. An inverted curve (spread < 0) has preceded every US recession for 50 years.

### 5. Liquidity / Money / Banking
Tracks the quantity of reserves and financial liquidity circulating in the system.
- **Fed Balance Sheet (`WALCL`):** Total assets held by the Fed. Declining assets represent Quantitative Tightening (QT).
- **Bank Reserves (`RESBALNS`):** Cash reserves held by commercial banks at the Fed, indicating banking system safety cushions.
- **Overnight Reverse Repo (`RRPONTSYD`):** Excess cash parked by money market funds at the Fed, acting as a latent liquidity buffer.
- **Treasury General Account (`WDTGAL`):** The government's operating cash account. Increases drain reserves; decreases inject liquidity.
- **M2 Money Supply YoY (`M2SL`):** Cash, deposits, and money market funds. Contractions represent shrinking monetary liquidity.
- **Commercial Bank Credit YoY (`TOTBKCR`):** Outstanding loans and securities held by commercial banks. Falling credit indicates bank credit crunch.

### 6. Credit Stress
Signals banking risk, corporate defaults, or credit market dysfunction.
- **High Yield Option-Adjusted Spread (`BAMLH0A0HYM2`):** Yield markup required for junk bonds over risk-free Treasuries. Spikes indicate default fears.
- **Investment Grade OAS (`BAMLC0A0CM`):** Spread required for high-quality corporate bonds.
- **Financial Stress Index (`STLFSI4`):** St. Louis Fed Stress Index combining 18 market interest rate spreads and equity indicators.

### 7. Housing / Rate-Sensitive Economy
Tracks interest-rate sensitivity channels that amplify macroeconomic cycles.
- **Housing Starts (`HOUST`):** Number of new residential construction projects started.
- **Building Permits (`PERMIT`):** Approved permits for new construction, acting as a leading indicator for housing supply.
- **Mortgage Rate 30Y (`MORTGAGE30US`):** Average contract rate for 30-year fixed mortgages. High rates depress housing demand.
- **Case-Shiller Home Price Index YoY (`CSUSHPINSA`):** National home price appreciation rate.

---

## Macro Weather Status Logic

The dashboard uses simple, transparent rules (no black boxes) to calculate economic pillars and overall weather states:

1. **Growth Weather:**
   - **Contracting** if Real GDP YoY < 0.
   - **Slowing** if GDP YoY < 2.0% or Industrial Production momentum is negative.
   - **Expanding** otherwise.

2. **Labor Weather:**
   - **Cracking** if Unemployment Rate rises $\ge$ 0.5pp from its 12M low (Sahm Rule), or Job additions are negative.
   - **Cooling** if Unemployment rises slightly ($\ge$ 0.25pp) or Net Jobs added average drops < 120k.
   - **Strong** otherwise.

3. **Inflation Weather:**
   - **Reaccelerating** if CPI YoY is high (>3.5%) and trend over the last 3 months is rising.
   - **Sticky** if CPI YoY is > 2.8% and flat.
   - **Cooling** if CPI is approaching or below 2.8%.

4. **Fed/Rates Weather:**
   - **Restrictive** if Effective FFR is high (>3.0%) or Yield Curve is inverted (T10Y2Y < 0).
   - **Tightening** if policy rate has risen in the last 3 months.
   - **Easing** if policy rate is actively declining.

5. **Credit/Liquidity Weather:**
   - **Stress** if High Yield corporate spreads exceed 5.5% or Stress Index > 1.2.
   - **Tightening** if spreads creep up (> 4.2%) or bank reserves fall below $3.0T.
   - **Calm** otherwise.

### Master Macro Weather Matrix
- **Recession Risk:** Labor is *Cracking* OR (Growth is *Contracting* AND Labor is *Cooling*).
- **Credit Stress:** Credit/Liquidity is in *Stress* or junk spreads exceed 5.0%.
- **Inflation Problem:** Inflation is *Reaccelerating* or *Sticky* while rates are *Tightening*.
- **Slowdown:** Growth is *Slowing* or Labor is *Cooling* or curve is inverted under restrictive rates.
- **Goldilocks:** Growth is *Expanding*, Labor is *Strong*, and Inflation is *Cooling*.

---

## How to Run Locally

### 1. Pre-requisites
Make sure you have [Node.js](https://nodejs.org) installed.

### 2. Install dependencies (Dev server only)
Run `npm install` inside the project folder. This downloads the basic dev server if needed.

### 3. Generate Mock Fallback Data (If Offline)
If you don't have internet access or want to bypass FRED rate limits, generate the offline cache files:
```bash
npm run mock
```
This writes 15 CSV datasets matching historical interest rate shapes to `cache/fred/`.

### 4. Fetch & Compile Data
Compile the cached CSVs and generate the final dashboard JSON state:
```bash
npm run fetch
```
This generates `src/data.js` containing processed time-series histories and rate changes.

### 5. Launch Local Dev Server
Start a lightweight local server to browse the premium UI:
```bash
npm run dev
```
Then visit `http://localhost:8080` in your browser.

---

## How to Deploy to GitHub Pages

Since this dashboard compile is a **100% static project** (HTML, CSS, JS), it can be deployed for free to GitHub Pages:

1. Push this project to your GitHub repository (e.g. `github.com/your-username/us-macro-dashboard`).
2. Go to **Settings** -> **Pages** in your GitHub repository sidebar.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose the `main` or `master` branch and folder `/ (root)`, then click **Save**.
5. Your dashboard will be live at `https://your-username.github.io/us-macro-dashboard/` in a few minutes!

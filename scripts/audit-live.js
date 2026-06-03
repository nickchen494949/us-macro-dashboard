const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const url = 'https://nickchen494949.github.io/us-macro-dashboard/';
  const reportsDir = path.join(__dirname, '..', '.ai', 'reports');
  
  // Ensure reports directory exists
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  console.log(`Starting live QA audit for: ${url}`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const errors = [];
  
  // Listen for uncaught page errors
  page.on('pageerror', (exception) => {
    console.error(`Page error: ${exception.message}`);
    errors.push(`Console JS Error: ${exception.message}`);
  });

  // Listen for console error messages
  page.on('console', (message) => {
    if (message.type() === 'error') {
      console.error(`Console error: ${message.text()}`);
      errors.push(`Console error: ${message.text()}`);
    }
  });

  try {
    // 1. Navigate to the live page
    console.log('Navigating to live page...');
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Check HTTP status code
    if (!response) {
      errors.push('Failed to load page: response is null');
    } else {
      const status = response.status();
      console.log(`Response HTTP Status: ${status}`);
      if (status === 404) {
        errors.push(`Page returned 404 Not Found`);
      } else if (status >= 400) {
        errors.push(`HTTP Error Status: ${status}`);
      }
    }

    // 2. Wait for network idle + 3 seconds
    console.log('Waiting 3 seconds for charts/data to settle...');
    await page.waitForTimeout(3000);

    // 3. Extract page title
    const pageTitle = await page.title();
    console.log(`Page Title: "${pageTitle}"`);

    // 4. Extract all visible page text and check for main title
    const pageText = await page.innerText('body');
    
    // Save page text
    const textFilePath = path.join(reportsDir, 'latest-page-text.txt');
    fs.writeFileSync(textFilePath, pageText, 'utf8');
    console.log(`Page text saved to: ${textFilePath}`);

    if (!pageText.includes('US Macro Weather')) {
      errors.push('Main title "US Macro Weather" not found in page text');
    }

    // 5. Fail if page is blank or shows loading
    if (!pageText || pageText.trim().length === 0) {
      errors.push('Page content is blank');
    }

    if (pageText.includes('Loading macroeconomic indicators') || pageText.includes('Generating Macro Transmission System Map')) {
      errors.push('Page still shows Loading state');
    }

    // 6. Count macro indicator cards on page
    const cards = page.locator('.macro-card');
    const cardCount = await cards.count();
    console.log(`Found ${cardCount} macro indicator cards`);
    if (cardCount === 0) {
      errors.push('No macro indicator cards (.macro-card) were found on the page');
    }

    // 7. Extract weatherState from #weather-master-container
    const weatherContainer = page.locator('#weather-master-container');
    let weatherState = null;
    if (await weatherContainer.count() > 0) {
      const badgeText = await weatherContainer.innerText();
      console.log(`Weather badge text: "${badgeText}"`);
      const match = badgeText.match(/US Macro Weather:\s*(.+)$/i);
      if (match) {
        weatherState = match[1].trim();
      }
      if (!weatherState || weatherState.toLowerCase().includes('checking')) {
        errors.push('Weather state is not resolved or is still "Checking"');
      }
    } else {
      errors.push('Weather master container (#weather-master-container) not found');
    }

    // 8. Save full-page screenshot
    const screenshotPath = path.join(reportsDir, 'latest-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to: ${screenshotPath}`);

    // Determine pass status
    const pass = errors.length === 0;

    // 9. Save structured JSON result
    const auditResult = {
      url,
      timestamp: new Date().toISOString(),
      pass,
      errors,
      cardCount,
      pageTitle,
      weatherState
    };

    const auditJsonPath = path.join(reportsDir, 'latest-audit.json');
    fs.writeFileSync(auditJsonPath, JSON.stringify(auditResult, null, 2), 'utf8');
    console.log(`Audit report saved to: ${auditJsonPath}`);

    // Close browser
    await context.close();
    await browser.close();

    // 10. Exit code 0 if pass, 1 if fail
    if (pass) {
      console.log('QA Audit PASSED!');
      process.exit(0);
    } else {
      console.error('QA Audit FAILED with the following errors:', errors);
      process.exit(1);
    }

  } catch (error) {
    console.error('An error occurred during the audit execution:', error);
    errors.push(`Execution error: ${error.message}`);
    
    // Save whatever status we have
    const auditResult = {
      url,
      timestamp: new Date().toISOString(),
      pass: false,
      errors,
      cardCount: 0,
      pageTitle: 'Error occurred',
      weatherState: null
    };
    
    const auditJsonPath = path.join(reportsDir, 'latest-audit.json');
    fs.writeFileSync(auditJsonPath, JSON.stringify(auditResult, null, 2), 'utf8');
    
    await browser.close();
    process.exit(1);
  }
})();

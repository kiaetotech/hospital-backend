const { test, expect } = require('@playwright/test');

test('Patient can search hospitals', async ({ page }) => {
  // Go to your website
  await page.goto('https://hospital-frontend-kiaeto.vercel.app');
  
  // Click on Hospitals
  await page.click('text=Hospitals');
  
  // Wait for results
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/hospital-search.png' });
  
  // Check if results appear
  const results = await page.textContent('body');
  console.log('Page loaded:', results.substring(0, 200));
});

test('Patient can view hospital details', async ({ page }) => {
  await page.goto('https://hospital-frontend-kiaeto.vercel.app/hospitals');
  await page.waitForTimeout(3000);
  
  // Click first hospital
  const firstHospital = await page.$('[class*="hospital"]');
  if (firstHospital) {
    await firstHospital.click();
    await page.screenshot({ path: 'tests/screenshots/hospital-detail.png' });
  }
});
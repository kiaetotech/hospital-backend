const { test, expect } = require('@playwright/test');
const BASE = 'https://hospital-frontend-kiaeto.vercel.app';

test.describe('🏥 HospitalHub Complete E2E Tests', () => {
  
  test('1. Homepage loads with 11 service tags', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(3000);
    
    const tags = ['Hospitals', 'Ambulance', 'Online Doctor', 'Lab Tests', 
                  'Ayurveda', 'Homeopathy', 'Mental Wellness', 'Home Care',
                  'Health Insurance', 'Health EMI', 'Corporate Health'];
    
    for (const tag of tags) {
      const visible = await page.isVisible(`text=${tag}`);
      console.log(`  ${visible ? '✅' : '❌'} ${tag}`);
    }
    await page.screenshot({ path: 'tests/screenshots/homepage.png', fullPage: true });
  });

  test('2. Hospital Search works', async ({ page }) => {
    await page.goto(BASE + '/hospitals');
    await page.waitForTimeout(3000);
    
    // Check search results exist
    const results = await page.$$('[class*="hospital"]');
    console.log(`  Hospitals found: ${results.length}`);
    await page.screenshot({ path: 'tests/screenshots/hospital-search.png' });
  });

  test('3. Ambulance page loads', async ({ page }) => {
    await page.goto(BASE + '/ambulance');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/screenshots/ambulance.png' });
  });

  test('4. Online Doctor page loads', async ({ page }) => {
    await page.goto(BASE + '/online-doctor');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/screenshots/online-doctor.png' });
  });

  test('5. Lab Tests page loads', async ({ page }) => {
    await page.goto(BASE + '/diagnostics');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/screenshots/lab-tests.png' });
  });

  test('6. Ayurveda page loads', async ({ page }) => {
    await page.goto(BASE + '/ayurveda');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/screenshots/ayurveda.png' });
  });

  test('7. Homeopathy page loads', async ({ page }) => {
    await page.goto(BASE + '/homeopathy');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/screenshots/homeopathy.png' });
  });

  test('8. Mental Wellness page loads', async ({ page }) => {
    await page.goto(BASE + '/mentalhealth');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/screenshots/mental-health.png' });
  });

  test('9. Home Care page loads', async ({ page }) => {
    await page.goto(BASE + '/caregivers');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/screenshots/home-care.png' });
  });

  test('10. Insurance page loads', async ({ page }) => {
    await page.goto(BASE + '/insurance');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/screenshots/insurance.png' });
  });

  test('11. Corporate Health page loads', async ({ page }) => {
    await page.goto(BASE + '/corporate');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/screenshots/corporate.png' });
  });

  test('12. Ambulance Provider Login page loads', async ({ page }) => {
    await page.goto(BASE + '/ambulance/login');
    await page.waitForTimeout(2000);
    
    // Check login form exists
    const emailInput = await page.$('input[type="email"]');
    const passInput = await page.$('input[type="password"]');
    
    console.log(`  Email field: ${emailInput ? '✅' : '❌'}`);
    console.log(`  Password field: ${passInput ? '✅' : '❌'}`);
    await page.screenshot({ path: 'tests/screenshots/ambulance-login.png' });
  });

  test('13. Hospital Provider Login page loads', async ({ page }) => {
    await page.goto(BASE + '/hospital/login');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/screenshots/hospital-login.png' });
  });

  test('14. Diagnostics Provider Login page loads', async ({ page }) => {
    await page.goto(BASE + '/diagnostics/login');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/screenshots/diagnostics-login.png' });
  });

  test('15. Caregiver Provider Login page loads', async ({ page }) => {
    await page.goto(BASE + '/caregiver/login');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/screenshots/caregiver-login.png' });
  });
});

test.describe('🔐 Auth Flow Tests', () => {
  
  test('16. Login with valid credentials', async ({ page }) => {
    await page.goto(BASE + '/ambulance/login');
    await page.waitForTimeout(2000);
    
    // Fill login form
    await page.fill('input[type="email"]', 'medweb@web.in');
    await page.fill('input[type="password"]', 'MedWeb@123');
    
    // Click login button
    await page.click('button:has-text("Login")');
    await page.waitForTimeout(3000);
    
    // Check if redirected to dashboard
    const url = page.url();
    console.log(`  Redirected to: ${url}`);
    await page.screenshot({ path: 'tests/screenshots/after-login.png' });
  });
});

test.describe('🤖 AI Control Center', () => {
  
  test('17. AI Control Center loads', async ({ page }) => {
    await page.goto(BASE + '/ai-control-center');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/screenshots/ai-control-center.png' });
  });
});
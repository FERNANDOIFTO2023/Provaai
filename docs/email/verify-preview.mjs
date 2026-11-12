// PLAYWRIGHT_MODULE can point to an installed playwright-core/index.mjs.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
try {
  const page = await browser.newPage();
  for (const width of [320, 375, 600, 900]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto(new URL('./preview.html', import.meta.url).href);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow at ${width}px`);
    assert.equal(await page.locator('.email-code').innerText(), '482619');
    assert.equal(await page.locator('.mascot-motion').evaluate(img => img.complete && img.naturalWidth === 192), true);
    if (width === 375 || width === 900) {
      await page.screenshot({ path: fileURLToPath(new URL(`./preview-${width}.png`, import.meta.url)), fullPage: true });
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.mascot-motion').isVisible(), false);
  assert.equal(await page.locator('.mascot-still').isVisible(), true);
  await page.route('**/public/email/*', route => route.abort());
  await page.reload();
  assert.equal(await page.locator('.email-code').innerText(), '482619');
  assert.equal(await page.locator('h1').isVisible(), true);
  console.log('PASS: 320/375/600/900px, embedded image preview, reduced motion, code readable with images blocked.');
} finally {
  await browser.close();
}

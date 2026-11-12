// PLAYWRIGHT_MODULE can point to an installed playwright-core/index.mjs.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
try {
  const page = await browser.newPage();
  for (const width of [320, 375, 600, 900]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(new URL('./preview.html', import.meta.url).href);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow at ${width}px`);
    assert.equal(await page.locator('.email-code').innerText(), '482619');
    assert.equal(await page.locator('img, svg, script').count(), 0);
    assert.equal(await page.locator('h1').isVisible(), true);
    if (width === 375 || width === 900) {
      await page.screenshot({ path: fileURLToPath(new URL(`./preview-${width}.png`, import.meta.url)), fullPage: true });
    }
  }
  console.log('PASS: 320/375/600/900px, selectable code, no images, scripts or horizontal overflow.');
} finally {
  await browser.close();
}

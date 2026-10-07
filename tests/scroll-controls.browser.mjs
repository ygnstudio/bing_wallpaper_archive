/** Run against a built site. Supply BASE_URL and optional Playwright module/browser paths. */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser = await chromium.launch({
  headless:true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {})
});
try {
  for (const mobile of [true,false]) {
    const page = await browser.newPage({ viewport:{ width:mobile ? 390 : 1440,height:844 }, isMobile:mobile,hasTouch:mobile });
    await page.goto(process.env.BASE_URL || 'http://localhost:4173/');
    await page.locator('.card').first().waitFor();
    await page.evaluate(() => { window.scrollProbe=setInterval(() => window.scrollBy(0,8),50); });
    // The frosted surfaces must fade directly; fading their parent creates an extra backdrop group.
    await page.waitForFunction(() => ['.nav-leading','.dock-items'].every(selector =>
      +getComputedStyle(document.querySelector(selector)).opacity < .01),null,{ timeout:2000 });
    for (const selector of ['.topnav','.action-dock']) {
      assert.equal(await page.locator(selector).evaluate(el => getComputedStyle(el).opacity),'1');
    }
    assert.equal(await page.locator('#mobile-search').evaluate(el => getComputedStyle(el).pointerEvents),'none');
    await page.evaluate(() => clearInterval(window.scrollProbe));
    await page.waitForFunction(() => ['.nav-leading','.dock-items'].every(selector =>
      getComputedStyle(document.querySelector(selector)).opacity === '1'));
    assert.match(await page.locator('.dock-items').evaluate(el => getComputedStyle(el).backdropFilter),/blur\(/);
    // Reverse a reveal mid-flight, as with repeated short swipes.
    await page.evaluate(() => window.scrollBy(0,30));
    await page.waitForFunction(() => document.documentElement.classList.contains('controls-scrolling'));
    await page.waitForFunction(() => !document.documentElement.classList.contains('controls-scrolling'));
    await page.evaluate(() => window.scrollBy(0,30));
    await page.waitForFunction(() => +getComputedStyle(document.querySelector('.dock-items')).opacity < .01);
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.dock-items')).opacity === '1');
    await page.emulateMedia({ reducedMotion:'reduce' });
    assert.equal(await page.locator('.dock-items').evaluate(el => getComputedStyle(el).transitionDuration),'0s');
    console.log(`PASS ${mobile ? 'mobile' : 'desktop'}: direct surface fade, idle recovery, repeated swipes, keyboard and reduced motion`);
    await page.close();
  }
} finally {
  await browser.close();
}

import assert from 'node:assert/strict';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.LINEYKA_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true });
const errors = [];
const page = await browser.newPage();
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const url = 'http://127.0.0.1:4173';
const report = { viewports: [], interactions: [] };
await mkdir('screenshots', { recursive: true });
for (const width of [941, 1440, 390, 320, 375, 768, 1024]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(url);
  await page.evaluate(async () => {
    document.querySelectorAll('img').forEach((img) => img.loading = 'eager');
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode()));
  });
  const state = await page.evaluate(() => ({
    width: innerWidth, documentWidth: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
    images: [...document.images].every((image) => image.complete && image.naturalWidth > 0),
    route: !!document.getElementById('route-path').getAttribute('d'),
    sections: [...document.querySelectorAll('.section')].map((el) => ({ id: el.id, height: Math.round(el.getBoundingClientRect().height) }))
  }));
  assert.ok(state.documentWidth <= width, `Overflow at ${width}: ${state.documentWidth}`);
  assert.ok(state.images && state.route);
  if ([941, 1440, 390, 320].includes(width)) await page.screenshot({ path: `screenshots/desktop-${width}.png`.replace('desktop-3', 'mobile-3'), fullPage: true });
  report.viewports.push(state);
}
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(url);
await page.locator('.menu-toggle').click();
assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
await page.keyboard.press('Escape');
assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
await page.locator('.menu-toggle').click();
await page.locator('#mobile-nav a[href="#services"]').click();
assert.equal(await page.locator('#mobile-nav').isVisible(), false);
report.interactions.push('Mobile menu opens, Escape closes it and links navigate.');
await page.locator('.faq-question').nth(0).click();
assert.equal(await page.locator('#answer-0').isVisible(), true);
await page.locator('.faq-question').nth(1).focus();
await page.keyboard.press('Enter');
assert.equal(await page.locator('#answer-0').isVisible(), false);
assert.equal(await page.locator('#answer-1').isVisible(), true);
await page.keyboard.press('Space');
assert.equal(await page.locator('#answer-1').isVisible(), false);
report.interactions.push('FAQ supports pointer and keyboard, maintains aria-expanded and closes other answers.');
await page.locator('.submit-button').click();
assert.equal(await page.locator('[aria-invalid=true]').count(), 2);
assert.equal(await page.locator('#name').evaluate((el) => el === document.activeElement), true);
await page.locator('#name').fill('Тест');
await page.locator('#phone').fill('123');
await page.locator('.submit-button').click();
assert.equal(await page.locator('#phone').getAttribute('aria-invalid'), 'true');
await page.locator('#phone').fill('+7 (900) 000-00-00');
await page.locator('#service').selectOption({ label: 'Склады' });
const outbound = [];
page.on('request', (request) => { if (request.method() === 'POST') outbound.push(request.url()); });
await page.locator('.submit-button').click();
assert.equal(await page.locator('.submit-button').isDisabled(), true);
await page.waitForFunction(() => document.getElementById('form-status').textContent.includes('заявка не отправлена'));
assert.equal(outbound.length, 0);
assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
report.interactions.push('Form validates name and phone, focuses errors, displays loading and explicit demo result; zero POST requests and zero browser storage.');
await page.emulateMedia({ reducedMotion: 'reduce' });
assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
report.interactions.push('Reduced motion disables smooth scrolling.');
// Exercise the opt-in integration using an intercepted endpoint only.
// No actual service receives the test values.
const live = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const liveConfig = (await readFile('content.js', 'utf8'))
  .replace('demoMode: true', 'demoMode: false')
  .replace("formEndpoint: ''", "formEndpoint: 'https://lineyka.test.invalid/request'")
  .replace("privacyUrl: ''", "privacyUrl: 'https://lineyka.test.invalid/privacy'");
await live.route('**/content.js', (route) => route.fulfill({ contentType: 'application/javascript', body: liveConfig }));
const received = [];
let failRequest = false;
await live.route('https://lineyka.test.invalid/request', (route) => {
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'Content-Type' };
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  received.push(route.request().postDataJSON());
  return route.fulfill({ status: failRequest ? 503 : 200, headers, contentType: 'application/json', body: '{}' });
});
await live.goto(url);
assert.equal(await live.locator('#demo-notice').isVisible(), false);
assert.equal(await live.locator('#consent').isChecked(), false);
await live.locator('#name').fill('Тест'); await live.locator('#phone').fill('+7 (900) 000-00-00');
await live.locator('.submit-button').click();
assert.match(await live.locator('#form-status').textContent(), /необходимо согласие/);
assert.equal(received.length, 0);
await live.locator('#consent').check();
await live.locator('.submit-button').click();
await live.waitForFunction(() => document.getElementById('form-status').textContent.includes('Заявка отправлена'));
assert.equal(received.length, 1); assert.equal(received[0].consent, true);
assert.equal(await live.locator('#name').inputValue(), '');
assert.equal(await live.locator('#consent').isChecked(), false);
failRequest = true;
await live.locator('#name').fill('Тест'); await live.locator('#phone').fill('+7 (900) 000-00-00');
await live.locator('#consent').check(); await live.locator('.submit-button').click();
await live.waitForFunction(() => document.getElementById('form-status').textContent.includes('Не удалось отправить'));
assert.equal(await live.locator('.submit-button').isDisabled(), false);
assert.equal(await live.locator('#name').inputValue(), 'Тест');
report.interactions.push('Opt-in HTTPS form: unchecked consent blocks POST; intercepted 200 resets the form; intercepted 503 reports an error and preserves fields. No real external service receives data.');
await live.close();
assert.deepEqual(errors, []);
report.errors = errors;
await writeFile('screenshots/verification.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();

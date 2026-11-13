import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.LINEYKA_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true });
const errors = [];
const page = await browser.newPage();
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const url = process.env.LINEYKA_URL || 'http://127.0.0.1:4173';
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
    heroHeight: Math.round(document.querySelector('.hero-area').getBoundingClientRect().height),
    images: [...document.images].every((image) => image.complete && image.naturalWidth > 0),
    route: !!document.getElementById('route-path').getAttribute('d'),
    sections: [...document.querySelectorAll('.section')].map((el) => ({ id: el.id, height: Math.round(el.getBoundingClientRect().height) }))
  }));
  assert.ok(state.documentWidth <= width, `Overflow at ${width}: ${state.documentWidth}`);
  assert.ok(state.images && state.route);
  if (width >= 768) state.sections.forEach((section) => assert.ok(Math.abs(section.height - state.heroHeight) <= 1, `${section.id} must match Hero at ${width}px`));
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
await page.emulateMedia({ reducedMotion: 'reduce' });
assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
assert.equal(await page.locator('form').count(), 0);
assert.equal(await page.getByText(/^(Обсудить задачу|Отправить заявку)/).count(), 0);

await page.locator('.menu-toggle').click();
await page.locator('#mobile-nav a[href="#contact"]').click();
await page.waitForURL('**/#contact');
const footer = page.locator('footer#contact');
assert.match(await footer.locator('address').innerText(), /ИП Тегаев Асланбек Викторович/);
assert.match(await footer.locator('address').innerText(), /Карла Маркса, 2\/1/);
assert.equal(await footer.getByRole('link', { name: '8-926-202-75-15' }).getAttribute('href'), 'tel:+79262027515');
assert.equal(await footer.getByRole('link', { name: 'aslan.tegaev@yandex.ru' }).getAttribute('href'), 'mailto:aslan.tegaev@yandex.ru');
report.interactions.push('Contacts navigation reaches the footer, with no form or application buttons.');

const dialog = page.locator('#service-dialog');
const descriptions = [['Склады', /приёмки, комплектации/], ['Производство', /операторов линий/], ['Логистика', /сортировки и подготовки грузов/]];
for (const width of [320, 1440]) {
  await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
  for (const [index, [name, description]] of descriptions.entries()) {
    const button = page.getByRole('button', { name, exact: true });
    if (index === 0) await button.click();
    else { await button.focus(); await page.keyboard.press(index === 1 ? 'Enter' : 'Space'); }

    await dialog.waitFor({ state: 'visible' });
    assert.equal(await dialog.evaluate((el) => el.matches(':modal')), true);
    assert.equal(await dialog.getByRole('heading', { name, exact: true }).count(), 1);
    assert.match(await dialog.locator('#service-dialog-description').textContent(), description);
    const box = await dialog.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width);
    assert.ok(box.y >= 0 && box.y + box.height <= page.viewportSize().height);
    const close = dialog.getByRole('button', { name: 'Закрыть описание услуги' });
    assert.equal(await close.evaluate((el) => el === document.activeElement), true);

    if (index === 0) {
      await page.screenshot({ path: `screenshots/service-dialog-${width}.png` });
      await close.click();
    } else if (index === 1) await page.keyboard.press('Escape');
    else await page.mouse.click(4, 4);

    await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction((service) => document.activeElement?.dataset.service === service, name);
  }
}
report.interactions.push('All three dialogs open with the matching descriptions and close by button, Escape or backdrop. Focus returns to the service button.');
assert.deepEqual(errors, []);
report.errors = errors;
await writeFile('screenshots/verification.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();

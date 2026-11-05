// Real-browser contract: navigation, reversible disclosure, and preserved reading content.
// Removing the enhancement, its observer, or its disclosure state must fail this test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const root = path.resolve(__dirname, '..');
const output = path.resolve(root, '../../outputs/design-10/reading');
const widths = (process.env.DESIGN_WIDTHS || '320,390,720,884,1280,1440').split(',').map(Number);
const schemes = (process.env.DESIGN_SCHEMES || 'light,dark').split(',');
const measurements = [];
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp' };
const settle = page => page.evaluate(async () => {
  await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1000))]);
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
});

async function run(browser, baseUrl, width, scheme) {
  const label = `${width}px ${scheme}`;
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme },
    { name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(theme => localStorage.setItem('saju_theme', theme), scheme);
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.type('#inBirth', '19890319');
    await page.type('#inTime', '1430');
    await page.evaluate(() => { if (!document.querySelector('#segGender .active')) document.querySelector('#segGender [data-val="M"]').click(); }); await page.click('#calcBtn');
    await page.waitForSelector('#view-result:not([hidden]) .pillar-block .han');
    await page.$eval('#tab-fortune', element => element.click());
    await page.waitForSelector('#view-fortune:not([hidden]) .unified-reading');
    await settle(page);
    const before = await page.evaluate(() => ({
      paragraphs: [...document.querySelectorAll('.reading-prose p, .reading-month p')].map(p => p.textContent),
      height: document.querySelector('.unified-reading').getBoundingClientRect().height,
      months: [...document.querySelectorAll('.reading-month__label')].map(p => p.textContent)
    }));
    if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `${width}-${scheme}-before.png`) });
    const enhancement = path.join(root, 'reading-navigation.js');
    if (fs.existsSync(enhancement)) await page.addScriptTag({ path: enhancement });
    await settle(page);
    assert.equal(await page.$$eval('.reading-navigation', nodes => nodes.length), 1,
      `${label}: the reading must expose one generated table of contents`);
    const after = await page.evaluate(() => {
      const article = document.querySelector('.unified-reading');
      const summaries = [...article.querySelectorAll('.reading-brief')];
      const links = [...document.querySelectorAll('.reading-navigation a')];
      return {
        paragraphs: [...article.querySelectorAll('.reading-prose p, .reading-month p')].map(p => p.textContent),
        height: article.getBoundingClientRect().height,
        order: [...article.querySelectorAll(':scope > [data-reading-section]')].map(s => s.dataset.readingSection),
        months: [...article.querySelectorAll('.reading-month__label')].map(p => p.textContent),
        openMonths: [...article.querySelectorAll('.reading-month details[open]')].map(d => Number(d.closest('.reading-month').querySelector('.reading-month__label').textContent.replace(/\D/g, ''))),
        currentMonth: new Date().getMonth() + 1,
        summaries: summaries.map(p => p.textContent.trim()),
        links: links.map(a => ({ text: a.textContent.trim(), target: !!document.getElementById(a.hash.slice(1)) })),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        prose: [...article.querySelectorAll('.reading-prose')].map(p => ({ font: parseFloat(getComputedStyle(p).fontSize), line: parseFloat(getComputedStyle(p).lineHeight) / parseFloat(getComputedStyle(p).fontSize) })),
        active: links.filter(a => a.getAttribute('aria-current') === 'location').length,
        navPosition: getComputedStyle(document.querySelector('.reading-navigation')).position,
        navLeft: document.querySelector('.reading-navigation').getBoundingClientRect().left,
        articleRight: article.getBoundingClientRect().right,
        controls: [...article.querySelectorAll('summary')].map(s => s.getBoundingClientRect().height)
      };
    });
    assert.deepEqual(after.paragraphs, before.paragraphs, `${label}: every source paragraph remains in DOM and in its original order`);
    assert.deepEqual(after.months, before.months, `${label}: all twelve month labels remain chronological`);
    assert.deepEqual(after.order, ['year', 'months', 'daeun'], `${label}: annual → months → daeun order remains`);
    assert.deepEqual(after.openMonths, [after.currentMonth], `${label}: only this month starts open`);
    assert.ok(after.summaries.length >= 7 && after.summaries.every(Boolean), `${label}: sections offer compact source-based summaries`);
    assert.ok(after.links.length >= 7 && after.links.every(a => a.text && a.target), `${label}: table of contents links resolve to real sections`);
    assert.ok(after.overflow <= 1, `${label}: document overflows ${after.overflow}px`);
    assert.ok(after.prose.every(p => p.font >= 16 && p.line >= 1.7), `${label}: 16px/1.7 body rhythm is preserved`);
    assert.ok(after.controls.every(height => height >= 44), `${label}: disclosure targets are at least 44px`);
    assert.equal(after.active, 1, `${label}: exactly one active reading location is announced`);
    assert.equal(after.navPosition, 'sticky', `${label}: navigation stays sticky`);
    if (width >= 1024) assert.ok(after.navLeft >= after.articleRight, `${label}: desktop navigation occupies its own aside`);
    if (width <= 884) assert.ok(after.height <= before.height * .5,
      `${label}: collapsed length ${Math.round(after.height)} must be at most half baseline ${Math.round(before.height)}`);
    if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `${width}-${scheme}-after.png`) });

    // Pointer navigation moves focus, offsets the title, and updates the observer state.
    await page.$eval('.reading-navigation li:last-child a', anchor => anchor.click());
    await page.waitForFunction(() => document.querySelector('.reading-navigation li:last-child a').getAttribute('aria-current') === 'location', { timeout: 2000 })
      .catch(async error => { throw new Error(`${label}: last-section state ${JSON.stringify(await page.evaluate(() => ({ scroll: scrollY, height: innerHeight, document: document.documentElement.scrollHeight,
        lastTop: document.querySelector('.reading-daeun').getBoundingClientRect().top, lastBottom: document.querySelector('.reading-daeun').getBoundingClientRect().bottom, active: document.querySelector('.reading-navigation [aria-current]')?.textContent })))}`, { cause: error }); });
    await settle(page);
    const destination = await page.evaluate(() => {
      const anchor = document.querySelector('.reading-navigation li:last-child a');
      const target = document.getElementById(anchor.hash.slice(1));
      return { top: target.getBoundingClientRect().top, navBottom: document.querySelector('.reading-navigation').getBoundingClientRect().bottom,
        focused: document.activeElement === target, visible: !document.querySelector('.reading-back-top').hidden,
        scroll: scrollY, height: innerHeight, hiddenAncestor: document.querySelector('.unified-reading').closest('[hidden]')?.id };
    });
    assert.ok(destination.top >= (width >= 1024 ? 0 : destination.navBottom) - 1,
      `${label}: anchor heading is not covered by sticky navigation`);
    assert.ok(destination.focused, `${label}: navigation hands focus to destination (${JSON.stringify(destination)})`);
    assert.ok(destination.visible, `${label}: navigation exposes back-to-top (${JSON.stringify(destination)}; article ${after.height})`);
    if (width < 1024) {
      const activeChipVisible = await page.evaluate(() => {
        const chip = document.querySelector('.reading-navigation [aria-current]').getBoundingClientRect();
        const list = document.querySelector('.reading-navigation__list').getBoundingClientRect();
        return chip.left >= list.left - 1 && chip.right <= list.right + 1;
      });
      assert.ok(activeChipVisible, `${label}: the active chip stays visible in the horizontal table of contents`);
    }
    if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `${width}-${scheme}-anchor.png`) });

    // A manual scroll, not just a link click, must update the current location.
    await page.evaluate(() => document.querySelector('.reading-months').scrollIntoView());
    await page.waitForFunction(() => document.querySelector('.reading-navigation [aria-current="location"]').textContent.includes('12개월'));
    const closed = await page.$('.reading-month details:not([open]) > summary');
    await closed.focus();
    await page.keyboard.press('Enter');
    assert.ok(await closed.evaluate(summary => summary.parentElement.open), `${label}: keyboard opens a month`);
    await page.keyboard.press('Space');
    assert.equal(await closed.evaluate(summary => summary.parentElement.open), false, `${label}: keyboard closes a month`);

    // If an action bar is visible, the floating control remains entirely above it.
    await page.evaluate(() => { document.getElementById('bottomBar').style.display = 'flex'; });
    await settle(page);
    const clearance = await page.evaluate(() => document.querySelector('.reading-back-top').getBoundingClientRect().bottom <= document.getElementById('bottomBar').getBoundingClientRect().top - 8);
    assert.ok(clearance, `${label}: back-to-top clears the fixed bottom action bar`);
    await page.$eval('.reading-back-top', button => button.click());
    await page.waitForFunction(() => scrollY < 2 && document.querySelector('.reading-back-top').hidden);
    await page.evaluate(() => { document.getElementById('bottomBar').style.display = 'none'; });

    // Real annual rerender must receive one fresh enhancement without duplicate IDs.
    await page.$eval('[data-fortune-year-next]', button => button.click());
    await page.waitForFunction(() => document.querySelector('.reading-navigation') && document.querySelectorAll('.reading-month details').length === 12);
    const rerender = await page.evaluate(() => ({ layouts: document.querySelectorAll('.reading-layout').length,
      buttons: document.querySelectorAll('.reading-back-top').length,
      ids: [...document.querySelectorAll('[id]')].map(e => e.id),
      year: document.querySelector('#unifiedReadingTitle').textContent }));
    assert.equal(rerender.layouts, 1, `${label}: rerender replaces the layout without stacking`);
    assert.equal(rerender.buttons, 1, `${label}: one floating control survives rerender`);
    assert.equal(new Set(rerender.ids).size, rerender.ids.length, `${label}: namespaced anchor IDs remain unique`);
    assert.match(rerender.year, new RegExp(String(new Date().getFullYear() + 1)), `${label}: year movement still updates the reading`);
    assert.deepEqual(errors, [], `${label}: no browser exceptions`);
    measurements.push({ width, scheme, baselinePx: Math.round(before.height), collapsedPx: Math.round(after.height),
      reductionPercent: Math.round((1 - after.height / before.height) * 1000) / 10, paragraphs: after.paragraphs.length, toc: after.links.map(a => a.text) });
    console.log(`[reading] PASS ${label}: ${Math.round(before.height)} → ${Math.round(after.height)}px`);
  } finally { await page.close(); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((request, response) => {
    const requested = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${requested === '/' ? '/index.html' : requested}`);
    if (!file.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404).end(); return; }
      // Load the real app without the enhancement to independently measure its baseline.
      if (path.extname(file) === '.html') data = data.toString().replace(/<script\b[^>]*src=["']reading-navigation\.js[^>]*><\/script>/g, '');
      response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, timeout: 20000 });
    for (const width of widths) for (const scheme of schemes) await run(browser, `http://127.0.0.1:${server.address().port}`, width, scheme);
    fs.writeFileSync(path.join(output, 'measurements.json'), JSON.stringify(measurements, null, 2));
    console.log(`Design 10 reading UI PASS: ${measurements.length} viewport/theme combinations`);
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

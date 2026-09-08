// Regression contract: competing theme rules must not resize equivalent Hanja
// tiles, shrink controls, change UI font roles, or break responsive reading.
// Run with NODE_PATH pointing to the existing manse/app/node_modules directory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output', 'qa-design-consistency');
const widths = process.env.DESIGN_WIDTHS
  ? process.env.DESIGN_WIDTHS.split(',').map(Number)
  : [320, 390, 720, 884, 1280, 1440];
const schemes = process.env.DESIGN_SCHEMES ? process.env.DESIGN_SCHEMES.split(',') : ['light', 'dark'];
const failures = [];
const measurements = [];
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const check = (condition, message) => { if (!condition) failures.push(message); };
const closeEnough = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;

async function settle(page) {
  await page.evaluate(async () => {
    // Theme restoration can start a 180ms background transition even when the
    // harness requests reduced motion. Capture the final rendered surface.
    const bounded = promise => Promise.race([promise, new Promise(resolve => setTimeout(resolve, 1200))]);
    await bounded(document.fonts.ready);
    const finite = document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime));
    await bounded(Promise.allSettled(finite.map(animation => animation.finished)));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function closeBrowser(browser) {
  if (!browser) return;
  let deadline;
  try {
    await Promise.race([
      browser.close(),
      new Promise(resolve => { deadline = setTimeout(() => { browser.process()?.kill(); resolve(); }, 5000); }),
    ]);
  } finally {
    clearTimeout(deadline);
  }
}

async function boxes(page, selector, characterSelector) {
  return page.$$eval(selector, (elements, character) => elements.map(element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const glyph = character ? element.querySelector(character) : element;
    const glyphStyle = getComputedStyle(glyph || element);
    return { width: rect.width, height: rect.height, left: rect.left, right: rect.right,
      font: parseFloat(glyphStyle.fontSize), radius: parseFloat(style.borderTopLeftRadius),
      family: glyphStyle.fontFamily, text: element.textContent.trim().slice(0, 35) };
  }), characterSelector);
}

async function inspectShell(page, label) {
  const state = await page.evaluate(() => {
    const visible = element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
    const controls = [...document.querySelectorAll('button, input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), select, summary')]
      .filter(visible).map(element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { name: element.id || element.className || element.tagName, width: rect.width,
          height: rect.height, font: parseFloat(style.fontSize), family: style.fontFamily,
          isField: element.matches('input, select') };
      });
    const title = document.querySelector('.top-bar .title');
    const roleFamilies = [...document.querySelectorAll('.top-bar .title, .tab, .luck-title, .sub-luck-label')]
      .filter(visible).map(element => ({ name: element.className, family: getComputedStyle(element).fontFamily }));
    return { viewport: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
      controls, roleFamilies, titleFont: parseFloat(getComputedStyle(title).fontSize),
      bodyFamily: getComputedStyle(document.body).fontFamily };
  });
  check(state.scrollWidth <= state.viewport + 1, `${label}: document overflows ${state.scrollWidth - state.viewport}px`);
  check(state.titleFont <= 24, `${label}: brand title ${state.titleFont}px exceeds 24px`);
  check(/sans-serif|system-ui/i.test(state.bodyFamily), `${label}: UI base is not a sans family (${state.bodyFamily})`);
  for (const role of state.roleFamilies) {
    check(role.family === state.bodyFamily, `${label}: ${role.name} uses a different UI family (${role.family})`);
  }
  for (const control of state.controls) {
    check(control.height >= 43.5, `${label}: ${control.name} height ${control.height}px is below 44px`);
    check(control.width >= 43.5, `${label}: ${control.name} width ${control.width}px is below 44px`);
    check(control.font >= (control.isField ? 16 : 13), `${label}: ${control.name} font ${control.font}px is too small`);
    check(control.family === state.bodyFamily, `${label}: ${control.name} does not share the UI font family`);
  }
  return state;
}

async function stableSelection(page, selector, label) {
  // An existing, unselected item is measured before and after its real click handler.
  const candidate = `${selector} .luck-item:not(.selected)`;
  const before = await boxes(page, candidate, '.han');
  assert.ok(before.length, `${label}: an unselected item must be available`);
  const index = await page.$eval(candidate, element => {
    element.dataset.designQaTarget = 'true';
    return [...element.parentElement.children].indexOf(element);
  });
  const blockBefore = await boxes(page, `${selector} [data-design-qa-target] .luck-block`, '.han');
  await page.$eval(candidate, element => element.click());
  await settle(page);
  const selected = `${selector} [data-design-qa-target]`;
  const after = await boxes(page, selected, '.han');
  const blockAfter = await boxes(page, `${selected} .luck-block`, '.han');
  check(await page.$eval(selected, element => element.classList.contains('selected')), `${label}: click did not select item ${index}`);
  for (const dimension of ['width', 'height']) {
    check(closeEnough(before[0][dimension], after[0][dimension]), `${label}: selection changes item ${dimension} ${before[0][dimension]} -> ${after[0][dimension]}`);
  }
  blockBefore.forEach((block, i) => ['width', 'height', 'font', 'radius'].forEach(dimension => {
    check(closeEnough(block[dimension], blockAfter[i][dimension], 0.1), `${label}: selection changes tile ${dimension} ${block[dimension]} -> ${blockAfter[i][dimension]}`);
  }));
  await page.$eval(selected, element => delete element.dataset.designQaTarget);
}

async function runViewport(browser, baseUrl, width, scheme) {
  const page = await browser.newPage();
  const label = `${width}px ${scheme}`;
  const errors = [];
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(theme => localStorage.setItem('saju_theme', theme), scheme);
  // Only optional external person enrichment and building lookup are doubled.
  // The app, all calculation modules, rendering, fonts, and interactions stay real.
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    let body;
    if (/(^|\.)wikipedia\.org$/.test(url.hostname)) body = { query: { pages: {} } };
    else if (/(^|\.)wikidata\.org$/.test(url.hostname)) body = { entities: {}, results: { bindings: [] } };
    else if (url.pathname.endsWith('/manseBuildingLookup')) body = { status: 'not-found', records: [], results: [] };
    if (body) request.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) }).catch(() => {});
    else request.continue().catch(() => {});
  });
  try {
    console.log(`[design] ${label}: input`);
    await page.goto(`${baseUrl}/index.html?design-qa=${width}-${scheme}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#calcBtn');
    await settle(page);
    await inspectShell(page, `${label} input`);
    await page.screenshot({ path: path.join(output, `${width}-${scheme}-input.png`), fullPage: true });
    await page.click('#calcBtn');
    await page.waitForSelector('#inErr.show');
    await settle(page);
    const inputError = await page.$eval('#inErr', element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { role: element.getAttribute('role'), text: element.textContent.trim(), opacity: Number(style.opacity),
        height: rect.height, left: rect.left, right: rect.right, viewport: document.documentElement.clientWidth,
        focused: document.activeElement?.id, marked: document.getElementById('inBirth').classList.contains('field-err') };
    });
    check(inputError.role === 'alert' && inputError.text.length > 0, `${label}: invalid input needs an announced error message`);
    check(inputError.opacity >= 0.99 && inputError.height >= 40, `${label}: invalid input message is not visibly expanded`);
    check(inputError.left >= -1 && inputError.right <= inputError.viewport + 1, `${label}: error message exceeds viewport`);
    check(inputError.focused === 'inBirth' && inputError.marked, `${label}: invalid birth field needs focus and visible error marking`);
    await page.type('#inBirth', '19860219');
    await page.type('#inTime', '1430');
    await page.click('#calcBtn');
    await page.waitForSelector('#view-result:not([hidden]) .pillar-block .han');
    await settle(page);
    console.log(`[design] ${label}: Hanja and selection`);
    await stableSelection(page, '#daeunScroll', `${label} daeun`);
    await page.waitForSelector('#seunScroll .luck-item');
    await stableSelection(page, '#seunScroll', `${label} seun`);
    await page.waitForSelector('#woonScroll .luck-item');
    await stableSelection(page, '#woonScroll', `${label} woon`);
    await page.waitForSelector('.day-grid .day-item:not(.empty)');
    const natal = await boxes(page, '.pillars-4 .pillar-block', '.han');
    const layers = {};
    for (const layer of ['daeun', 'seun', 'woon']) layers[layer] = await boxes(page, `#${layer}Scroll .luck-block`, '.han');
    const reference = layers.daeun[0];
    assert.ok(reference, `${label}: actual luck blocks rendered`);
    for (const [layer, tiles] of Object.entries(layers)) {
      assert.ok(tiles.length >= 2, `${label} ${layer}: rendered both stem and branch tiles`);
      for (const tile of tiles) {
        check(tile.width >= 43.5 && tile.height >= 43.5, `${label} ${layer}: Hanja tile is below 44px (${tile.width}x${tile.height})`);
        check(tile.font >= 22, `${label} ${layer}: Hanja font ${tile.font}px is below readable 22px`);
        check(closeEnough(tile.width, tile.height), `${label} ${layer}: Hanja tile is not square (${tile.width}x${tile.height})`);
        for (const dimension of ['width', 'height', 'font', 'radius']) {
          check(closeEnough(tile[dimension], reference[dimension], dimension === 'font' || dimension === 'radius' ? 0.1 : 1), `${label} ${layer}: ${dimension} ${tile[dimension]} differs from daeun ${reference[dimension]}`);
        }
      }
    }
    assert.equal(natal.length, 8, `${label}: all eight natal characters remain`);
    natal.forEach(tile => {
      check(closeEnough(tile.width, tile.height), `${label}: natal tile is not square (${tile.width}x${tile.height})`);
      for (const dimension of ['width', 'height', 'font', 'radius']) {
        check(closeEnough(tile[dimension], natal[0][dimension], 0.1), `${label}: natal ${dimension} varies within chart`);
      }
      check(tile.font / tile.width >= 0.44 && tile.font / tile.width <= 0.70, `${label}: natal character ratio is ${tile.font / tile.width}`);
      check(closeEnough(tile.font / tile.width, natal[0].font / natal[0].width, 0.025), `${label}: natal character scale varies within chart`);
    });
    const days = await boxes(page, '.day-grid .day-item:not(.empty)', '.d-han');
    days.forEach(day => {
      check(closeEnough(day.width, day.height), `${label}: day cell is not square (${day.width}x${day.height})`);
      if (width >= 390) check(day.width >= 43.5 && day.height >= 43.5, `${label}: day cell below 44px (${day.width}x${day.height})`);
      check(closeEnough(day.width, days[0].width), `${label}: day cell columns differ in width`);
    });
    const dayContent = await page.$$eval('.day-grid .day-item:not(.empty)', elements => {
      // Canvas parses both rgb() and color(srgb ...) computed CSS colors.
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const rgba = color => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data].map(channel => channel / 255);
      };
      const composite = (foreground, background) => foreground.slice(0, 3).map((value, i) => value * foreground[3] + background[i] * (1 - foreground[3]));
      const luminance = color => color.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
        .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
      const contrast = element => {
        const ancestors = [];
        for (let node = element; node; node = node.parentElement) ancestors.push(node);
        const background = ancestors.reverse().reduce((result, node) => composite(rgba(getComputedStyle(node).backgroundColor), result), [1, 1, 1]);
        const foreground = composite(rgba(getComputedStyle(element).color), background);
        const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
        return (values[1] + 0.05) / (values[0] + 0.05);
      };
      return elements.map(element => {
        const cell = element.getBoundingClientRect();
        return [...element.children].map(child => {
          const rect = child.getBoundingClientRect();
          const textElements = child.children.length ? [...child.children] : [child];
          return { name: child.className, overflow: Math.max(cell.left - rect.left, rect.right - cell.right,
            cell.top - rect.top, rect.bottom - cell.bottom), top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right,
            contrast: Math.min(...textElements.map(contrast)) };
        });
      });
    });
    dayContent.forEach((children, index) => children.forEach((child, i) => {
      check(child.overflow <= 1, `${label}: day ${index + 1} ${child.name} exceeds its cell by ${child.overflow}px`);
      // The two ten-god labels may share a row. Reject only real 2D overlap,
      // not a harmless equal vertical coordinate in different columns.
      children.slice(0, i).forEach(previous => {
        const overlapX = Math.min(child.right, previous.right) - Math.max(child.left, previous.left);
        const overlapY = Math.min(child.bottom, previous.bottom) - Math.max(child.top, previous.top);
        check(overlapX <= 1 || overlapY <= 1, `${label}: day ${index + 1} ${child.name} overlaps ${previous.name} by ${overlapX}x${overlapY}px`);
      });
      check(child.contrast >= 4.45, `${label}: day ${index + 1} ${child.name} text contrast ${child.contrast.toFixed(2)} is below 4.5:1`);
    }));
    check(await page.$$eval('.day-grid .day-wd', elements => elements.length === 7), `${label}: seven weekday columns remain`);
    await inspectShell(page, `${label} result`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, `${width}-${scheme}-result.png`), fullPage: true });
    for (const tab of ['fortune', 'calendar', 'saved', 'input']) {
      console.log(`[design] ${label}: ${tab}`);
      await page.$eval(`#tab-${tab}`, element => element.click());
      await page.waitForSelector(`#view-${tab}:not([hidden])`);
      await settle(page);
      await inspectShell(page, `${label} ${tab}`);
      if (tab === 'fortune') {
        const reading = await page.evaluate(() => {
          const sections = [...document.querySelectorAll('.unified-reading > [data-reading-section]')];
          return { order: sections.map(section => section.dataset.readingSection),
            tops: sections.map(section => section.getBoundingClientRect().top),
            months: [...document.querySelectorAll('.reading-month__label')].map(month => month.textContent.trim()),
            paragraphs: document.querySelectorAll('.reading-prose p').length,
            bodyFamily: getComputedStyle(document.body).fontFamily,
            titles: [...document.querySelectorAll('.reading-section__head h2')].map(element => ({
              font: parseFloat(getComputedStyle(element).fontSize), family: getComputedStyle(element).fontFamily })),
            prose: [...document.querySelectorAll('.reading-prose p, .reading-month p')].map(element => ({
              font: parseFloat(getComputedStyle(element).fontSize), family: getComputedStyle(element).fontFamily })),
            monthTops: [...document.querySelectorAll('.reading-month')].map(element => element.getBoundingClientRect().top) };
        });
        check(JSON.stringify(reading.order) === JSON.stringify(['year', 'months', 'daeun']), `${label}: annual -> months -> daeun reading order changed`);
        check(reading.tops[0] < reading.tops[1] && reading.tops[1] < reading.tops[2], `${label}: visual reading section order changed`);
        check(JSON.stringify(reading.months) === JSON.stringify(Array.from({ length: 12 }, (_, i) => `${i + 1}월`)), `${label}: chronological twelve-month reading changed`);
        check(reading.paragraphs >= 10, `${label}: detailed reading paragraphs disappeared`);
        check(reading.titles.every(title => title.font <= 24), `${label}: reading title exceeds 24px`);
        check(reading.prose.every(paragraph => paragraph.font >= 16), `${label}: reading prose is smaller than 16px`);
        check([...reading.titles, ...reading.prose].every(element => element.family === reading.bodyFamily), `${label}: reading typography does not share the UI sans family`);
        check(reading.monthTops.every((top, i) => i === 0 || top > reading.monthTops[i - 1]), `${label}: monthly prose is split across columns instead of a continuous reading sequence`);
        await page.screenshot({ path: path.join(output, `${width}-${scheme}-fortune.png`), fullPage: false });
      }
    }
    await page.evaluate(() => window.showAppToast('디자인 검증 알림'));
    await settle(page);
    const toast = await page.$eval('#appToast', element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { position: style.position, opacity: Number(style.opacity), role: element.getAttribute('role'),
        live: element.getAttribute('aria-live'), left: rect.left, right: rect.right, top: rect.top,
        bottom: rect.bottom, viewport: document.documentElement.clientWidth, viewportHeight: innerHeight };
    });
    check(toast.position === 'fixed' && toast.opacity >= 0.99, `${label}: toast must be visibly fixed in the viewport`);
    check(toast.role === 'status' && toast.live === 'polite', `${label}: toast needs live status semantics`);
    check(toast.left >= 0 && toast.right <= toast.viewport + 1 && toast.top >= 0 && toast.bottom <= toast.viewportHeight,
      `${label}: toast extends outside the viewport`);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await settle(page);
    check(closeEnough(toast.top, await page.$eval('#appToast', element => element.getBoundingClientRect().top)), `${label}: toast moves with page scrolling`);
    check(errors.length === 0, `${label}: browser errors ${errors.join('; ')}`);
    measurements.push({ width, scheme, natal: natal[0], layers: Object.fromEntries(Object.entries(layers).map(([name, tiles]) => [name, tiles[0]])), day: days[0] });
    console.log(`[design] ${label}: measured natal ${natal[0].width}/${natal[0].font}; daeun ${reference.width}/${reference.font}; woon ${layers.woon[0].width}/${layers.woon[0].font}`);
  } finally {
    await page.close();
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((request, response) => {
    const requested = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${requested === '/' ? '/index.html' : requested}`);
    if (!file.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) response.writeHead(404).end();
      else response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  // Hard deadline keeps a stalled font/network/browser process from hanging CI.
  const watchdog = setTimeout(() => {
    console.error('[design] FAIL: exceeded 150 second total deadline');
    if (browser?.process()) browser.process().kill();
    server.closeAllConnections();
    server.close();
    process.exitCode = 1;
  }, 150000);
  try {
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new', timeout: 20000 });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    for (const width of widths) for (const scheme of schemes) await runViewport(browser, baseUrl, width, scheme);
    for (const scheme of schemes) {
      const ratios = measurements.filter(item => item.scheme === scheme).map(item => item.natal.font / item.natal.width);
      check(Math.max(...ratios) - Math.min(...ratios) <= 0.08, `${scheme}: natal glyph/box ratio varies excessively across viewports (${ratios.join(', ')})`);
    }
    fs.writeFileSync(path.join(output, 'measurements.json'), JSON.stringify({ measurements, failures: [...new Set(failures)] }, null, 2));
    assert.deepEqual([...new Set(failures)], [], 'Rendered design consistency violations');
    console.log(`Design consistency UI PASS: ${widths.join(', ')}px; ${schemes.join(', ')}`);
  } finally {
    clearTimeout(watchdog);
    server.closeAllConnections();
    await Promise.allSettled([
      closeBrowser(browser),
      new Promise(resolve => server.close(resolve)),
    ]);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

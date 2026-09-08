// Catch unknown-hour markup changing the common eight-cell natal grid. This
// checks actual rendered cell/character boxes, not any particular CSS technique.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const puppeteer = require('puppeteer-core');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output', 'qa-natal-alignment');
const url = process.env.NATAL_URL || pathToFileURL(path.join(root, 'index.html')).href;
const widths = process.env.NATAL_WIDTHS ? process.env.NATAL_WIDTHS.split(',').map(Number) : [320, 390, 568, 884, 1280];
const schemes = process.env.NATAL_SCHEMES ? process.env.NATAL_SCHEMES.split(',') : ['light', 'dark'];
const failures = [];
const measurements = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const near = (left, right) => Math.abs(left - right) <= 1;

async function settle(page) {
  await page.evaluate(async () => {
    const bounded = promise => Promise.race([promise, new Promise(resolve => setTimeout(resolve, 1200))]);
    await bounded(document.fonts.ready);
    const finite = document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime));
    await bounded(Promise.allSettled(finite.map(animation => animation.finished)));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function inspect(browser, width, scheme, unknown) {
  const page = await browser.newPage();
  const label = `${width}px ${scheme} ${unknown ? 'unknown-hour' : 'known-hour'}`;
  const errors = [];
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(theme => localStorage.setItem('saju_theme', theme), scheme);
  await page.setRequestInterception(true);
  page.on('request', request => {
    const target = new URL(request.url());
    let body;
    if (/(^|\.)wikipedia\.org$/.test(target.hostname)) body = { query: { pages: {} } };
    else if (/(^|\.)wikidata\.org$/.test(target.hostname)) body = { entities: {}, results: { bindings: [] } };
    if (body) request.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) }).catch(() => {});
    else request.continue().catch(() => {});
  });
  try {
    console.log(`[natal] ${label}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#calcBtn');
    await page.type('#inBirth', '20031231');
    if (!unknown) await page.type('#inTime', '1430');
    await page.click('#calcBtn');
    await page.waitForSelector('#view-result:not([hidden]) .pillar-block .han');
    await settle(page);
    const state = await page.evaluate(() => {
      const box = element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
          width: rect.width, height: rect.height, centerX: (rect.left + rect.right) / 2,
          centerY: (rect.top + rect.bottom) / 2 };
      };
      const visible = element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
      return {
        columns: [...document.querySelectorAll('.pillars-4 > .pillar-col')].map(column => ({
          title: column.querySelector('.pillar-title')?.textContent.replace('↻', '').trim(),
          cells: [...column.querySelectorAll('.pillar-block')].map(cell => ({ ...box(cell),
            glyph: { ...box(cell.querySelector('.han')), text: cell.querySelector('.han').textContent.trim() } })),
          readings: [...column.querySelectorAll('.calli-kor')].map(element => ({ text: element.textContent.trim(), visible: Boolean(visible(element)), ...box(element) })),
          topLabel: column.querySelector('.pillar-sipsin-top')?.textContent.trim(),
          bottomLabel: column.querySelector('.pillar-sipsin-bot')?.textContent.trim(),
        })),
        info: document.querySelector('.result-head .info')?.textContent.trim(),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        viewport: document.documentElement.clientWidth,
      };
    });
    assert.equal(state.columns.length, 4, `${label}: four natal columns remain`);
    check(JSON.stringify(state.columns.map(column => column.title)) === JSON.stringify(['시주', '일주', '월주', '년주']), `${label}: column labels/order changed`);
    const cells = state.columns.flatMap(column => column.cells);
    assert.equal(cells.length, 8, `${label}: all eight cells remain`);
    const reference = state.columns[1].cells[0];
    state.columns.forEach((column, columnIndex) => {
      assert.equal(column.cells.length, 2, `${label} column ${columnIndex}: both stem and branch remain`);
      check(near(column.cells[0].centerX, column.cells[1].centerX), `${label} column ${columnIndex}: upper/lower cell centers differ horizontally`);
      column.cells.forEach((cell, rowIndex) => {
        check(near(cell.width, cell.height), `${label} column ${columnIndex} row ${rowIndex}: cell is not square (${cell.width}x${cell.height})`);
        check(near(cell.width, reference.width) && near(cell.height, reference.height), `${label} column ${columnIndex} row ${rowIndex}: cell ${cell.width}x${cell.height} differs from common ${reference.width}x${reference.height}`);
        const rowReference = state.columns[1].cells[rowIndex];
        check(near(cell.top, rowReference.top), `${label} column ${columnIndex} row ${rowIndex}: top ${cell.top} differs from row ${rowReference.top}`);
        check(near(cell.centerY, rowReference.centerY), `${label} column ${columnIndex} row ${rowIndex}: vertical center ${cell.centerY} differs from row ${rowReference.centerY}`);
        // .han is the rendered character line box. Font-specific ink metrics
        // are deliberately not approximated from the font-size declaration.
        check(near(cell.glyph.centerX, cell.centerX), `${label} column ${columnIndex} row ${rowIndex}: character X offset ${cell.glyph.centerX - cell.centerX}px`);
        check(near(cell.glyph.centerY, cell.centerY), `${label} column ${columnIndex} row ${rowIndex}: character Y offset ${cell.glyph.centerY - cell.centerY}px`);
        check(cell.glyph.left >= cell.left - 1 && cell.glyph.right <= cell.right + 1 && cell.glyph.top >= cell.top - 1 && cell.glyph.bottom <= cell.bottom + 1,
          `${label} column ${columnIndex} row ${rowIndex}: character box exceeds cell`);
        check(cell.left >= -1 && cell.right <= state.viewport + 1, `${label}: natal cell exceeds viewport`);
      });
      if (!unknown || columnIndex !== 0) {
        check(column.readings.filter(reading => reading.visible && reading.text).length === 2, `${label} column ${columnIndex}: both Korean readings remain visible`);
        check(column.readings[0].top >= column.cells[0].bottom - 1 && column.readings[0].bottom <= column.cells[1].top + 1,
          `${label} column ${columnIndex}: upper Korean reading overlaps a Hanja cell`);
        check(column.readings[1].top >= column.cells[1].bottom - 1, `${label} column ${columnIndex}: lower Korean reading overlaps its Hanja cell`);
      }
    });
    if (unknown) {
      check(state.columns[0].cells.every(cell => cell.glyph.text === '?'), `${label}: unknown hour must retain two question-mark placeholders`);
      check(state.columns[0].topLabel === '—' && state.columns[0].bottomLabel === '—', `${label}: unknown hour must not invent ten-god labels`);
      check(state.info.includes('시 모름'), `${label}: unknown time status remains explicit`);
    } else check(cells.every(cell => cell.glyph.text !== '?'), `${label}: known time must render eight real characters`);
    check(state.overflow <= 1, `${label}: whole page overflows by ${state.overflow}px`);
    check(errors.length === 0, `${label}: browser errors ${errors.join('; ')}`);
    measurements.push({ width, scheme, unknown, ...state });
    await page.$eval('.pillars-4', element => element.scrollIntoView({ block: 'center' }));
    await settle(page);
    const chart = await page.$('.oguk-card');
    await chart.screenshot({ path: path.join(output, `${width}-${scheme}-${unknown ? 'unknown' : 'known'}.png`) });
    console.log(`[natal] ${label}: cell widths ${state.columns.map(column => column.cells[0].width).join(', ')}; stem tops ${state.columns.map(column => column.cells[0].top).join(', ')}`);
  } finally { await page.close(); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new', timeout: 20000 });
  const watchdog = setTimeout(() => { console.error('[natal] total deadline exceeded'); browser.process()?.kill(); process.exitCode = 1; }, 90000);
  try {
    for (const width of widths) for (const scheme of schemes) for (const unknown of [true, false]) await inspect(browser, width, scheme, unknown);
    fs.writeFileSync(path.join(output, 'measurements.json'), JSON.stringify({ measurements, failures }, null, 2));
    assert.deepEqual(failures, [], 'Natal alignment violations');
    console.log(`Natal alignment UI PASS: ${widths.join(', ')}px; ${schemes.join(', ')}; known and unknown hour`);
  } finally {
    clearTimeout(watchdog);
    let cleanupDeadline;
    await Promise.race([browser.close(), new Promise(resolve => { cleanupDeadline = setTimeout(() => { browser.process()?.kill(); resolve(); }, 5000); })]).finally(() => clearTimeout(cleanupDeadline));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

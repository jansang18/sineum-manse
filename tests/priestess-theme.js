// Historical entrypoint retained for existing commands. The live application
// now uses the canonical ink-and-gold foundation in apple.css, not priestess.css.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const puppeteer = require('puppeteer-core');

const root = path.resolve(__dirname, '..');
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = pathToFileURL(path.join(root, 'index.html')).href;

assert.ok(fs.statSync(path.join(root, 'apple.css')).size > 0, 'apple.css is missing or empty');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
assert.equal(manifest.background_color, '#f4f1e9');
assert.equal(manifest.theme_color, '#111a20');

async function settleTheme(page) {
  await page.evaluate(async () => {
    const bounded = promise => Promise.race([promise, new Promise(resolve => setTimeout(resolve, 1200))]);
    await bounded(document.fonts.ready);
    const finite = document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime));
    await bounded(Promise.allSettled(finite.map(animation => animation.finished)));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function preparePage(page, width, scheme) {
  page.setDefaultTimeout(12000);
  await page.setViewport({ width, height: 844, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(theme => localStorage.setItem('saju_theme', theme), scheme);
  // Only optional external person enrichment is doubled; calculations stay real.
  await page.setRequestInterception(true);
  page.on('request', request => {
    const target = new URL(request.url());
    let body;
    if (/(^|\.)wikipedia\.org$/.test(target.hostname)) body = { query: { pages: {} } };
    else if (/(^|\.)wikidata\.org$/.test(target.hostname)) body = { entities: {}, results: { bindings: [] } };
    if (body) request.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) }).catch(() => {});
    else request.continue().catch(() => {});
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#calcBtn');
  await settleTheme(page);
}

async function inspectTheme(page, width, scheme) {
  await preparePage(page, width, scheme);

  const state = await page.evaluate(() => {
    const rect = selector => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return {
        width: box.width,
        height: box.height,
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom
      };
    };
    const input = document.getElementById('inBirth');
    const nameInput = document.getElementById('inputName');
    const personSearchInput = document.getElementById('psQuery');
    const resolveColor = token => {
      const probe = document.createElement('span');
      probe.style.color = `var(${token})`;
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    input.value = '19860219';
    return {
      stylesheet: [...document.styleSheets].some(sheet => sheet.href && new URL(sheet.href).pathname.endsWith('/apple.css')),
      dark: document.body.classList.contains('dark'),
      palette: { label: resolveColor('--apple-label'), placeholder: resolveColor('--apple-tertiary') },
      introCount: document.querySelectorAll('.input-intro').length,
      artCount: document.querySelectorAll('.manse-art').length,
      calligraphyCount: document.querySelectorAll('.manse-calligraphy').length,
      brand: document.querySelector('.top-bar .title')?.textContent.trim(),
      hasLegacyLogo: Boolean(document.querySelector('.intro-logo-img')),
      inputDecoration: getComputedStyle(document.querySelector('.input-card'), '::after').content,
      tabs: rect('.tabs'),
      inputHeader: rect('#view-input .view-head'),
      firstControl: rect('.person-search-btn'),
      button: rect('#calcBtn'),
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      inputColor: getComputedStyle(input).color,
      inputFillColor: getComputedStyle(input).webkitTextFillColor,
      placeholderColor: getComputedStyle(input, '::placeholder').color,
      placeholderFillColor: getComputedStyle(input, '::placeholder').webkitTextFillColor,
      namePlaceholderColor: getComputedStyle(nameInput, '::placeholder').color,
      namePlaceholderFillColor: getComputedStyle(nameInput, '::placeholder').webkitTextFillColor,
      personSearchPlaceholderColor: getComputedStyle(personSearchInput, '::placeholder').color,
      personSearchPlaceholderFillColor: getComputedStyle(personSearchInput, '::placeholder').webkitTextFillColor,
      inputValue: input.value
    };
  });

  assert.equal(state.stylesheet, true, `${width}px ${scheme} theme stylesheet missing`);
  assert.equal(state.dark, scheme === 'dark', `${width}px requested theme must be applied before inspecting colors`);
  assert.equal(state.introCount, 0, `${width}px ${scheme} oversized intro must be removed`);
  assert.equal(state.artCount, 0, `${width}px ${scheme} hero art must be removed`);
  assert.equal(state.calligraphyCount, 0, `${width}px ${scheme} hero calligraphy must be removed`);
  assert.equal(state.brand, '잔상 만세력');
  assert.equal(state.hasLegacyLogo, false);
  assert.equal(state.inputDecoration, 'none');
  assert.equal(state.inputValue, '19860219');
  assert.equal(state.inputColor, state.palette.label, `${width}px entered text must use the readable label token`);
  assert.equal(state.inputFillColor, state.palette.label, `${width}px WebKit text fill must not override readable entered text`);
  for (const key of ['placeholderColor', 'placeholderFillColor', 'namePlaceholderColor', 'namePlaceholderFillColor', 'personSearchPlaceholderColor', 'personSearchPlaceholderFillColor']) {
    assert.equal(state[key], state.palette.placeholder, `${width}px ${scheme} ${key} must use the shared placeholder token`);
  }
  assert.notEqual(state.palette.label, state.palette.placeholder, `${width}px values and placeholders must remain visually distinct`);
  // The new compact view header intentionally sits between tabs and search.
  const firstControlGap = state.firstControl.top - state.inputHeader.bottom;
  assert.ok(state.inputHeader.top >= state.tabs.bottom - 1, `${width}px input header overlaps tabs`);
  assert.ok(state.inputHeader.height >= 80 && state.inputHeader.height <= 132, `${width}px input header is not compact (${state.inputHeader.height}px)`);
  assert.ok(firstControlGap >= 0 && firstControlGap <= 32, `${width}px first input control gap below header is ${firstControlGap}px`);
  assert.ok(state.button.height >= 52, `${width}px primary action is too short`);
  assert.ok(state.firstControl.left >= 0 && state.firstControl.right <= state.viewport + 1, `${width}px first input control overflows`);
  assert.ok(state.scrollWidth <= state.viewport + 1, `${width}px document overflows`);
  console.log(`Canonical theme input PASS ${width}px ${scheme}`);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    args: ['--hide-scrollbars']
  });

  try {
    for (const width of [320, 360, 390, 412, 768, 1280]) {
      for (const scheme of ['dark', 'light']) {
        const page = await browser.newPage();
        try { await inspectTheme(page, width, scheme); }
        finally { await page.close(); }
      }
    }

    for (const scheme of ['dark', 'light']) {
    const resultPage = await browser.newPage();
    await preparePage(resultPage, 390, scheme);
    await resultPage.type('#inBirth', '19860219');
    await resultPage.type('#inTime', '1430');
    await resultPage.click('#calcBtn');
    await resultPage.waitForSelector('#view-result:not([hidden])');
    await settleTheme(resultPage);
    const result = await resultPage.evaluate(() => {
      const bottom = document.getElementById('bottomBar');
      const row = bottom.getBoundingClientRect();
      const buttons = [...bottom.querySelectorAll('button')].map(button => {
        const rect = button.getBoundingClientRect();
        return { top: rect.top, left: rect.left, right: rect.right, height: rect.height };
      });
      const probe = document.createElement('span');
      probe.style.color = 'var(--apple-surface)';
      document.body.append(probe);
      const surface = getComputedStyle(probe).color;
      probe.remove();
      return {
      exactDate: document.querySelector('.cycle-row-exact .cycle-date-chip')?.textContent.trim(),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bottomPosition: getComputedStyle(bottom).position,
      row: { left: row.left, right: row.right, bottom: row.bottom, height: row.height }, buttons,
      viewport: document.documentElement.clientWidth, viewportHeight: innerHeight,
      cardBackground: getComputedStyle(document.querySelector('.oguk-card')).backgroundColor, surface
      };
    });
    assert.equal(result.exactDate, '1926.03.06 · 60년 전');
    assert.ok(result.overflow <= 1, `result overflow is ${result.overflow}px`);
    assert.equal(result.cardBackground, result.surface, `${scheme}: natal card must share the canonical surface`);
    assert.equal(result.bottomPosition, 'fixed', `${scheme}: result actions stay fixed`);
    assert.equal(result.buttons.length, 3, `${scheme}: all result actions remain`);
    assert.ok(result.row.left >= 0 && result.row.right <= result.viewport + 1, `${scheme}: bottom row exceeds viewport`);
    assert.ok(result.row.bottom <= result.viewportHeight + 1, `${scheme}: bottom row falls below viewport`);
    for (const button of result.buttons) {
      assert.ok(button.height >= 44, `${scheme}: bottom action touch target is too small`);
      assert.ok(Math.abs(button.top - result.buttons[0].top) <= 1, `${scheme}: result actions must remain one row`);
    }

    await resultPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await settleTheme(resultPage);
    const scrolledHeader = await resultPage.evaluate(() => ({
      scrollY: window.scrollY,
      topBarBottom: document.querySelector('.top-bar').getBoundingClientRect().bottom,
      tabsBottom: document.querySelector('.tabs').getBoundingClientRect().bottom
    }));
    assert.ok(scrolledHeader.scrollY >= 120, 'result page must scroll far enough to test header behavior');
    assert.ok(scrolledHeader.topBarBottom < 0, 'title bar must scroll away with the result page');
    assert.ok(scrolledHeader.tabsBottom < 0, 'navigation bar must scroll away with the result page');
    await resultPage.close();
    console.log(`Canonical theme result PASS 390px ${scheme}`);
    }

    console.log('Jansang canonical theme regression PASS (historical priestess-theme entrypoint)');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const puppeteer = require('puppeteer-core');

const root = path.resolve(__dirname, '..');
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = pathToFileURL(path.join(root, 'index.html')).href;

for (const file of ['priestess.css', 'manse-hero-v2.webp', 'jansang-calligraphy-brush.webp']) {
  assert.ok(fs.statSync(path.join(root, file)).size > 0, `${file} is missing or empty`);
}

const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
for (const asset of ['priestess.css', 'manse-hero-v2.webp', 'jansang-calligraphy-brush.webp']) {
  assert.ok(serviceWorker.includes(`'./${asset}'`), `${asset} is not precached`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
assert.equal(manifest.background_color, '#E9DFCC');
assert.equal(manifest.theme_color, '#18222A');

async function inspectTheme(page, width, scheme) {
  await page.setViewport({ width, height: 844, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await page.goto(url, { waitUntil: 'networkidle0' });

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
    const arts = [...document.querySelectorAll('.manse-art')];
    const input = document.getElementById('inBirth');
    const nameInput = document.getElementById('inputName');
    input.value = '19860219';
    return {
      stylesheet: [...document.styleSheets].some(sheet => sheet.href?.endsWith('/priestess.css')),
      artCount: arts.length,
      artImages: arts.map(art => getComputedStyle(art).backgroundImage),
      brand: document.querySelector('.top-bar .title')?.textContent.trim(),
      heroCopy: document.querySelector('.manse-hero-copy')?.textContent.replace(/\s+/g, ' ').trim(),
      calligraphySrc: document.querySelector('.manse-calligraphy')?.getAttribute('src'),
      hasDecorativeHanja: /[神命還]/.test(document.querySelector('.input-intro')?.textContent || ''),
      hasLegacyLogo: Boolean(document.querySelector('.intro-logo-img')),
      inputDecoration: getComputedStyle(document.querySelector('.input-card'), '::after').content,
      hero: rect('.input-intro'),
      tabs: rect('.tabs'),
      button: rect('#calcBtn'),
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      inputColor: getComputedStyle(input).color,
      inputFillColor: getComputedStyle(input).webkitTextFillColor,
      placeholderColor: getComputedStyle(input, '::placeholder').color,
      placeholderFillColor: getComputedStyle(input, '::placeholder').webkitTextFillColor,
      namePlaceholderColor: getComputedStyle(nameInput, '::placeholder').color,
      namePlaceholderFillColor: getComputedStyle(nameInput, '::placeholder').webkitTextFillColor,
      inputValue: input.value
    };
  });

  assert.equal(state.stylesheet, true, `${width}px ${scheme} theme stylesheet missing`);
  assert.equal(state.artCount, 1, `${width}px ${scheme} manseryeok art count`);
  assert.ok(state.artImages.some(value => value.includes('manse-hero-v2.webp')));
  assert.equal(state.brand, '잔상 만세력');
  assert.match(state.heroCopy, /천년의 시간을 펼치다/);
  assert.equal(state.calligraphySrc, 'jansang-calligraphy-brush.webp');
  assert.equal(state.hasDecorativeHanja, false);
  assert.equal(state.hasLegacyLogo, false);
  assert.equal(state.inputDecoration, 'none');
  assert.equal(state.inputValue, '19860219');
  assert.equal(state.inputColor, scheme === 'dark' ? 'rgba(237, 229, 213, 0.72)' : 'rgba(26, 32, 34, 0.72)');
  assert.equal(state.inputFillColor, scheme === 'dark' ? 'rgba(237, 229, 213, 0.72)' : 'rgba(26, 32, 34, 0.72)');
  assert.equal(state.placeholderColor, scheme === 'dark' ? 'rgba(237, 229, 213, 0.36)' : 'rgba(26, 32, 34, 0.36)');
  assert.equal(state.placeholderFillColor, scheme === 'dark' ? 'rgba(237, 229, 213, 0.36)' : 'rgba(26, 32, 34, 0.36)');
  assert.equal(state.namePlaceholderColor, scheme === 'dark' ? 'rgba(237, 229, 213, 0.36)' : 'rgba(26, 32, 34, 0.36)');
  assert.equal(state.namePlaceholderFillColor, scheme === 'dark' ? 'rgba(237, 229, 213, 0.36)' : 'rgba(26, 32, 34, 0.36)');
  assert.ok(state.hero.height >= 220, `${width}px hero is too short`);
  assert.ok(state.hero.top >= state.tabs.bottom - 1, `${width}px hero overlaps the sticky tabs`);
  assert.ok(state.button.height >= 52, `${width}px primary action is too short`);
  assert.ok(state.hero.left >= 0 && state.hero.right <= state.viewport + 1, `${width}px hero overflows`);
  assert.ok(state.scrollWidth <= state.viewport + 1, `${width}px document overflows`);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    args: ['--hide-scrollbars']
  });

  try {
    for (const width of [320, 360, 390, 412, 768]) {
      const page = await browser.newPage();
      await inspectTheme(page, width, 'dark');
      await inspectTheme(page, width, 'light');
      await page.close();
    }

    const scrollingPage = await browser.newPage();
    await scrollingPage.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await scrollingPage.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    await scrollingPage.goto(url, { waitUntil: 'networkidle0' });
    await scrollingPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await new Promise(resolve => setTimeout(resolve, 100));
    const scrolledHeader = await scrollingPage.evaluate(() => ({
      scrollY: window.scrollY,
      topBarBottom: document.querySelector('.top-bar').getBoundingClientRect().bottom,
      tabsBottom: document.querySelector('.tabs').getBoundingClientRect().bottom
    }));
    assert.ok(scrolledHeader.scrollY >= 120, 'page must scroll far enough to test header behavior');
    assert.ok(scrolledHeader.topBarBottom < 0, 'title bar must scroll away with the page');
    assert.ok(scrolledHeader.tabsBottom < 0, 'navigation bar must scroll away with the page');
    await scrollingPage.close();

    const resultPage = await browser.newPage();
    await resultPage.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await resultPage.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    await resultPage.goto(url, { waitUntil: 'networkidle0' });
    await resultPage.type('#inBirth', '19860219');
    await resultPage.type('#inTime', '1430');
    await resultPage.click('#calcBtn');
    await resultPage.waitForSelector('#view-result:not([hidden])');
    const result = await resultPage.evaluate(() => ({
      exactDate: document.querySelector('.cycle-row-exact .cycle-date-chip')?.textContent.trim(),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bottomBackground: getComputedStyle(document.getElementById('bottomBar')).backgroundColor,
      cardBackground: getComputedStyle(document.querySelector('.oguk-card')).backgroundColor
    }));
    assert.equal(result.exactDate, '1926.03.06');
    assert.ok(result.overflow <= 1, `result overflow is ${result.overflow}px`);
    assert.equal(result.bottomBackground, 'rgba(8, 13, 17, 0.97)');
    assert.equal(result.cardBackground, 'rgba(17, 24, 30, 0.95)');
    await resultPage.close();

    const reducedPage = await browser.newPage();
    await reducedPage.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await reducedPage.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: 'dark' },
      { name: 'prefers-reduced-motion', value: 'reduce' }
    ]);
    await reducedPage.goto(url, { waitUntil: 'networkidle0' });
    const reduced = await reducedPage.evaluate(() => ({
      heroOpacity: getComputedStyle(document.querySelector('.manse-art')).opacity,
      heroTransform: getComputedStyle(document.querySelector('.manse-art')).transform,
      running: document.querySelector('.input-intro').getAnimations({ subtree: true }).length
    }));
    assert.deepEqual(reduced, {
      heroOpacity: '1',
      heroTransform: 'none',
      running: 0
    });
    await reducedPage.close();

    console.log('Jansang manseryeok theme regression PASS');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});

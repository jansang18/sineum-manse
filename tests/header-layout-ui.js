// Catch divergent chrome/content edges, oversized navigation, and tab-switch
// layout shifts by measuring the real rendered app, not CSS source strings.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const puppeteer = require('puppeteer-core');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output', 'qa-header');
const widths = (process.env.HEADER_WIDTHS || '320,390,768,884,1024,1440').split(',').map(Number);
const pageUrl = process.env.HEADER_URL || pathToFileURL(path.join(root, 'index.html')).href;
const failures = [];
const measurements = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const near = (a, b) => Math.abs(a - b) <= 1;

async function settle(page) {
  await page.evaluate(async () => {
    await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1000))]);
    const animations = document.getAnimations().filter(item => Number.isFinite(item.effect?.getComputedTiming().endTime));
    await Promise.race([Promise.allSettled(animations.map(item => item.finished)), new Promise(resolve => setTimeout(resolve, 1000))]);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function measure(page) {
  return page.evaluate(() => {
    const rect = element => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top + scrollY,
        bottom: box.bottom + scrollY, width: box.width, height: box.height };
    };
    const header = document.querySelector('.top-bar');
    const tabs = document.querySelector('.tabs');
    const view = document.querySelector('.view.active');
    const head = view.id === 'view-result' ? view.querySelector('.oguk-card') : view.querySelector('.view-head');
    const active = document.querySelector('.tab.active');
    const indicator = getComputedStyle(active, '::after');
    const title = document.querySelector('.top-bar .title');
    return { header: rect(header), tabs: rect(tabs), content: rect(head), title: rect(title),
      titleFont: parseFloat(getComputedStyle(title).fontSize),
      activeBackground: getComputedStyle(active).backgroundColor,
      indicator: { display: indicator.display, width: parseFloat(indicator.width), height: parseFloat(indicator.height) },
      controls: [...document.querySelectorAll('.top-bar button, .tabs button')].map(element => ({
        ...rect(element), text: element.textContent.trim() || element.getAttribute('aria-label'),
        scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
      })),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      selected: [...document.querySelectorAll('.tab[aria-selected="true"]')].map(element => element.dataset.tab),
    };
  });
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new', timeout: 20000 });
  const watchdog = setTimeout(() => { browser.process()?.kill(); process.exitCode = 1; }, 150000);
  try {
    for (const width of widths) for (const theme of ['light', 'dark']) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.setDefaultTimeout(12000);
      await page.setViewport({ width, height: 960, deviceScaleFactor: 1 });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.evaluateOnNewDocument(value => localStorage.setItem('saju_theme', value), theme);
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await settle(page);
      const baseline = await measure(page);
      await page.evaluate(() => {
        document.querySelector('#inputName').value = '정렬 검증';
        const birth = document.querySelector('#inBirth');
        birth.value = '19930516';
        birth.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('#calcBtn').click();
      });
      await page.waitForSelector('#view-result.active .pillar-block');
      for (const tab of ['result', 'fortune', 'calendar', 'saved', 'input']) {
        await page.$eval(`#tab-${tab}`, element => element.click());
        await page.waitForSelector(`#view-${tab}.active`);
        await settle(page);
        const state = await measure(page);
        const label = `${width}px ${theme} ${tab}`;
        for (const item of ['header', 'tabs']) {
          check(near(state[item].left, state.content.left) && near(state[item].right, state.content.right),
            `${label}: ${item} edges ${state[item].left}/${state[item].right} differ from content ${state.content.left}/${state.content.right}`);
          for (const dimension of ['left', 'width', 'height', 'top']) check(near(state[item][dimension], baseline[item][dimension]), `${label}: tab switch moves ${item} ${dimension}`);
        }
        check(state.header.height <= 64 && state.tabs.height <= 48, `${label}: oversized chrome ${state.header.height}/${state.tabs.height}`);
        check(near(state.tabs.top, state.header.bottom), `${label}: chrome rows are disconnected`);
        check(state.content.top - state.tabs.bottom >= 12, `${label}: content touches navigation`);
        check(state.titleFont <= 18, `${label}: oversized brand type`);
        check(state.activeBackground === 'rgba(0, 0, 0, 0)', `${label}: active tab still has a large filled slab`);
        check(state.indicator.display !== 'none' && state.indicator.height >= 2 && state.indicator.height <= 3 && state.indicator.width >= 24 && state.indicator.width <= 44, `${label}: missing restrained non-color-only active marker`);
        check(state.overflow <= 1, `${label}: horizontal overflow ${state.overflow}`);
        check(state.selected.length === 1 && state.selected[0] === tab, `${label}: selected tab semantics lost`);
        state.controls.forEach(control => {
          check(control.width >= 44 && control.height >= 44, `${label}: ${control.text} touch target shrank`);
          check(control.scrollWidth <= control.clientWidth + 1, `${label}: ${control.text} label is clipped`);
        });
        if (tab === 'result') {
          await page.evaluate(() => scrollTo(0, 0));
          await page.screenshot({ path: path.join(output, `${width}-${theme}.png`), fullPage: false });
          measurements.push({ width, theme, ...state });
        }
      }
      await page.focus('#tab-input');
      await page.keyboard.press('ArrowRight');
      check(await page.$eval('#tab-result', element => element === document.activeElement && element.getAttribute('aria-selected') === 'true'), `${width}px ${theme}: keyboard tab navigation failed`);
      await page.focus('#themeToggleBtn');
      check(await page.$eval('#themeToggleBtn', element => getComputedStyle(element).outlineStyle !== 'none'), `${width}px ${theme}: keyboard focus invisible`);
      await page.keyboard.press('Enter');
      check(await page.$eval('body', (element, before) => element.classList.contains('dark') !== (before === 'dark'), theme), `${width}px ${theme}: theme action failed`);
      // A safe-area inset must move controls down without changing the chrome width.
      await page.evaluate(() => document.documentElement.style.setProperty('--safe-area-inset-top', '24px'));
      await settle(page);
      const safe = await measure(page);
      check(near(safe.header.height, baseline.header.height + 24) && near(safe.header.width, baseline.header.width), `${width}px ${theme}: top safe area breaks chrome`);
      check(errors.length === 0, `${width}px ${theme}: browser errors ${errors.join('; ')}`);
      await page.close();
      console.log(`[header] ${width}px ${theme}: checked five tabs, keyboard, theme and safe area`);
    }
    fs.writeFileSync(path.join(output, 'measurements.json'), JSON.stringify({ measurements, failures }, null, 2));
    assert.deepEqual(failures, [], 'Header layout violations');
    console.log(`Header layout UI PASS: ${widths.join(', ')}px; light/dark`);
  } finally {
    clearTimeout(watchdog);
    let timer;
    try { await Promise.race([browser.close(), new Promise(resolve => { timer = setTimeout(() => { browser.process()?.kill(); resolve(); }, 5000); })]); }
    finally { clearTimeout(timer); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

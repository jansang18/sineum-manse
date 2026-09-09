// Prevent the daily calendar shrinking to unreadable text while preserving its
// seven weekday columns, square cells, and independently scrollable phone view.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const puppeteer = require('puppeteer-core');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output', 'qa-day-readability');
const widths = (process.env.DAY_WIDTHS || '320,390,600,768,884,1280,1440').split(',').map(Number);
const themes = (process.env.DAY_THEMES || 'light,dark').split(',');
const pageUrl = process.env.DAY_URL || pathToFileURL(path.join(root, 'index.html')).href;
const failures = [];
const measurements = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

async function inspect(page, label, fixture) {
  const state = await page.evaluate(() => {
    const grid = document.querySelector('#dayArea .day-grid');
    const bounds = element => {
      const r = element.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const days = [...grid.querySelectorAll('.day-item:not(.empty)')];
    const weekdays = [...grid.querySelectorAll('.day-wd')];
    return {
      grid: bounds(grid), parent: bounds(grid.parentElement), scrollWidth: grid.scrollWidth,
      role: grid.getAttribute('role'), name: grid.getAttribute('aria-label'), tabIndex: grid.tabIndex,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      weekdays: weekdays.map(element => ({ ...bounds(element), text: element.textContent, font: parseFloat(getComputedStyle(element).fontSize) })),
      blanks: grid.querySelectorAll('.day-item.empty').length,
      days: days.map(element => ({ ...bounds(element), day: Number(element.querySelector('.d-num').textContent),
        today: element.classList.contains('today'),
        text: [...element.children].map(child => ({ ...bounds(child), name: child.className,
          text: child.textContent.trim(), font: parseFloat(getComputedStyle(child).fontSize),
          innerOverflow: child.scrollWidth - child.clientWidth })),
      })),
    };
  });
  check(state.pageOverflow <= 1, `${label}: page overflows by ${state.pageOverflow}px`);
  check(state.role === 'region' && state.tabIndex === 0 && state.name?.includes('일운'), `${label}: calendar needs a named keyboard-scrollable region`);
  check(state.grid.width >= Math.min(900, state.parent.width - 2), `${label}: calendar still wastes available width (${state.grid.width}/${state.parent.width})`);
  check(state.weekdays.map(day => day.text).join('') === '일월화수목금토', `${label}: weekday order changed`);
  check(state.weekdays.every(day => day.font >= 14), `${label}: weekday labels are too small`);
  check(state.blanks === fixture.start && state.days.length === fixture.count, `${label}: month length/weekday placeholders changed`);
  for (const [index, day] of state.days.entries()) {
    check(day.day === index + 1, `${label}: date order changed`);
    check(day.width >= 71.5 && Math.abs(day.width - day.height) <= 1, `${label}: day ${day.day} needs a >=72px square (${day.width}x${day.height})`);
    check(Math.abs(day.width - state.days[0].width) <= 1, `${label}: unequal daily boxes`);
    const weekday = state.weekdays[(fixture.start + index) % 7];
    check(Math.abs(day.left - weekday.left) <= 1 && Math.abs(day.width - weekday.width) <= 1, `${label}: day ${day.day} moved out of its weekday column`);
    for (const [i, text] of day.text.entries()) {
      const minimum = text.name === 'd-han' ? 24 : text.name === 'd-num' ? 14 : 12;
      check(text.font >= minimum, `${label}: ${text.name} ${text.font}px is below ${minimum}px`);
      check(text.text.length > 0 && text.innerOverflow <= 1, `${label}: day ${day.day} text is missing or clipped`);
      check(Math.max(day.left - text.left, text.right - day.right, day.top - text.top, text.bottom - day.bottom) <= 1,
        `${label}: day ${day.day} ${text.name} exceeds its box`);
      if (text.name === 'd-han') check(Math.abs((text.top + text.bottom - day.top - day.bottom) / 2) <= 2,
        `${label}: day ${day.day} Hanja is not vertically centered`);
      for (const other of day.text.slice(0, i)) {
        check(Math.min(text.right, other.right) - Math.max(text.left, other.left) <= 1 ||
          Math.min(text.bottom, other.bottom) - Math.max(text.top, other.top) <= 1,
        `${label}: day ${day.day} ${text.name} overlaps ${other.name}`);
      }
    }
  }
  if (fixture.today) check(state.days.filter(day => day.today).map(day => day.day).join() === String(fixture.today), `${label}: current-day marker is missing`);
  if (fixture.firstPair) check(state.days[0].text.find(text => text.name === 'd-han').text.replace(/\s/g, '') === fixture.firstPair, `${label}: Hanja changed from the supplied August fixture`);

  const unreachable = await page.evaluate(() => {
    const grid = document.querySelector('#dayArea .day-grid');
    const outer = grid.getBoundingClientRect();
    const failures = [];
    for (const day of grid.querySelectorAll('.day-item:not(.empty)')) {
      grid.scrollLeft += day.getBoundingClientRect().left - outer.left;
      const box = day.getBoundingClientRect();
      if (box.left < outer.left - 1 || box.right > outer.right + 1) failures.push(day.querySelector('.d-num').textContent);
    }
    grid.scrollLeft = 0;
    return failures;
  });
  check(unreachable.length === 0, `${label}: dates cannot be scrolled fully into view: ${unreachable}`);
  await page.$eval('#dayArea .day-grid', element => element.focus());
  if (state.scrollWidth > state.grid.width + 1) {
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('#dayArea .day-grid').scrollLeft > 0, { timeout: 2000 }).catch(() => {
      failures.push(`${label}: keyboard cannot scroll the calendar`);
    });
  }
  await page.$eval('#dayArea .day-grid', async element => {
    // Finish the browser's native arrow-key scroll before restoring the initial
    // view; otherwise a later animation frame can crop Sunday in the screenshot.
    await new Promise(resolve => {
      let previous = -1;
      let stableFrames = 0;
      const settled = () => {
        stableFrames = element.scrollLeft === previous ? stableFrames + 1 : 0;
        previous = element.scrollLeft;
        if (stableFrames >= 10) resolve(); else requestAnimationFrame(settled);
      };
      settled();
    });
    element.scrollLeft = 0;
    element.blur();
  });
  measurements.push({ label, width: state.grid.width, cell: state.days[0].width, fonts: state.days[0].text.map(text => [text.name, text.font]), scrollWidth: state.scrollWidth });
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new', timeout: 20000 });
  const watchdog = setTimeout(() => { browser.process()?.kill(); process.exitCode = 1; }, 150000);
  try {
    for (const width of widths) for (const theme of themes) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewport({ width, height: 1050, deviceScaleFactor: 1 });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.evaluateOnNewDocument(value => localStorage.setItem('saju_theme', value), theme);
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.type('#inBirth', '19860219');
      await page.type('#inTime', '1430');
      await page.click('#calcBtn');
      await page.waitForSelector('#view-result.active .pillar-block');
      for (const selector of ['#daeunScroll .luck-item', '#seunScroll .luck-item', '#woonScroll .luck-item']) {
        await page.waitForSelector(selector);
        await page.$eval(selector, element => element.click());
      }
      await page.waitForSelector('#dayArea .day-grid');
      await page.evaluate(async () => { await document.fonts.ready; });
      // A supplied-image month, a month ending Monday, and the real current month
      // expose weekday/scroll endpoint and current-day regressions independently.
      const now = new Date();
      const fixtures = [
        { y: 2028, m: 8, count: 31, start: 2, firstPair: '戊午' },
        { y: 2026, m: 8, count: 31, start: 6 },
        { y: now.getFullYear(), m: now.getMonth() + 1, count: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), start: new Date(now.getFullYear(), now.getMonth(), 1).getDay(), today: now.getDate() },
      ];
      for (const fixture of fixtures) {
        await page.evaluate(({ y, m }) => { selectedWoon = { y, m }; renderDay(); }, fixture);
        await inspect(page, `${width}px ${theme} ${fixture.y}-${fixture.m}`, fixture);
        if (fixture.y === 2028) {
          const region = await page.$('#dayArea');
          await region.screenshot({ path: path.join(output, `${width}-${theme}.png`) });
        }
      }
      check(errors.length === 0, `${width}px ${theme}: JavaScript errors: ${errors.join('; ')}`);
      console.log(`[day] ${width}px ${theme}: inspected all three month fixtures`);
      await page.close();
    }
    fs.writeFileSync(path.join(output, 'measurements.json'), JSON.stringify({ measurements, failures: [...new Set(failures)] }, null, 2));
    assert.deepEqual([...new Set(failures)], [], 'Daily calendar readability violations');
    console.log(`Daily calendar readability PASS: ${widths.join(', ')}px; ${themes.join(', ')}`);
  } finally {
    clearTimeout(watchdog);
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

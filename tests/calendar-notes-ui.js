// Regressions caught here: notes keyed by day-of-month instead of full solar
// date; lost writes after reload; false success on storage failure; draft/XSS
// leakage; disconnected keyboard openers; and marks painted over calendar ink.
// The app, renderers, modal manager, calculations and storage are real. Only
// external networking and an explicit browser-storage failure are controlled.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const root = path.resolve(__dirname, '..');
const output = process.env.CALENDAR_NOTE_OUTPUT ? path.resolve(root, process.env.CALENDAR_NOTE_OUTPUT) : path.join(root, 'output', 'qa-calendar-notes');
const widths = (process.env.CALENDAR_NOTE_WIDTHS || '390,884,1280').split(',').map(Number);
const themes = (process.env.CALENDAR_NOTE_THEMES || 'light,dark').split(',');
const storageKey = 'jansang_calendar_notes_v1';
const savedDate = '2026-10-17';
const savedText = '홍길동 별세\n기록';
const editedText = '홍길동 별세\n기록 수정';
const reports = [];
const failures = [];

async function settle(page) {
  await page.evaluate(async () => {
    const bounded = promise => Promise.race([promise, new Promise(resolve => setTimeout(resolve, 1200))]);
    await bounded(document.fonts.ready);
    await bounded(Promise.allSettled(document.getAnimations()
      .filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime))
      .map(animation => animation.finished)));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

const daySelector = (date, container = '#calGrid') => `${container} [data-note-date="${date}"]`;

async function fillNote(page, text) {
  await page.click('#calendarNoteText');
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.type(text);
}

async function waitClosed(page) {
  await page.waitForFunction(() => !document.getElementById('calendarNoteModal').classList.contains('active'));
  await settle(page);
}

async function openDate(page, date, container = '#calGrid') {
  await page.waitForSelector(daySelector(date, container));
  await page.$eval(daySelector(date, container), element => element.scrollIntoView({ block: 'center', inline: 'center' }));
  await page.click(daySelector(date, container));
  await page.waitForSelector('#calendarNoteModal.active');
  await settle(page);
  const [year, month, day] = date.split('-').map(Number);
  const heading = await page.$eval('#calendarNoteDate', element => element.textContent);
  assert.match(heading, new RegExp(`${year}(?:년|[.\\-/])\\s*0?${month}(?:월|[.\\-/])\\s*0?${day}(?:일|(?:\\s|$))`),
    `Opening ${date} must display the complete solar year/month/day, not only day ${day}: ${heading}`);
  assert.equal(await page.$eval('#calendarNoteText', element => element.maxLength), 2000, 'Notes have an explicit bounded text input');
  return page.$eval('#calendarNoteText', element => element.value);
}

async function cancel(page) {
  await page.click('#calendarNoteCancel');
  await waitClosed(page);
}

async function save(page) {
  await page.click('#calendarNoteSave');
  await waitClosed(page);
}

async function removeNote(page, label) {
  await page.click('#calendarNoteDelete');
  await page.waitForFunction(() => {
    const prompt = document.getElementById('calendarNoteDeletePrompt');
    return prompt && !prompt.hidden && getComputedStyle(prompt).display !== 'none';
  });
  assert.ok(await page.$('#calendarNoteModal.active'), `${label}: first delete click must leave the note available until confirmation`);
  await page.click('#calendarNoteDelete');
  await waitClosed(page);
}

async function marked(page, date, container = '#calGrid') {
  return page.$eval(daySelector(date, container), element => ({
    class: element.classList.contains('has-date-note'),
    count: element.querySelectorAll('.date-note-mark').length,
  }));
}

async function assertMark(page, date, expected, label, container = '#calGrid') {
  const state = await marked(page, date, container);
  assert.deepEqual(state, { class: expected, count: expected ? 1 : 0 }, `${label}: ${date} saved-date indicator`);
}

async function assertKeyboardFocus(page, date, stateClass, label) {
  const focus = await page.evaluate(() => {
    const cell = document.activeElement;
    const style = getComputedStyle(cell);
    return { date: cell.dataset.noteDate, classes: [...cell.classList], visible: cell.matches(':focus-visible'),
      outline: style.outlineStyle, width: parseFloat(style.outlineWidth), color: style.outlineColor };
  });
  assert.equal(focus.date, date, `${label}: Tab focuses the intended exact calendar date`);
  assert.ok(focus.classes.includes(stateClass), `${label}: keyboard focus fixture must be ${stateClass}`);
  assert.ok(focus.visible && focus.outline !== 'none' && focus.width >= 2 && !/transparent|rgba\([^)]*,\s*0\)/.test(focus.color),
    `${label}: ${stateClass} date needs a visible keyboard focus indicator: ${JSON.stringify(focus)}`);
}

async function inspectMarker(page, date, container, label) {
  const state = await page.$eval(daySelector(date, container), element => {
    const rect = node => {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const mark = element.querySelector('.date-note-mark');
    const style = getComputedStyle(mark);
    // Existing date, ganji, lunar-date and relationship text must remain clear;
    // a dot/check gets its own corner, not a layer on top of those line boxes.
    const ink = [];
    const canvas = document.createElement('canvas').getContext('2d');
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let text;
    while ((text = walker.nextNode())) {
      if (mark.contains(text) || !text.textContent.trim()) continue;
      const range = document.createRange();
      const first = text.textContent.search(/\S/);
      const last = text.textContent.length - text.textContent.match(/\s*$/)[0].length;
      range.setStart(text, first);
      range.setEnd(text, last);
      const line = rect(range);
      const textStyle = getComputedStyle(text.parentElement);
      canvas.font = `${textStyle.fontStyle} ${textStyle.fontWeight} ${textStyle.fontSize} ${textStyle.fontFamily}`;
      canvas.textAlign = 'left';
      canvas.textBaseline = 'alphabetic';
      const metrics = canvas.measureText(text.textContent.slice(first, last));
      // Ranges include a font's blank ascender/descender area. Measure the
      // actual glyph ink relative to the real DOM baseline instead; zero-width
      // baseline probes neither replace text nor change the centered layout.
      const baselineProbe = document.createElement('span');
      baselineProbe.style.cssText = 'display:inline-block;width:0;height:0;margin:0;padding:0;border:0;line-height:0;font-size:0;vertical-align:baseline;';
      text.after(baselineProbe);
      const baseline = baselineProbe.getBoundingClientRect().top;
      baselineProbe.remove();
      ink.push({ name: text.parentElement.className, left: line.left - metrics.actualBoundingBoxLeft,
        right: line.left + metrics.actualBoundingBoxRight, top: baseline - metrics.actualBoundingBoxAscent,
        bottom: baseline + metrics.actualBoundingBoxDescent });
    }
    const readableText = [...element.children].filter(child => child !== mark).map(child => child.textContent.replace(/\s/g, '')).filter(Boolean);
    return { cell: rect(element), mark: rect(mark), ink, aria: (element.getAttribute('aria-label') || '').replace(/\s/g, ''), readableText,
      display: style.display, visibility: style.visibility,
      opacity: Number(style.opacity), text: mark.textContent, pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  assert.ok(state.mark.width > 0 && state.mark.height > 0 && state.display !== 'none' && state.visibility !== 'hidden' && state.opacity > 0,
    `${label}: saved-date marker must be visibly painted`);
  assert.ok(Math.max(state.cell.left - state.mark.left, state.mark.right - state.cell.right,
    state.cell.top - state.mark.top, state.mark.bottom - state.cell.bottom) <= 1,
  `${label}: saved-date marker must stay inside its own date cell`);
  for (const ink of state.ink) {
    const intersectionWidth = Math.min(state.mark.right, ink.right) - Math.max(state.mark.left, ink.left);
    const intersectionHeight = Math.min(state.mark.bottom, ink.bottom) - Math.max(state.mark.top, ink.top);
    assert.ok(intersectionWidth <= 1 || intersectionHeight <= 1,
      `${label}: saved-date marker overlaps ${ink.name} (${intersectionWidth.toFixed(2)}px x ${intersectionHeight.toFixed(2)}px); ${JSON.stringify({ mark: state.mark, text: ink })}`);
  }
  assert.ok(state.pageOverflow <= 1, `${label}: notes must not introduce page horizontal overflow (${state.pageOverflow}px)`);
  for (const text of state.readableText) {
    assert.ok(state.aria.includes(text), `${label}: the date button's accessible name must retain visible calendar information ${text}`);
  }
  assert.match(state.aria, /메모있음/, `${label}: the saved-date state must also be available to screen readers`);
  return state;
}

async function navigate(page, delta, year, month) {
  await page.click(delta > 0 ? '#calNext' : '#calPrev');
  await page.waitForFunction((y, m) => {
    const first = document.querySelector('#calGrid .cal-day.clickable');
    return first && Number(first.dataset.year) === y && Number(first.dataset.month) === m;
  }, {}, year, month);
  await settle(page);
}

async function shiftMonths(page, delta, count, startYear, startMonth) {
  let year = startYear;
  let month = startMonth;
  for (let index = 0; index < count; index++) {
    month += delta;
    if (month === 13) { month = 1; year++; }
    if (month === 0) { month = 12; year--; }
    await navigate(page, delta, year, month);
  }
}

async function dailyCalendar(page, label) {
  await page.click('#tab-input');
  await page.type('#inBirth', '19860219');
  await page.type('#inTime', '1430');
  await page.click('#calcBtn');
  await page.waitForSelector('#view-result.active .pillar-block');
  // Locate the real decade which contains the hand-chosen test year, then use
  // actual decade/year/month controls rather than invoke renderDay in a test.
  const decade = await page.evaluate(() => currentSaju.daeun.list.findIndex((item, index, list) => {
    const start = currentSaju.year + item.age;
    const end = list[index + 1] ? currentSaju.year + list[index + 1].age - 1 : start + 9;
    return start <= 2026 && end >= 2026;
  }));
  assert.ok(decade >= 0, `${label}: real calculated decade contains 2026`);
  await page.click(`#daeunScroll .luck-item[data-idx="${decade}"]`);
  await page.waitForSelector('#seunScroll .luck-item[data-year="2026"]');
  await page.click('#seunScroll .luck-item[data-year="2026"]');
  await page.waitForSelector('#woonScroll .luck-item[data-month="10"]');
  await page.click('#woonScroll .luck-item[data-month="10"]');
  await page.waitForSelector('#dayArea .day-grid');
  await settle(page);
  await assertMark(page, savedDate, true, label, '#dayArea');
  const note = await openDate(page, savedDate, '#dayArea');
  assert.equal(note, editedText, `${label}: daily and month calendars read the same exact-date note`);
  await fillNote(page, '일운에서 수정한 기록');
  await save(page);
  await assertMark(page, savedDate, true, label, '#dayArea');
  const geometry = await inspectMarker(page, savedDate, '#dayArea', `${label} daily`);
  await (await page.$('#dayArea')).screenshot({ path: path.join(output, `${label.replace(/ /g, '-')}-daily.png`) });
  await page.click('#tab-calendar');
  assert.equal(await openDate(page, savedDate), '일운에서 수정한 기록', `${label}: daily editor write refreshes the month-calendar source`);
  await cancel(page);
  return geometry;
}

async function inspect(browser, url, width, theme) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const label = `${width}px ${theme}`;
  const errors = [];
  const blockedRequests = [];
  const injectedImageRequests = [];
  const allowedOrigin = new URL(url).origin;
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width, height: 1050, deviceScaleFactor: 1, hasTouch: true, isMobile: width < 768 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument((nextTheme, key) => {
    // The calendar already supports this clock seam. A fixed local-noon date
    // makes year/month identities independent of the machine's timezone/date.
    window.__calendarNow = () => new Date(2026, 9, 1, 12, 0, 0);
    localStorage.setItem('saju_theme', nextTheme);
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key && window.__failCalendarNoteWrite) throw new DOMException('Calendar-note write blocked by test', 'QuotaExceededError');
      return setItem.call(this, name, value);
    };
  }, theme, storageKey);
  await page.setRequestInterception(true);
  page.on('request', request => {
    const target = new URL(request.url());
    if (target.pathname === '/calendar-note-xss') injectedImageRequests.push(request.url());
    if (target.origin === allowedOrigin || ['data:', 'blob:'].includes(target.protocol)) {
      request.continue().catch(() => {});
    } else {
      blockedRequests.push(request.url());
      request.respond({ status: 503, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"error":"offline-calendar-notes-test"}' }).catch(() => {});
    }
  });
  try {
    console.log(`[calendar-notes] ${label}: exact-date save without calculating saju`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForSelector('#tab-calendar');
    await page.click('#tab-calendar');
    await page.waitForSelector('#calGrid .cal-day.clickable');
    assert.equal(await page.evaluate(() => currentSaju), null, `${label}: notes work before entering birth data`);
    // The initial RED gate deliberately fails on the missing feature rather
    // than a page setup error or a guessed production-storage representation.
    assert.ok(await page.$('#calendarNoteModal'), `${label}: a date-note editor must exist`);
    assert.equal(await openDate(page, savedDate), '', `${label}: unsaved date opens an empty draft`);
    assert.match(await page.$eval('#calDayDetail', element => element.textContent), /2026년\s*10월\s*17일/, `${label}: existing date selection/detail survives opening notes`);
    assert.equal(await page.$eval('#calendarNoteDelete', element => element.hidden || getComputedStyle(element).display === 'none'), true, `${label}: unsaved dates do not offer a misleading delete action`);
    await fillNote(page, savedText);
    await page.screenshot({ path: path.join(output, `${width}-${theme}-editor.png`) });
    await save(page);
    await assertMark(page, savedDate, true, label);
    assert.equal(await page.$eval('#calDayDetail .calendar-note-preview', element => element.textContent), savedText,
      `${label}: saved note is readable in the selected-date detail without reopening the editor`);
    const calendarGeometry = await inspectMarker(page, savedDate, '#calGrid', `${label} calendar`);
    await (await page.$('#view-calendar')).screenshot({ path: path.join(output, `${width}-${theme}-calendar.png`) });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.click('#tab-calendar');
    await assertMark(page, savedDate, true, `${label} reloaded`);
    assert.equal(await openDate(page, savedDate), savedText, `${label}: saved Korean multiline text survives page reload`);
    await cancel(page);

    console.log(`[calendar-notes] ${label}: same day does not repeat in another month or year`);
    await navigate(page, 1, 2026, 11);
    await assertMark(page, '2026-11-17', false, label);
    assert.equal(await openDate(page, '2026-11-17'), '', `${label}: November 17 must not repeat October 17's note`);
    await cancel(page);
    await navigate(page, -1, 2026, 10);
    await shiftMonths(page, 1, 12, 2026, 10);
    await assertMark(page, '2027-10-17', false, label);
    assert.equal(await openDate(page, '2027-10-17'), '', `${label}: next year's October 17 must not repeat this year's note`);
    await cancel(page);
    await shiftMonths(page, -1, 12, 2027, 10);

    console.log(`[calendar-notes] ${label}: edit/cancel and literal text safety`);
    assert.equal(await openDate(page, savedDate), savedText, `${label}: returning to the exact date restores the note`);
    await fillNote(page, editedText);
    await save(page);
    assert.equal(await openDate(page, savedDate), editedText, `${label}: edit replaces the exact saved note`);
    await fillNote(page, '취소하면 저장되지 않는 임시 내용');
    await cancel(page);
    assert.equal(await openDate(page, savedDate), editedText, `${label}: cancelling a draft leaves saved text unchanged`);
    await cancel(page);
    const unsafeText = '<img src="/calendar-note-xss" onerror="window.__calendarNoteXss=1">\n문자 그대로 <b>기록</b>';
    await openDate(page, '2026-10-18');
    await fillNote(page, unsafeText);
    await save(page);
    assert.equal(await page.$eval('#calDayDetail .calendar-note-preview', element => element.textContent), unsafeText,
      `${label}: selected-date preview displays markup literally, not as formatted HTML`);
    assert.equal(await openDate(page, '2026-10-18'), unsafeText, `${label}: note markup remains literal saved text`);
    await cancel(page);
    await settle(page);
    assert.equal(await page.evaluate(() => window.__calendarNoteXss), undefined, `${label}: saved HTML must never execute`);
    assert.equal(await page.$$eval('img[src="/calendar-note-xss"]', elements => elements.length), 0, `${label}: saved text must never create an image element`);
    assert.deepEqual(injectedImageRequests, [], `${label}: literal note text must not issue image requests`);
    await openDate(page, '2026-10-18');
    await page.click('#calendarNoteDelete');
    await page.waitForFunction(() => !document.getElementById('calendarNoteDeletePrompt').hidden);
    await cancel(page);
    await assertMark(page, '2026-10-18', true, `${label} cancelled delete`);
    assert.equal(await openDate(page, '2026-10-18'), unsafeText, `${label}: cancelling delete confirmation preserves the saved note`);
    assert.equal(await page.$eval('#calendarNoteDeletePrompt', element => element.hidden), true, `${label}: reopening a note starts a fresh, unarmed delete confirmation`);
    await removeNote(page, label);
    await assertMark(page, '2026-10-18', false, label);
    await assertMark(page, savedDate, true, `${label}: deleting a neighbouring note preserves the original`);

    console.log(`[calendar-notes] ${label}: storage failure cannot produce a false saved mark`);
    await openDate(page, '2026-10-19');
    await fillNote(page, '저장 실패일 때는 체크하지 않기');
    await page.evaluate(() => { window.__failCalendarNoteWrite = true; });
    await page.click('#calendarNoteSave');
    await page.waitForFunction(() => [...document.querySelectorAll('#appToast.show, [role="alert"]')].some(element => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && /저장|저장소/.test(element.textContent) && /실패|못|없|오류/.test(element.textContent);
    }));
    await assertMark(page, '2026-10-19', false, label);
    assert.equal(await page.evaluate(key => (localStorage.getItem(key) || '').includes('저장 실패일 때는 체크하지 않기'), storageKey), false,
      `${label}: failed browser write does not persist the draft`);
    await page.evaluate(() => { window.__failCalendarNoteWrite = false; });
    if (await page.$('#calendarNoteModal.active')) await cancel(page);
    assert.equal(await openDate(page, '2026-10-19'), '', `${label}: failed write is not cached as a saved note`);
    await cancel(page);

    console.log(`[calendar-notes] ${label}: keyboard activation, focus trap and Escape return`);
    await page.focus(daySelector(savedDate));
    await page.keyboard.press('Enter');
    await page.waitForSelector('#calendarNoteModal.active');
    await settle(page);
    assert.equal(await page.$eval('#calendarNoteText', element => element.value), editedText, `${label}: Enter opens the focused exact date`);
    for (let index = 0; index < 9; index++) {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.getElementById('calendarNoteModal').contains(document.activeElement)), true, `${label}: Tab keeps focus in the note editor`);
    }
    await page.keyboard.down('Shift');
    await page.keyboard.press('Tab');
    await page.keyboard.up('Shift');
    assert.equal(await page.evaluate(() => document.getElementById('calendarNoteModal').contains(document.activeElement)), true, `${label}: reverse Tab keeps focus in the note editor`);
    await page.keyboard.press('Escape');
    await waitClosed(page);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.noteDate), savedDate, `${label}: Escape returns focus to the newly rendered date opener`);
    await assertKeyboardFocus(page, savedDate, 'selected', `${label} Escape return`);
    await page.focus('#calNext');
    await page.keyboard.press('Tab');
    await assertKeyboardFocus(page, '2026-10-01', 'today', label);
    for (let index = 0; index < 16; index++) await page.keyboard.press('Tab');
    await assertKeyboardFocus(page, savedDate, 'selected', label);

    const dailyGeometry = await dailyCalendar(page, label);

    if (width === 390 && theme === 'light') {
      console.log('[calendar-notes] outgoing month cell retains its rendered date during transition');
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'no-preference' }]);
      // Both native DOM click events occur in one browser task, before the
      // outgoing-grid animation finishes. The ordinary flow above uses actual
      // pointer/keyboard input; this deliberately atomic race is otherwise
      // nondeterministic on a loaded CI machine. Neither handler is mocked.
      await page.evaluate(() => {
        const outgoing = document.querySelector('#calGrid [data-note-date="2026-10-22"]');
        document.getElementById('calNext').click();
        outgoing.click();
      });
      await page.waitForSelector('#calendarNoteModal.active');
      await settle(page);
      const transitionHeading = await page.$eval('#calendarNoteDate', element => element.textContent);
      assert.match(transitionHeading, /2026(?:년|[.\-/])\s*10(?:월|[.\-/])\s*22/, 'Outgoing October cell must not become November when the month state has already shifted');
      await fillNote(page, '전환 중 클릭한 원래 날짜');
      await save(page);
      await assertMark(page, '2026-10-22', true, 'Outgoing date snapshot');
      await navigate(page, 1, 2026, 11);
      await assertMark(page, '2026-11-22', false, 'Outgoing date snapshot');
      await navigate(page, -1, 2026, 10);
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
    }

    console.log(`[calendar-notes] ${label}: delete is persistent and date-scoped`);
    await openDate(page, savedDate);
    assert.equal(await page.$eval('#calendarNoteDelete', element => element.hidden || getComputedStyle(element).display === 'none'), false, `${label}: saved dates offer deletion`);
    await removeNote(page, label);
    await assertMark(page, savedDate, false, label);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.click('#tab-calendar');
    await assertMark(page, savedDate, false, `${label} deleted/reloaded`);
    assert.equal(await openDate(page, savedDate), '', `${label}: deleted note stays deleted after reload`);
    await cancel(page);
    assert.deepEqual(errors, [], `${label}: no unexpected browser JavaScript errors`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${label}: calendar editor has horizontal page overflow`);
    reports.push({ label, calendarGeometry, dailyGeometry, blockedExternalRequests: blockedRequests.length, errors });
    console.log(`[calendar-notes] PASS ${label}`);
  } catch (error) {
    await settle(page).catch(() => {});
    await page.screenshot({ path: path.join(output, `${width}-${theme}-failure.png`) }).catch(() => {});
    failures.push(`${label}: ${error.message}`);
    console.error(`[calendar-notes] FAIL ${label}: ${error.message}`);
  } finally {
    await context.close();
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  let server;
  let browser;
  let watchdog;
  try {
    let url = process.env.TEST_URL || process.env.CALENDAR_NOTE_URL;
    if (!url) {
      server = http.createServer((request, response) => {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
        if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
        fs.readFile(file, (error, contents) => {
          if (error) { response.writeHead(404).end(); return; }
          const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
            '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
          response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
          response.end(contents);
        });
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      url = `http://127.0.0.1:${server.address().port}/index.html`;
    }
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', timeout: 20000 });
    watchdog = setTimeout(() => { console.error('[calendar-notes] browser deadline exceeded'); browser.process()?.kill(); process.exitCode = 1; }, 240000);
    for (const width of widths) for (const theme of themes) await inspect(browser, url, width, theme);
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ reports, failures }, null, 2));
    assert.deepEqual(failures, [], 'Calendar date-note browser regressions');
    console.log(`Calendar notes UI PASS: ${widths.length * themes.length} viewport/theme cases`);
  } finally {
    clearTimeout(watchdog);
    if (browser) await browser.close();
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

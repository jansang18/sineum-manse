const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const root = path.resolve(__dirname, '..');
const place = (n = 1, confidence = 'exact') => ({
  id: `kakao:${n}`, provider: 'kakao', name: `준비 테스트 아파트 ${n}`,
  displayName: `서울 강남구 선릉로 ${n}`, parcelAddress: `서울 강남구 도곡동 ${n}`,
  roadAddress: `서울 강남구 선릉로 ${n}`, lat: 37.49, lng: 127.05,
  type: '아파트', ...(confidence ? { confidence } : {}),
});
const records = (count = 46, differing = false) => Array.from({ length: count }, (_, n) => ({
  buildingId: `registry-${n}`, buildingName: '준비 테스트 아파트 1', dongName: `${n + 101}동`,
  parcelAddress: '서울 강남구 도곡동 1', approvalDate: differing && n === 45 ? '2007-02-28' : '2006-01-27',
  source: '국토교통부 건축HUB', fetchedAt: '2026-09-08T12:00:00.000Z',
}));
const body = (count = 46, differing = false) => ({ status: count === 1 ? 'found' : 'multiple', records: records(count, differing) });
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const setValue = (page, id, value) => page.$eval(`#${id}`, (element, next) => {
  element.value = next;
  element.dispatchEvent(new Event('input', { bubbles: true }));
}, value);
const lookupRequests = page => page.evaluate(() => window.__lookupRequests.map(({ action, parcelAddress, aborted, cache }) => ({ action, parcelAddress, aborted, cache })));
const registryRequests = async page => (await lookupRequests(page)).filter(row => row.action === 'registry');
const replyRegistry = (page, index, payload = body(), status = 200) => page.evaluate((index, payload, status) => {
  window.__lookupRequests.filter(row => row.action === 'registry')[index].resolve(new Response(JSON.stringify(payload), {
    status, headers: { 'Content-Type': 'application/json' },
  }));
}, index, payload, status);
const inputState = page => page.evaluate(() => ({
  name: document.getElementById('inputName').value, birth: document.getElementById('inBirth').value,
  time: document.getElementById('inTime').value, calendar: document.querySelector('#segCal .active').dataset.val,
  gender: document.querySelector('#segGender .active').dataset.val, tab: document.querySelector('.tab.active').dataset.tab,
  clicks: window.__lookupCalcClicks,
}));

async function search(page, matches = [place(), place(2, 'close')]) {
  await page.evaluate(matches => { window.__lookupPlaces = matches; }, matches);
  await setValue(page, 'buildingQuery', '준비 테스트 아파트');
  await page.click('#buildingSearchBtn');
  await page.waitForFunction(() => !document.getElementById('buildingSearchBtn').disabled);
  await settle(page);
}

async function prepare(page, matches) {
  await search(page, matches);
  assert.equal((await registryRequests(page)).length, 1, 'one registry request starts before any candidate selection');
  assert.equal(await page.evaluate(() => window.__lookupCalcClicks), 0, 'preparation never calculates a chart');
}

async function freshPage(browser, baseUrl) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === baseUrl || url.protocol === 'data:') request.continue();
    else request.abort();
  });
  await page.evaluateOnNewDocument(() => {
    const originalFetch = window.fetch.bind(window);
    const startedAt = Date.now();
    const originalSetTimeout = window.setTimeout.bind(window);
    const originalClearTimeout = window.clearTimeout.bind(window);
    let offset = 0;
    let timerId = -1;
    const longTimers = new Map();
    Date.now = () => startedAt + offset;
    window.setTimeout = (fn, ms, ...args) => {
      if (ms < 30000) return originalSetTimeout(fn, ms, ...args);
      const id = timerId--;
      longTimers.set(id, { fn: () => fn(...args), due: Date.now() + ms });
      return id;
    };
    window.clearTimeout = id => { longTimers.delete(id); originalClearTimeout(id); };
    window.__advanceLookupClock = ms => {
      offset += ms;
      for (const [id, timer] of longTimers) if (timer.due <= Date.now()) { longTimers.delete(id); timer.fn(); }
    };
    window.__lookupRequests = [];
    window.__lookupPlaces = [];
    window.fetch = (input, options = {}) => {
      const url = new URL(input, location.href);
      if (!url.pathname.endsWith('/manseBuildingLookup')) return originalFetch(input, options);
      const request = {
        action: url.searchParams.get('action'), parcelAddress: url.searchParams.get('parcelAddress'),
        aborted: false, cache: options.cache,
      };
      window.__lookupRequests.push(request);
      options.signal?.addEventListener('abort', () => { request.aborted = true; }, { once: true });
      if (request.action === 'search') return Promise.resolve(Response.json({ mode: 'hybrid', results: window.__lookupPlaces }));
      // The provider deliberately ignores abort, proving the real UI rejects late responses too.
      return new Promise(resolve => { request.resolve = resolve; });
    };
  });
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#buildingLookup');
  await page.evaluate(() => {
    window.__lookupCalcClicks = 0;
    document.getElementById('calcBtn').addEventListener('click', () => { ++window.__lookupCalcClicks; }, true);
  });
  await setValue(page, 'inBirth', '19890319');
  await setValue(page, 'inTime', '1430');
  await page.click('#buildingLookup summary');
  return page;
}

const scenarios = [
  ['pending selection transfers the first request without duplicates', async page => {
    await prepare(page);
    await page.click('#buildingPlaces button');
    assert.equal((await registryRequests(page)).length, 1);
    assert.equal((await registryRequests(page))[0].aborted, false, 'promoted work must not be cancelled');
    await replyRegistry(page, 0);
    await page.waitForFunction(() => document.querySelectorAll('#buildingRecords option').length === 47);
    assert.equal(await page.evaluate(() => window.__lookupCalcClicks), 0, '46 dong still require explicit selection');
    await page.select('#buildingRecords', '45');
    assert.equal((await inputState(page)).birth, '20060127');
    assert.equal((await inputState(page)).clicks, 1);
    assert.ok((await lookupRequests(page)).every(row => row.cache === 'no-store'));
  }],
  ['ready shared dates preview without selecting, then reuse', async page => {
    await page.evaluate(() => {
      window.__lookupStorageWrites = [];
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        window.__lookupStorageWrites.push(key);
        return setItem.call(this, key, value);
      };
    });
    await prepare(page);
    await replyRegistry(page, 0);
    await settle(page);
    const buttons = await page.$$eval('#buildingPlaces button', elements => elements.map(element => element.textContent));
    assert.match(buttons[0], /2006[.-]01[.-]27/);
    assert.match(buttons[0], /46/);
    assert.doesNotMatch(buttons[1], /2006[.-]01[.-]27/);
    assert.equal((await inputState(page)).clicks, 0);
    assert.deepEqual(await page.evaluate(() => window.__lookupStorageWrites), [], 'preparation writes no persistent or session state');
    for (const width of [320, 390, 720, 884, 1280]) {
      await page.setViewport({ width, height: 844, deviceScaleFactor: 1 });
      await settle(page);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}: preview causes no horizontal overflow`);
      assert.ok(await page.$$eval('#buildingPlaces button', elements => elements.every(element => element.getBoundingClientRect().height >= 44)), `${width}: candidate touch targets remain usable`);
      if (width === 390 || width === 1280) {
        const folder = path.join(root, 'output', 'qa-building-lookup');
        fs.mkdirSync(folder, { recursive: true });
        await page.screenshot({ path: path.join(folder, `prepared-${width}.png`), fullPage: true });
      }
    }
    await page.click('#buildingPlaces button');
    await settle(page);
    assert.equal((await registryRequests(page)).length, 1);
    assert.equal(await page.$eval('#buildingRecords', element => element.value), '');
  }],
  ['different dong dates show a count, not one misleading date', async page => {
    await prepare(page);
    await replyRegistry(page, 0, body(46, true));
    await settle(page);
    const text = await page.$eval('#buildingPlaces button', element => element.textContent);
    assert.match(text, /46/);
    assert.doesNotMatch(text, /2006[.-]01[.-]27|2007[.-]02[.-]28/);
    assert.equal((await inputState(page)).clicks, 0);
  }],
  ['choosing another address cancels the prepared work', async page => {
    await prepare(page);
    await page.click('#buildingPlaces button:nth-child(2)');
    const requests = await registryRequests(page);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].aborted, true);
    assert.equal(requests[1].parcelAddress, '서울 강남구 도곡동 2');
    await replyRegistry(page, 0, body(1));
    await settle(page);
    assert.equal((await inputState(page)).clicks, 0, 'late first candidate never opens a chart');
    await replyRegistry(page, 1);
    await page.waitForFunction(() => document.querySelectorAll('#buildingRecords option').length === 47);
  }],
  ['ready state expires after 30 seconds and selection requests a fresh date', async page => {
    await prepare(page);
    await replyRegistry(page, 0);
    await settle(page);
    await page.evaluate(() => window.__advanceLookupClock(29999));
    await settle(page);
    assert.match(await page.$eval('#buildingPlaces button', element => element.textContent), /2006[.-]01[.-]27/);
    await page.evaluate(() => window.__advanceLookupClock(2));
    await settle(page);
    assert.doesNotMatch(await page.$eval('#buildingPlaces button', element => element.textContent), /2006[.-]01[.-]27/);
    assert.equal((await registryRequests(page)).length, 1, 'expiry never starts an automatic retry');
    await page.click('#buildingPlaces button');
    assert.equal((await registryRequests(page)).length, 2);
  }],
  ['repeating an explicit search never reuses previous prepared results', async page => {
    await prepare(page);
    await replyRegistry(page, 0);
    await settle(page);
    await page.click('#buildingSearchBtn');
    await settle(page);
    assert.equal((await registryRequests(page)).length, 2);
    assert.doesNotMatch(await page.$eval('#buildingPlaces button', element => element.textContent), /2006[.-]01[.-]27/);
  }],
  ['a close first candidate is eligible for one prepared request', async page => {
    await prepare(page, [place(1, 'close'), place(2)]);
    assert.equal((await registryRequests(page))[0].parcelAddress, '서울 강남구 도곡동 1');
  }],
  ['pending preparation expires without allowing its late response to return', async page => {
    await prepare(page);
    await page.evaluate(() => window.__advanceLookupClock(30001));
    assert.equal((await registryRequests(page))[0].aborted, true);
    await replyRegistry(page, 0, body(1));
    await settle(page);
    assert.doesNotMatch(await page.$eval('#buildingPlaces button', element => element.textContent), /2006[.-]01[.-]27/);
    assert.equal((await inputState(page)).clicks, 0);
  }],
];

for (const confidence of ['broad', undefined, 'untrusted']) scenarios.push([
  `first ${confidence || 'missing'} confidence never prepares another candidate`, async page => {
    const first = place(1, confidence || null);
    await search(page, [first, place(2)]);
    assert.equal((await registryRequests(page)).length, 0);
    await page.click('#buildingPlaces button');
    assert.equal((await registryRequests(page)).length, 1, 'manual selection remains available');
  },
]);
for (const [name, payload, status] of [
  ['no result', { status: 'not-found', records: [] }, 200],
  ['invalid date', { status: 'found', records: [{ ...records(1)[0], approvalDate: '2025-02-30' }] }, 200],
  ['rate limited', { error: 'rate-limited' }, 429],
]) scenarios.push([`${name} cannot become a date or cause a background retry`, async page => {
  await prepare(page);
  await replyRegistry(page, 0, payload, status);
  await settle(page);
  assert.doesNotMatch(await page.$eval('#buildingPlaces button', element => element.textContent), /2006[.-]01[.-]27|2025[.-]02[.-]30/);
  await page.click('#buildingPlaces button');
  await settle(page);
  assert.equal((await registryRequests(page)).length, 1, 'foreground consumes current outcome, including 429');
  assert.equal((await inputState(page)).clicks, 0);
  assert.equal(await page.$eval('#buildingSearchBtn', element => element.disabled), false);
  if (status === 429) assert.match(await page.$eval('#buildingStatus', element => element.textContent), /1분/);
}]);
for (const ready of [false, true]) for (const change of ['query', 'name', 'birth', 'time', 'calendar', 'gender', 'tab', 'close']) {
  scenarios.push([`${ready ? 'ready' : 'pending'} preparation is discarded on ${change}`, async page => {
    await prepare(page);
    if (ready) { await replyRegistry(page, 0, body(1)); await settle(page); }
    if (change === 'query') await setValue(page, 'buildingQuery', '새 주소');
    if (change === 'name') await setValue(page, 'inputName', '내 이름');
    if (change === 'birth') await setValue(page, 'inBirth', '19901120');
    if (change === 'time') await setValue(page, 'inTime', '0830');
    if (change === 'calendar') await page.click('#segCal [data-val="lunar"]');
    if (change === 'gender') await page.click('#segGender [data-val="F"]');
    if (change === 'tab') await page.click('#tab-calendar');
    if (change === 'close') await page.click('#buildingLookup summary');
    await settle(page);
    const edited = await inputState(page);
    assert.equal(edited.clicks, 0);
    if (!ready) { await replyRegistry(page, 0, body(1)); await settle(page); }
    assert.deepEqual(await inputState(page), edited, 'late result cannot overwrite manual data or navigation');
    assert.equal(await page.$$eval('#buildingPlaces button', elements => elements.length), 0, 'cancelled candidate and preview are removed');
    assert.equal(await page.$eval('#buildingSearchBtn', element => element.disabled), false);
  }]);
}

(async () => {
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(`${root}${path.sep}`)) return response.writeHead(403).end();
    fs.readFile(file, (error, data) => {
      if (error) response.writeHead(404).end();
      else response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const failures = [];
  try {
    for (const [name, check] of scenarios) {
      const page = await freshPage(browser, `http://127.0.0.1:${server.address().port}`);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try { await check(page); assert.deepEqual(errors, []); console.log(`PASS ${name}`); }
      catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
      finally { await page.close(); }
    }
    assert.deepEqual(failures, []);
    console.log(`Building lookup preparation UI PASS: ${scenarios.length} cases`);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

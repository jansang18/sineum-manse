const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const root = path.resolve(__dirname, '..');
const expectedDate = '2006-01-27';
const query = '도곡렉슬아파트';
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp',
};

async function bounded(promise, timeoutMs, fallback) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise(resolve => { timer = setTimeout(() => resolve(fallback), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

const stage = message => console.log(`[building live] ${message}`);

async function createLocalServer() {
  const server = http.createServer((request, response) => {
    const requestedPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${requestedPath === '/' ? '/index.html' : requestedPath}`);
    if (!file.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) response.writeHead(404).end();
      else {
        response.writeHead(200, {
          'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        response.end(data);
      }
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(8765, '127.0.0.1', resolve);
  });
  return server;
}

(async () => {
  let server;
  let browser;
  let page;
  const responseChecks = [];
  const gatewayResponses = [];
  const pageErrors = [];
  const networkFailures = [];
  const consoleErrors = [];
  const started = new WeakMap();
  const networkRequests = new Map();
  try {
    if (!process.env.BUILDING_BASE_URL) server = await createLocalServer();
    const base = process.env.BUILDING_BASE_URL || 'http://127.0.0.1:8765/index.html';
    const pageUrl = new URL(base);
    pageUrl.searchParams.set('building-live', String(Date.now()));
    const gatewayOverride = process.env.BUILDING_GATEWAY_URL
      ? new URL(process.env.BUILDING_GATEWAY_URL) : null;

    browser = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
    });
    page = await browser.newPage();
    page.setDefaultTimeout(40000);
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('request', request => {
      if (request.url().includes('/manseBuildingLookup')) started.set(request, Date.now());
    });
    page.on('requestfailed', request => {
      if (request.url().includes('/manseBuildingLookup')) {
        networkFailures.push({ type: 'requestfailed', url: request.url(), error: request.failure()?.errorText });
      }
    });
    const cdp = await page.createCDPSession();
    cdp.on('Network.requestWillBeSent', event => {
      if (event.request.url.includes('/manseBuildingLookup')) networkRequests.set(event.requestId, event.request.url);
    });
    cdp.on('Network.loadingFailed', event => {
      if (networkRequests.has(event.requestId)) {
        networkFailures.push({ type: 'loadingFailed', url: networkRequests.get(event.requestId),
          error: event.errorText, canceled: event.canceled, blockedReason: event.blockedReason,
          corsErrorStatus: event.corsErrorStatus });
      }
    });
    await cdp.send('Network.enable');
    if (gatewayOverride) {
      await page.setRequestInterception(true);
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.pathname.endsWith('/manseBuildingLookup')) {
          const rewritten = new URL(gatewayOverride);
          rewritten.search = url.search;
          request.continue({ url: rewritten.toString() }).catch(() => {});
        } else request.continue().catch(() => {});
      });
    }
    page.on('response', response => {
      if (!new URL(response.url()).pathname.endsWith('/manseBuildingLookup')) return;
      const url = new URL(response.url());
      const inspection = {
        url: response.url(),
        action: url.searchParams.get('action'),
        query: url.searchParams.get('q'),
        status: response.status(),
        endpointOrigin: url.origin,
        transportOrigin: gatewayOverride?.origin || url.origin,
        allowedOrigin: response.headers()['access-control-allow-origin'] || null,
        contentType: response.headers()['content-type'] || null,
        requestId: response.headers()['x-nf-request-id'] || null,
        elapsedMs: Date.now() - (started.get(response.request()) || Date.now()),
      };
      gatewayResponses.push(inspection);
      stage(`${inspection.action} HTTP ${inspection.status}; CORS ${inspection.allowedOrigin}`);
      responseChecks.push((async () => {
        let body;
        let rawBody = null;
        try {
          rawBody = await bounded(response.text(), 5000, null);
          if (rawBody !== null) body = JSON.parse(rawBody);
        } catch (_) { body = null; }
        Object.assign(inspection, {
          mode: body?.mode || null,
          resultCount: body?.results?.length ?? null,
          recordCount: body?.records?.length ?? null,
          registryStatus: body?.status || null,
          bodyRead: rawBody !== null,
          ...(response.status() >= 400 ? { errorBody: rawBody?.slice(0, 2000) || null } : {}),
        });
      })());
    });

    stage(`open ${pageUrl.toString()}`);
    await page.goto(pageUrl.toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#buildingLookup');
    if (!(await page.$eval('#buildingLookup', element => element.open))) await page.click('#buildingLookup summary');
    await page.type('#buildingQuery', query);
    assert.equal(await page.$eval('#buildingQuery', element => element.value), query);
    stage(`search ${query}`);
    await page.click('#buildingSearchBtn');
    await page.waitForFunction(() => !document.getElementById('buildingSearchBtn').disabled);
    const matches = await page.$$('#buildingPlaces button');
    let matched;
    for (const button of matches) {
      if (await button.evaluate(element => /도곡.*렉슬/.test(element.textContent))) {
        matched = button;
        break;
      }
    }
    assert.ok(matched, `live geocoding returns the requested building; UI: ${await page.$eval('#buildingStatus', element => element.textContent)}`);
    let preparedPreview = null;
    if (process.env.BUILDING_WAIT_PREPARED === '1') {
      await page.waitForFunction(() => document.querySelector('#buildingPlaces .building-prepared')?.textContent.includes('2006.01.27'));
      preparedPreview = await page.$eval('#buildingPlaces .building-prepared', element => element.textContent);
      assert.equal(await page.$eval('.tab.active', element => element.dataset.tab), 'input', 'a prepared date never opens an unselected chart');
      assert.equal(await page.$eval('#inBirth', element => element.value), '', 'a prepared date never overwrites the birth input');
      stage(`prepared before selection: ${preparedPreview}`);
    }
    const matchedAddress = await matched.evaluate(element => element.textContent.trim());
    stage(`select address ${matchedAddress}`);
    const selectedAt = Date.now();
    await matched.click();
    await page.waitForFunction(() => !document.getElementById('buildingSearchBtn').disabled);
    const selectionWaitMs = Date.now() - selectedAt;
    const options = await page.$eval('#buildingRecords', element => [...element.options]
      .filter(option => option.value !== '')
      .map(option => ({ value: option.value, label: option.textContent })));
    assert.equal(options.length, 46, 'the current building registry returns 46 buildings/dongs');
    assert.equal(await page.$eval('#buildingRecords', element => element.value), '', 'a multi-building address awaits explicit dong selection');
    stage(`select dong ${options[0].label}`);
    await page.select('#buildingRecords', options[0].value);
    await page.waitForFunction(() => document.querySelector('.tab.active')?.dataset.tab === 'result');
    await page.waitForFunction(() => window.scrollY === 0);

    const chart = await page.evaluate(() => {
      const name = document.querySelector('#view-result .name').getBoundingClientRect();
      const tabs = document.querySelector('.tabs').getBoundingClientRect();
      return {
        inputDate: document.getElementById('inBirth').value,
        inputTime: document.getElementById('inTime').value,
        calendar: document.querySelector('#segCal .active').dataset.val,
        name: currentSaju.name,
        unknown: currentSaju.unknown,
        date: [currentSaju.year, String(currentSaju.month).padStart(2, '0'), String(currentSaju.day).padStart(2, '0')].join('-'),
        registry: currentSaju.buildingRegistry,
        nameTop: name.top,
        tabsBottom: tabs.bottom,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      };
    });
    assert.equal(chart.date, expectedDate);
    assert.equal(chart.inputDate, expectedDate.replace(/-/g, ''));
    assert.equal(chart.inputTime, '');
    assert.equal(chart.calendar, 'solar');
    assert.equal(chart.unknown, true);
    assert.match(chart.registry.buildingName, /도곡.*렉슬/);
    assert.ok(chart.registry.dongName, 'selected real dong is kept on the chart');
    assert.ok(chart.name.includes(chart.registry.buildingName) && chart.name.includes(chart.registry.dongName));
    assert.equal(chart.registry.approvalDate, expectedDate);
    assert.equal(chart.registry.source, '국토교통부 건축HUB');
    assert.ok(chart.nameTop >= chart.tabsBottom - 1, 'building title remains visible below navigation');
    assert.ok(chart.documentWidth <= chart.viewportWidth + 1, 'live chart has no horizontal page overflow');
    const output = path.join(root, 'output', 'qa-building-lookup');
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'live-390.png'), fullPage: true });
    await bounded(Promise.allSettled(responseChecks), 6000, null);
    assert.ok(gatewayResponses.some(response => response.action === 'search' && response.status === 200));
    assert.ok(gatewayResponses.some(response => response.action === 'registry' && response.status === 200));
    assert.equal(gatewayResponses.filter(response => response.action === 'registry').length, 1, 'prepared selection must not duplicate the official registry request');
    assert.deepEqual(pageErrors, [], 'live browser has no page errors');
    console.log(JSON.stringify({
      result: 'Building lookup LIVE PASS 390px',
      pageOrigin: pageUrl.origin,
      matchedAddress,
      selectedDong: chart.registry.dongName,
      approvalDate: chart.registry.approvalDate,
      preparedPreview,
      selectionWaitMs,
      gatewayResponses,
      screenshot: path.join(output, 'live-390.png'),
    }, null, 2));
  } catch (error) {
    let visibleState = null;
    let samePageRetry = null;
    if (page && !page.isClosed()) {
      visibleState = await bounded(page.evaluate(() => ({
        url: location.href,
        ready: document.readyState,
        status: document.getElementById('buildingStatus')?.textContent,
        query: document.getElementById('buildingQuery')?.value,
        tab: document.querySelector('.tab.active')?.dataset.tab,
      })).catch(() => null), 3000, null);
      const failed = gatewayResponses.find(response => response.action === 'registry' && response.status >= 400);
      if (failed) {
        stage('diagnostic: raw fetch of the exact failed registry URL from the same page');
        samePageRetry = await bounded(page.evaluate(async url => {
          const start = Date.now();
          try {
            const response = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'omit',
              cache: 'no-store', signal: AbortSignal.timeout(12000) });
            const text = await response.text();
            let body;
            try { body = JSON.parse(text); } catch (_) {}
            return { url, status: response.status, elapsedMs: Date.now() - start,
              count: body?.records?.length || 0,
              ...(response.ok ? {} : { errorBody: text.slice(0, 2000) }) };
          } catch (retryError) {
            return { url, elapsedMs: Date.now() - start, error: `${retryError.name}: ${retryError.message}` };
          }
        }, failed.url).catch(retryError => ({ error: retryError.message })), 15000, { error: 'diagnostic timed out' });
      }
    }
    await bounded(Promise.allSettled(responseChecks), 6000, null);
    console.error(JSON.stringify({ gatewayResponses, pageErrors, networkFailures, consoleErrors, visibleState, samePageRetry }, null, 2));
    throw error;
  } finally {
    if (browser) {
      const ownedProcess = browser.process();
      const closed = await bounded(browser.close().then(() => true).catch(() => false), 5000, false);
      if (!closed && ownedProcess && ownedProcess.exitCode === null) ownedProcess.kill();
    }
    if (server) {
      server.closeAllConnections();
      await bounded(new Promise(resolve => server.close(resolve)), 2000, null);
    }
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

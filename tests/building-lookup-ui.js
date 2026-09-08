const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const root = path.resolve(__dirname, '..');
const widths = [320, 390, 720, 884, 1280];
const layoutFailures = [];
const source = '국토교통부 건축HUB';
const place = {
  name: '테스트 아파트',
  displayName: '서울특별시 송파구 올림픽로 99',
  parcelAddress: '서울특별시 송파구 잠실동 27',
  roadAddress: '서울특별시 송파구 올림픽로 99',
};
const records = Array.from({ length: 46 }, (_, n) => ({
  buildingId: `building-${n + 1}`,
  buildingName: '테스트 아파트',
  dongName: `${n + 101}동`,
  parcelAddress: '서울특별시 송파구 잠실동 27',
  approvalDate: n === 45 ? '2009-02-28' : '2008-07-31',
  source,
  fetchedAt: '2026-09-08T00:00:00.000Z',
}));
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp',
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function setValue(page, selector, value) {
  await page.$eval(selector, (element, next) => {
    element.value = next;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function isVisible(page, selector) {
  return page.$eval(selector, element => {
    const rect = element.getBoundingClientRect();
    return !element.hidden && rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
  });
}

async function inspectLayout(page, width, state) {
  const result = await page.evaluate(() => {
    const root = document.getElementById('buildingLookup');
    const rect = root.getBoundingClientRect();
    const summary = root.querySelector('summary');
    const summaryBox = summary.getBoundingClientRect();
    const textBoxes = [...summary.querySelectorAll('span')].map(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect();
    });
    const textLeft = Math.min(...textBoxes.map(box => box.left));
    const textRight = Math.max(...textBoxes.map(box => box.right));
    const marker = getComputedStyle(summary, '::after');
    const controls = [...root.querySelectorAll('summary, button, input, select')]
      .filter(element => !element.hidden && element.getClientRects().length)
      .map(element => {
        const box = element.getBoundingClientRect();
        return { id: element.id || element.tagName, left: box.left, right: box.right, height: box.height };
      });
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      left: rect.left, right: rect.right, height: rect.height, controls,
      summary: {
        centerError: Math.abs((textLeft + textRight - summaryBox.left - summaryBox.right) / 2),
        textRight, markerLeft: summaryBox.right - parseFloat(marker.right) - parseFloat(marker.width),
        marker: marker.content, open: root.open,
      },
    };
  });
  assert.ok(result.documentWidth <= result.viewportWidth + 1, `${width} ${state}: page horizontal overflow`);
  assert.ok(result.left >= -1 && result.right <= width + 1, `${width} ${state}: lookup exceeds viewport`);
  assert.ok(result.summary.centerError <= 1, `${width} ${state}: summary text is ${result.summary.centerError}px away from the box center`);
  assert.ok(result.summary.markerLeft - result.summary.textRight >= 8, `${width} ${state}: summary text overlaps the expand marker`);
  assert.ok(result.summary.marker.includes(result.summary.open ? '−' : '+'), `${width} ${state}: expand/collapse marker is incorrect`);
  for (const control of result.controls) {
    assert.ok(control.height >= 44, `${width} ${state}: ${control.id} is below 44px (${control.height})`);
    assert.ok(control.left >= -1 && control.right <= width + 1, `${width} ${state}: ${control.id} exceeds viewport`);
  }
  return result;
}

async function checkWidth(browser, baseUrl, width) {
  const page = await browser.newPage();
  const pageErrors = [];
  const requests = [];
  let scenario = 'multiple';
  let heldRequest;
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (!url.pathname.endsWith('/manseBuildingLookup')) {
      if (url.origin === baseUrl || url.protocol === 'data:') request.continue();
      else request.abort();
      return;
    }
    requests.push(url);
    if (scenario === 'late') {
      heldRequest = request;
      return;
    }
    let status = 200;
    let body;
    if (scenario === 'error') {
      status = 429;
      body = { error: 'rate-limited' };
    } else if (url.searchParams.get('action') === 'search') {
      body = { mode: 'hybrid', results: [place] };
    } else if (scenario === 'not-found') {
      body = { status: 'not-found', records: [] };
    } else if (scenario === 'invalid-date') {
      body = { status: 'found', records: [{ ...records[0], approvalDate: '2025-02-30' }] };
    } else if (scenario === 'single') {
      body = { status: 'found', records: [records[0]] };
    } else {
      body = { status: 'multiple', records };
    }
    request.respond({
      status, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body),
    }).catch(() => {});
  });
  try {
    await page.goto(`${baseUrl}/index.html?building-qa=${width}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#buildingLookup');
    assert.equal(await page.$eval('#buildingLookup', element => element.open), false, 'lookup starts collapsed');
    const folded = await inspectLayout(page, width, 'folded');
    assert.ok(folded.height <= 100, `${width}: folded lookup adds too much height (${folded.height})`);
    await setValue(page, '#inBirth', '19890319');
    await setValue(page, '#inTime', '1430');
    await page.click('#segCal [data-val="lunar"]');
    await page.click('#buildingLookup summary');
    await setValue(page, '#buildingQuery', '테스트 아파트');
    await page.click('#buildingSearchBtn');
    await page.waitForSelector('#buildingPlaces button');
    await inspectLayout(page, width, 'search results');
    await page.click('#buildingPlaces button');
    await page.waitForFunction(() => document.querySelectorAll('#buildingRecords option').length === 47);
    assert.equal(await isVisible(page, '#buildingResult'), false, 'multiple records require explicit selection');
    assert.equal(await page.$eval('#buildingRecords', element => element.value), '', 'multiple records start with blank choice');
    const compact = await page.$eval('#buildingRecords', element => ({
      height: element.getBoundingClientRect().height, size: element.size,
    }));
    assert.ok(compact.height <= 72 && compact.size <= 1, '46 buildings remain in a compact dropdown');
    await inspectLayout(page, width, 'multiple buildings');
    await page.evaluate(() => {
      window.__buildingCalcClicks = 0;
      document.getElementById('calcBtn').addEventListener('click', () => window.__buildingCalcClicks++, true);
    });
    const optionValue = await page.$eval('#buildingRecords', element => element.options[46].value);
    await page.select('#buildingRecords', optionValue);
    await page.waitForFunction(() => document.querySelector('.tab.active')?.dataset.tab === 'result');
    await sleep(100);
    const chartPosition = await page.evaluate(() => ({
      nameTop: document.querySelector('#view-result .name').getBoundingClientRect().top,
      tabsBottom: document.querySelector('.tabs').getBoundingClientRect().bottom,
      scrollY: window.scrollY,
    }));
    if (chartPosition.nameTop < chartPosition.tabsBottom - 1) {
      layoutFailures.push(`${width}: result name is hidden by navigation (${JSON.stringify(chartPosition)})`);
    }
    assert.match(await page.$eval('#buildingApprovalDate', element => element.textContent), /2009.*02.*28/);
    assert.match(await page.$eval('#buildingSource', element => element.textContent), /국토교통부.*건축HUB/);
    if (process.env.BUILDING_SCREENSHOTS === '1') {
      const output = path.join(root, 'output', 'qa-building-lookup');
      fs.mkdirSync(output, { recursive: true });
      await page.screenshot({ path: path.join(output, `${width}-result.png`), fullPage: true });
    }
    await sleep(150);
    const applied = await page.evaluate(() => ({
      birth: document.getElementById('inBirth').value,
      time: document.getElementById('inTime').value,
      name: document.getElementById('inputName').value,
      calendar: document.querySelector('#segCal .active')?.dataset.val,
      solarChecked: document.querySelector('#segCal [data-val="solar"]').getAttribute('aria-checked'),
      lunarChecked: document.querySelector('#segCal [data-val="lunar"]').getAttribute('aria-checked'),
      tab: document.querySelector('.tab.active')?.dataset.tab,
      calculationClicks: window.__buildingCalcClicks,
    }));
    assert.deepEqual(applied, {
      birth: '20090228', time: '', name: `${records[45].buildingName} ${records[45].dongName}`, calendar: 'solar',
      solarChecked: 'true', lunarChecked: 'false', tab: 'result', calculationClicks: 1,
    }, `${width}: choosing a building immediately displays its solar-date chart`);
    if (width === 390) {
      const imported = await page.evaluate(() => {
        const serialized = JSON.parse(JSON.stringify(currentSaju));
        const restored = normalizeImportedRecord(serialized);
        const mismatched = normalizeImportedRecord({ ...serialized, day: 27 });
        const fabricatedTime = normalizeImportedRecord({ ...serialized, unknown: false, hour: 14, minute: 30 });
        const wrongSource = normalizeImportedRecord({
          ...serialized, buildingRegistry: { ...serialized.buildingRegistry, source: 'unverified source' },
        });
        return {
          restored: {
            buildingId: restored.buildingRegistry?.buildingId,
            source: restored.buildingRegistry?.source,
            approvalDate: restored.buildingRegistry?.approvalDate,
            name: restored.name,
            unknown: restored.unknown,
          },
          mismatchedMetadata: mismatched.buildingRegistry || null,
          fabricatedTimeMetadata: fabricatedTime.buildingRegistry || null,
          wrongSourceMetadata: wrongSource.buildingRegistry || null,
        };
      });
      assert.deepEqual(imported, {
        restored: { buildingId: records[45].buildingId, source,
          approvalDate: records[45].approvalDate, name: `${records[45].buildingName} ${records[45].dongName}`, unknown: true },
        mismatchedMetadata: null, fabricatedTimeMetadata: null, wrongSourceMetadata: null,
      }, 'saved chart import preserves verified building provenance only for its actual date and unknown time');

      const sharedText = await page.evaluate(() => {
        const text = [];
        const original = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
          text.push(String(value));
          return original.call(this, value, ...args);
        };
        try { window.shareCard(currentSaju); }
        finally { CanvasRenderingContext2D.prototype.fillText = original; }
        document.getElementById('shareCardClose')?.click();
        return text;
      });
      assert.ok(sharedText.includes('건물 만세력'), 'share card identifies a building chart');
      assert.ok(sharedText.some(text => text.includes('사용승인일 2009.02.28')), 'share card preserves approval date');
      assert.ok(!sharedText.some(text => /(?:남성|여성) · 만/.test(text)), 'building share card does not label it as a person');
      await page.waitForFunction(() => !document.getElementById('shareCardModal'));
    }
    await page.click('#tab-input');
    if (!(await page.$eval('#buildingLookup', element => element.open))) await page.click('#buildingLookup summary');
    await inspectLayout(page, width, 'selected building');
    if (process.env.BUILDING_SCREENSHOTS === '1') {
      const output = path.join(root, 'output', 'qa-building-lookup');
      await page.screenshot({ path: path.join(output, `${width}-selected.png`), fullPage: true });
    }
    await setValue(page, '#buildingQuery', '다른 아파트');
    assert.equal(await isVisible(page, '#buildingResult'), false, 'query edit clears the prior building');
    assert.equal(await page.$eval('#buildingRecords', element => element.options.length <= 1), true, 'query edit clears old building options');

    // One focused viewport exercises empty/error/direct-address/race flows;
    // each viewport already exercises the full search/select/chart workflow.
    if (width === 390) {
      if (!(await page.$eval('#buildingLookup', element => element.open))) await page.click('#buildingLookup summary');
      scenario = 'single';
      await setValue(page, '#buildingQuery', records[0].parcelAddress);
      const beforeDirect = requests.length;
      await page.click('#buildingSearchBtn');
      await page.waitForFunction(() => document.querySelector('.tab.active')?.dataset.tab === 'result');
      assert.equal(requests[beforeDirect].searchParams.get('action'), 'registry', 'a full parcel address queries the registry directly');
      assert.equal(await page.$eval('#inBirth', element => element.value), '20080731', 'single record immediately uses its date');
      assert.equal(await page.evaluate(() => window.__buildingCalcClicks), 2, 'single result calculates exactly once');
      await page.click('#tab-input');
      if (!(await page.$eval('#buildingLookup', element => element.open))) await page.click('#buildingLookup summary');

      scenario = 'not-found';
      await setValue(page, '#buildingQuery', '서울특별시 송파구 잠실동 9999');
      await page.click('#buildingSearchBtn');
      await page.waitForFunction(() => !document.getElementById('buildingSearchBtn').disabled);
      assert.equal(await isVisible(page, '#buildingResult'), false);
      assert.ok((await page.$eval('#buildingStatus', element => element.textContent.trim())).length > 0, 'no record has a visible explanation');

      for (const next of ['invalid-date', 'error']) {
        scenario = next;
        await setValue(page, '#buildingQuery', '서울특별시 송파구 잠실동 27');
        await page.click('#buildingSearchBtn');
        await page.waitForFunction(() => !document.getElementById('buildingSearchBtn').disabled);
        assert.equal(await isVisible(page, '#buildingResult'), false, `${next}: invalid result cannot be applied`);
        assert.ok((await page.$eval('#buildingStatus', element => element.textContent.trim())).length > 0, `${next}: visible status`);
        assert.equal(await page.$eval('#inBirth', element => element.value), '20080731', `${next}: preserves current input`);
      }

      scenario = 'late';
      await setValue(page, '#buildingQuery', '서울특별시 송파구 잠실동 27');
      await page.click('#buildingSearchBtn');
      const deadline = Date.now() + 3000;
      while (!heldRequest && Date.now() < deadline) await sleep(20);
      assert.ok(heldRequest, 'late-response scenario starts its registry request');
      await setValue(page, '#buildingQuery', '사용자가 새로 입력한 건물');
      await heldRequest.respond({
        status: 200, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ status: 'found', records: [records[0]] }),
      }).catch(() => {});
      await sleep(200);
      assert.equal(await isVisible(page, '#buildingResult'), false, 'late response cannot restore a stale date');
      assert.equal(await page.$eval('#buildingQuery', element => element.value), '사용자가 새로 입력한 건물');
      assert.equal(await page.$eval('#buildingSearchBtn', element => element.disabled), false, 'editing a loading query restores search');

      for (const change of ['birth', 'name', 'time', 'calendar', 'tab', 'close']) {
        await page.click('#tab-input');
        if (!(await page.$eval('#buildingLookup', element => element.open))) await page.click('#buildingLookup summary');
        await setValue(page, '#buildingQuery', '서울특별시 송파구 잠실동 27');
        heldRequest = null;
        await page.click('#buildingSearchBtn');
        const changeDeadline = Date.now() + 3000;
        while (!heldRequest && Date.now() < changeDeadline) await sleep(20);
        assert.ok(heldRequest, `${change}: delayed registry request starts`);
        const clicksBefore = await page.evaluate(() => window.__buildingCalcClicks);
        if (change === 'birth') await setValue(page, '#inBirth', '19901120');
        if (change === 'name') await setValue(page, '#inputName', '사용자가 입력한 이름');
        if (change === 'time') await setValue(page, '#inTime', '0830');
        if (change === 'calendar') await page.click('#segCal [data-val="lunar"]');
        if (change === 'tab') await page.click('#tab-calendar');
        if (change === 'close') await page.click('#buildingLookup summary');
        const edited = await page.evaluate(() => ({
          birth: document.getElementById('inBirth').value,
          time: document.getElementById('inTime').value,
          name: document.getElementById('inputName').value,
          calendar: document.querySelector('#segCal .active').dataset.val,
          tab: document.querySelector('.tab.active').dataset.tab,
        }));
        await heldRequest.respond({
          status: 200, contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ status: 'found', records: [records[0]] }),
        }).catch(() => {});
        await sleep(150);
        assert.deepEqual(await page.evaluate(() => ({
          birth: document.getElementById('inBirth').value,
          time: document.getElementById('inTime').value,
          name: document.getElementById('inputName').value,
          calendar: document.querySelector('#segCal .active').dataset.val,
          tab: document.querySelector('.tab.active').dataset.tab,
        })), edited, `${change}: a late registry response preserves the user's edited inputs and navigation`);
        assert.equal(await page.evaluate(() => window.__buildingCalcClicks), clicksBefore, `${change}: cancelled result does not calculate`);
        assert.equal(await page.$eval('#buildingSearchBtn', element => element.disabled), false, `${change}: lookup is usable after cancellation`);
      }
    }
    assert.deepEqual(pageErrors, [], `${width}: browser errors`);
    console.log(`Building lookup behavior PASS ${width}px`);
  } finally {
    await page.close();
  }
}

(async () => {
  const server = http.createServer((request, response) => {
    const requestedPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${requestedPath === '/' ? '/index.html' : requestedPath}`);
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) response.writeHead(404).end();
      else {
        response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        response.end(data);
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    for (const width of widths) await checkWidth(browser, baseUrl, width);
    assert.deepEqual(layoutFailures, [], 'result names remain below fixed navigation');
    console.log(`Building lookup UI PASS: ${widths.join(', ')}px`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

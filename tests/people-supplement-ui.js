// Catch loss of curated people, misleading provenance, accidental auto-apply,
// or online failure erasing offline recommendations. Only external requests
// fail here; the real data module, calculation, search, and renderers run.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output', 'qa-people-supplement');
const widths = (process.env.PEOPLE_WIDTHS || '390,884,1280').split(',').map(Number);
const schemes = (process.env.PEOPLE_SCHEMES || 'light,dark').split(',');
const expected = [
  ['루카', '20020320', 'F'], ['파리타', '20050826', 'F'],
  ['아사', '20060417', 'F'], ['라미', '20071017', 'F'], ['치키타', '20090217', 'F'],
];

async function settle(page) {
  await page.evaluate(async () => {
    const bounded = promise => Promise.race([promise, new Promise(resolve => setTimeout(resolve, 1200))]);
    await bounded(document.fonts.ready);
    const finite = document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime));
    await bounded(Promise.allSettled(finite.map(animation => animation.finished)));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function setValue(page, selector, value) {
  await page.$eval(selector, (element, next) => {
    element.value = next;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function inputState(page) {
  return page.evaluate(() => ({
    name: document.querySelector('#inputName').value,
    birth: document.querySelector('#inBirth').value,
    time: document.querySelector('#inTime').value,
    calendar: document.querySelector('#segCal .active')?.dataset.val,
    gender: document.querySelector('#segGender .active')?.dataset.val,
  }));
}

async function readCards(page, selector) {
  return page.$eval(selector, element => ({
    text: element.textContent,
    cards: [...element.querySelectorAll('.cycle-person')].map(card => ({
      name: card.querySelector('strong')?.textContent.trim(),
      text: card.textContent,
      href: card.href,
      aria: card.getAttribute('aria-label'),
      views: card.querySelector('.cycle-person-views')?.textContent || '',
      rank: card.querySelector('.birthday-person-rank')?.textContent.trim() || '',
    })),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    busy: element.getAttribute('aria-busy'),
    kicker: element.querySelector('.cycle-people-kicker')?.textContent || '',
    sourceLabel: element.querySelector('.cycle-people-source')?.textContent || '',
  }));
}

function assertCuratedCard(card, name, label) {
  assert.ok(card, `${label}: ${name} must remain visible when external lookup fails`);
  assert.doesNotMatch(card.text, /NaN|undefined|최근\s*30일\s*[\d,]+회/, `${label}: no fabricated or invalid pageview count`);
  assert.doesNotMatch(card.aria || '', /한국어 위키백과에서 보기/, `${label}: curated links must not be announced as Wikipedia links`);
  assert.doesNotMatch(card.views, /[\d,]+회/, `${label}: unknown popularity must not be shown as a measured count`);
}

async function inspect(browser, url, width, scheme) {
  const page = await browser.newPage();
  const label = `${width}px ${scheme}`;
  const errors = [];
  const namuRequests = [];
  const externalFailures = [];
  const allowedOrigin = new URL(url).origin;
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width, height: 1000, deviceScaleFactor: 1, hasTouch: true, isMobile: width < 768 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(theme => localStorage.setItem('saju_theme', theme), scheme);
  await page.setRequestInterception(true);
  page.on('request', request => {
    const target = new URL(request.url());
    if (/(^|\.)namu\.wiki$/.test(target.hostname)) namuRequests.push(request.url());
    if (target.origin === allowedOrigin || ['data:', 'blob:'].includes(target.protocol)) {
      request.continue().catch(() => {});
    } else {
      externalFailures.push(request.url());
      request.respond({ status: 503, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"error":"offline-test"}' }).catch(() => {});
    }
  });
  try {
    console.log(`[people] ${label}: real offline search`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForSelector('#personSearchBtn');
    await setValue(page, '#inBirth', '19890319');
    await setValue(page, '#inTime', '1430');
    await page.click('#segCal [data-val="lunar"]');
    const beforeSearch = await inputState(page);
    await page.click('#personSearchBtn');
    await setValue(page, '#psQuery', '라미');
    await page.waitForFunction(() => document.querySelector('#psResults .ps-item') || document.querySelector('#psResults .ps-error'));
    await settle(page);
    const names = await page.$$eval('#psResults .ps-title', elements => elements.map(element => element.textContent.trim()));
    assert.ok(names.some(name => /라미/.test(name) && !/라미란/.test(name)), `${label}: offline search must add BABYMONSTER 라미 separately from 라미란; got ${JSON.stringify(names)}`);
    assert.ok(names.some(name => /라미란/.test(name)), `${label}: existing local 라미란 must remain available`);

    const records = await page.evaluate(() => window.MansePeopleSupplement?.records || []);
    for (const [name, ymd, gender] of expected) {
      const record = records.find(item => item.y === ymd && item.n.includes(name));
      assert.ok(record, `${label}: verified ${name} / ${ymd} must be searchable offline`);
      assert.equal(record.g, gender, `${label}: ${name} gender`);
    }
    // Validate every published record's provenance, not only the five hand-
    // checked name/date fixtures: later additions must not omit their evidence.
    for (const record of records) {
      const name = record.n;
      assert.ok(typeof name === 'string' && name.trim(), `${label}: supplementary names must be nonempty`);
      assert.match(record.y, /^\d{8}$/, `${label}: ${name} has a complete birth date`);
      const date = new Date(Date.UTC(Number(record.y.slice(0, 4)), Number(record.y.slice(4, 6)) - 1, Number(record.y.slice(6, 8))));
      assert.equal(date.toISOString().slice(0, 10).replace(/-/g, ''), record.y, `${label}: ${name} birth date exists in the solar calendar`);
      assert.equal(record.evidence.calendar, 'solar', `${label}: unqualified calendar must not enter the solar data path`);
      assert.equal(record.evidence.birthTime, null, `${label}: unknown birth time must not be invented`);
      assert.match(record.evidence.verifiedAt, /^\d{4}-\d{2}-\d{2}/, `${label}: verification date is retained`);
      assert.equal(new URL(record.evidence.namuUrl).hostname, 'namu.wiki', `${label}: Namu reference URL is retained`);
      const official = new URL(record.evidence.officialUrl);
      assert.equal(official.protocol, 'https:', `${label}: official evidence URL is HTTPS`);
      assert.notEqual(official.hostname, 'namu.wiki', `${label}: Namu reference is not mislabeled as official evidence`);
      assert.ok(record.evidence.id && record.evidence.officialLabel, `${label}: source identity and label are retained`);
    }
    const rami = records.find(record => record.y === '20071017' && record.n.includes('라미'));
    // A real Wikipedia parse result used to omit its full date. The otherwise
    // correct merger could therefore leave the online and curated Rami twice.
    const mergedBirthday = await page.evaluate(() => {
      const date = { year: 2007, month: 10, day: 17 };
      const parsed = parseWikipediaSameBirthdayBirths({ parse: { text: { '*':
        '<h2 id="탄생">탄생</h2><ul><li><a href="/wiki/2007년" title="2007년">2007년</a> - <a href="/wiki/라미_(2007년)" title="라미 (2007년)">라미</a></li></ul><h2 id="사망">사망</h2>'
      } } }, date);
      const ranked = rankWikipediaBirthdayPeople({ query: { pages: [{ title: '라미 (2007년)', description: '대한민국의 가수', pageviews: { '2026-09-18': 123 } }] } }, parsed);
      return MansePeopleSupplement.mergeCandidates(ranked, date);
    });
    assert.equal(mergedBirthday.length, 1, `${label}: actual parser/ranker/merge path must deduplicate online and curated 라미`);
    assert.equal(mergedBirthday[0].views, 123, `${label}: merging must retain real online popularity measurements`);
    assert.equal(mergedBirthday[0].evidence?.officialUrl, rami.evidence.officialUrl, `${label}: merged online card must retain verified provenance`);
    const aliasNames = await page.evaluate(() => searchLocalPeople('RUKA', 8).map(person => person.n));
    assert.ok(aliasNames.some(name => name.includes('루카')), `${label}: Latin alias RUKA finds the supplementary person`);
    const matches = await page.$$('#psResults .ps-item');
    let selected;
    for (const item of matches) {
      if (await item.evaluate((element, name) => element.querySelector('.ps-title')?.textContent.includes(name), rami.n)) selected = item;
    }
    assert.ok(selected, `${label}: exact supplementary search item is selectable`);
    await selected.click();
    await page.waitForSelector('#pcbApply');
    await settle(page);
    const confirm = await page.$eval('.ps-confirm-box', element => ({ text: element.textContent, links: [...element.querySelectorAll('a')].map(link => ({ href: link.href, text: link.textContent, target: link.target, rel: link.rel })) }));
    assert.match(confirm.text, /2007[.\-/년\s]+0?10[.\-/월\s]+17/, `${label}: confirmation shows the verified exact birth date`);
    assert.match(confirm.text, /시\s*모름|시간\s*미상/, `${label}: unknown birth time is disclosed`);
    assert.doesNotMatch(confirm.text, /앱 내장 정보\(Wikidata\) 기준/, `${label}: supplementary evidence must not be mislabeled Wikidata`);
    for (const href of [rami.evidence.officialUrl, rami.evidence.namuUrl]) {
      const sourceLink = confirm.links.find(link => link.href === new URL(href).href);
      assert.ok(sourceLink, `${label}: confirmation includes ${href}`);
      assert.equal(sourceLink.target, '_blank', `${label}: sources open separately`);
      assert.match(sourceLink.rel, /noopener/, `${label}: source link protects the opener`);
    }
    await page.screenshot({ path: path.join(output, `${width}-${scheme}-confirm.png`) });

    // Prevent only navigation, not propagation: a buggy parent auto-apply handler
    // must still fire and fail the form-state assertion below.
    await page.$eval('.ps-confirm-box', element => {
      element.addEventListener('click', event => {
        if (event.target.closest('a')) event.preventDefault();
      }, true);
    });
    for (const href of [rami.evidence.officialUrl, rami.evidence.namuUrl]) {
      const link = await page.evaluateHandle(value => [...document.querySelectorAll('.ps-confirm-box a')].find(element => element.href === new URL(value).href), href);
      await link.asElement().click();
      await settle(page);
      assert.deepEqual(await inputState(page), beforeSearch, `${label}: opening a source must not auto-apply person data`);
      assert.ok(await page.$('#pcbApply'), `${label}: source click must preserve the confirmation step`);
      await link.dispose();
    }

    console.log(`[people] ${label}: verified apply and offline birthday`);
    await page.click('#pcbApply');
    await page.waitForFunction(() => typeof currentSaju !== 'undefined' && currentSaju && document.querySelector('#inBirth').value === '20071017' && document.querySelector('#sameBirthdayPeople .cycle-person'));
    await settle(page);
    const applied = await inputState(page);
    assert.deepEqual({ birth: applied.birth, time: applied.time, calendar: applied.calendar, gender: applied.gender }, { birth: '20071017', time: '', calendar: 'solar', gender: 'F' }, `${label}: apply preserves verified date and unknown time`);
    assert.equal(await page.evaluate(() => currentSaju.unknown), true, `${label}: actual calculation must use the unknown-hour contract`);
    await page.evaluate(() => loadSameBirthdayPeople(currentSaju, true));
    const birthday = await readCards(page, '#sameBirthdayPeople');
    assertCuratedCard(birthday.cards.find(card => card.name === rami.n), '라미', label);
    assert.doesNotMatch(birthday.sourceLabel, /최근.*인기|조회수.*순/, `${label}: curated-only offline recommendations must not claim a popularity ranking`);
    assert.ok(!birthday.kicker.includes('위키백과') || /공식|내장|보강|나무위키/.test(birthday.kicker), `${label}: mixed-source recommendations must not identify Wikipedia as their only source`);
    assert.equal(birthday.busy, 'false', `${label}: offline birthday loading settles`);
    assert.ok(birthday.overflow <= 1, `${label}: recommendation page has horizontal overflow`);
    await page.$eval('#sameBirthdayPeople', element => element.scrollIntoView({ block: 'center' }));
    await settle(page);
    await (await page.$('#sameBirthdayPeople')).screenshot({ path: path.join(output, `${width}-${scheme}-birthday.png`) });

    console.log(`[people] ${label}: eight online people cannot displace curated evidence`);
    // Exercise the real merger and renderer with an already full online list.
    // Cutting the merged list back to eight must not silently erase its ninth,
    // independently verified person or label that person as popularity rank 9.
    await page.evaluate(() => {
      const date = { year: 2007, month: 10, day: 17 };
      const online = Array.from({ length: 8 }, (_, index) => ({
        name: `온라인 비교 인물 ${index + 1}`,
        title: `온라인 비교 인물 ${index + 1}`,
        article: `https://ko.wikipedia.org/wiki/${encodeURIComponent(`온라인_비교_인물_${index + 1}`)}`,
        date: { ...date }, birthYear: 2007,
        views: 800 - index * 100,
        description: '온라인 결과 렌더링 테스트 인물',
      }));
      const merged = MansePeopleSupplement.mergeCandidates(online, date);
      renderSameBirthdayPeople(document.getElementById('sameBirthdayPeople'), merged, date);
    });
    await settle(page);
    const mixed = await readCards(page, '#sameBirthdayPeople');
    await (await page.$('#sameBirthdayPeople')).screenshot({ path: path.join(output, `${width}-${scheme}-mixed-birthday.png`) });
    assert.equal(mixed.cards.length, 9, `${label}: all eight ranked online people and one curated supplement must be rendered`);
    const onlineCards = mixed.cards.filter(card => card.name?.startsWith('온라인 비교 인물 '));
    assert.equal(onlineCards.length, 8, `${label}: preserving the supplement must not discard an existing online result`);
    assert.match(onlineCards.find(card => card.name === '온라인 비교 인물 1').views, /800회/, `${label}: actual online popularity remains visible`);
    const mixedRami = mixed.cards.find(card => card.name === rami.n);
    assertCuratedCard(mixedRami, '라미', label);
    assert.doesNotMatch(mixedRami.aria || '', /^\s*\d+위/, `${label}: curated evidence is not a measured popularity rank`);
    assert.doesNotMatch(mixedRami.rank, /^\d+$/, `${label}: curated evidence must not be given rank 9`);
    assert.ok(mixed.overflow <= 1, `${label}: mixed recommendations have horizontal overflow`);

    console.log(`[people] ${label}: multiple QID-free same-pillar dates`);
    // Hand-specified valid date candidates exercise the real recommendation
    // loader; the solar-term matching engine is covered by same-pillars-60.
    await page.evaluate(() => loadSamePillarPeople({ exactMatches: [{ year: 2007, month: 10, day: 17 }, { year: 2009, month: 2, day: 17 }] }, true));
    const pillars = await readCards(page, '#samePillarPeople');
    assertCuratedCard(pillars.cards.find(card => card.name === rami.n), '라미', label);
    assertCuratedCard(pillars.cards.find(card => card.name?.includes('치키타')), '치키타', label);
    assert.ok(!pillars.kicker.includes('위키백과') || /공식|내장|보강|나무위키/.test(pillars.kicker), `${label}: curated same-pillar recommendations must not claim Wikipedia-only provenance`);
    assert.equal(pillars.busy, 'false', `${label}: offline same-pillar loading settles`);
    const literalDateChecks = await page.evaluate(() => {
      const supplement = window.MansePeopleSupplement;
      const namesFor = date => supplement.forDate(date).map(person => person.name || person.n);
      const lunarSaju = calcSaju({ year: 1986, month: 2, day: 19, hour: 0, minute: 0, calendar: 'lunar', gender: 'M', unknown: true });
      return {
        exact: namesFor({ year: 2007, month: 10, day: 17 }),
        otherYear: namesFor({ year: 2006, month: 10, day: 17 }),
        invalid: namesFor({ year: 2007, month: 2, day: 30 }),
        lunar: getSameBirthdayComparisonDate(lunarSaju).date,
      };
    });
    assert.ok(literalDateChecks.exact.includes(rami.n), `${label}: exact year-month-day lookup includes 라미`);
    assert.ok(!literalDateChecks.otherYear.includes(rami.n), `${label}: another birth year must not be called the same birthday`);
    assert.deepEqual(literalDateChecks.invalid, [], `${label}: nonexistent calendar date must not produce a person`);
    assert.deepEqual(literalDateChecks.lunar, { year: 1986, month: 3, day: 28 }, `${label}: raw lunar input is compared using its solar date`);
    await (await page.$('#samePillarPeople')).screenshot({ path: path.join(output, `${width}-${scheme}-pillars.png`) });
    assert.deepEqual(namuRequests, [], `${label}: no runtime requests to Namu are allowed`);
    assert.ok(externalFailures.length > 0, `${label}: online failure path was actually exercised`);
    assert.deepEqual(errors, [], `${label}: unexpected browser errors`);
    console.log(`[people] PASS ${label}`);
  } catch (error) {
    await settle(page).catch(() => {});
    await page.screenshot({ path: path.join(output, `${width}-${scheme}-failure.png`) }).catch(() => {});
    throw error;
  } finally {
    await page.close();
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  let server;
  let browser;
  let timer;
  try {
    let url = process.env.TEST_URL || process.env.PEOPLE_URL;
    if (!url) {
      server = http.createServer((request, response) => {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
        if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
        fs.readFile(file, (error, contents) => {
          if (error) { response.writeHead(404).end(); return; }
          const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
          response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
          response.end(contents);
        });
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      url = `http://127.0.0.1:${server.address().port}/index.html`;
    }
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
    timer = setTimeout(() => browser.close().catch(() => {}), 180000);
    for (const width of widths) for (const scheme of schemes) await inspect(browser, url, width, scheme);
    console.log(`People supplement UI PASS: ${widths.length * schemes.length} viewport/theme cases`);
  } finally {
    clearTimeout(timer);
    if (browser) await browser.close();
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

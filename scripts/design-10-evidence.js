// Independent browser evidence and before/after calculation/storage checks.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const taskRoot = path.resolve(root, '../..');
const baseline = path.join(taskRoot, 'outputs/design-10/baseline/evidence');
const output = path.join(taskRoot, 'outputs/design-10/final/evidence');
const before = JSON.parse(fs.readFileSync(path.join(baseline, 'measurements.json'), 'utf8'));
const oldStorage = JSON.parse(fs.readFileSync(path.join(baseline, 'saved-storage.json'), 'utf8'));
const oldKey = Object.keys(oldStorage).find(key => key.startsWith('saju:'));
const oldRecord = JSON.parse(oldStorage[oldKey]);
const report = { startedAt: new Date().toISOString(), baselineCommit: before.baselineCommit, root, output, cases: [], calculations: [], storage: [], names: [], failures: [], optionalServices: 'Wikipedia and Wikidata enrichment use deterministic empty responses; app/calculation/storage/fonts are real.' };
const check = (value, message) => { if (!value) report.failures.push(message); };
const engineBefore = JSON.parse(fs.readFileSync(path.join(baseline, 'engine-sha256.json'), 'utf8'));
report.engineHashes = Object.fromEntries(Object.entries(engineBefore).map(([file, hash]) => { const current = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'); return [file, { baseline: hash, current, matches: hash === current }]; }));
check(Object.values(report.engineHashes).every(value => value.matches), 'An immutable calculation/reading/storage module hash changed');
report.presentationHashes = Object.fromEntries(['index.html', 'apple.css', 'reading.css', 'building-lookup.css', 'reading-navigation.js', 'presentation.js'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
async function settle(page) { await page.evaluate(async () => { await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 2000))]); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }); }
async function configure(page, width, theme, storage = null, legacy = false) {
  const errors = [], consoleErrors = [], networkFailures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('requestfailed', request => networkFailures.push({ url: request.url(), error: request.failure()?.errorText, optional: /wikipedia|wikidata/.test(request.url()) }));
  page.setDefaultTimeout(15000);
  await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument((data, scheme, fallback) => {
    localStorage.clear(); localStorage.setItem('saju_theme', scheme);
    if (data) for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value);
    if (fallback) window.storage = { get: async () => { throw new Error('QA unavailable primary backend'); }, set: async () => { throw new Error('QA unavailable primary backend'); }, list: async () => { throw new Error('QA unavailable primary backend'); }, delete: async () => { throw new Error('QA unavailable primary backend'); } };
  }, storage, theme, legacy);
  await page.setRequestInterception(true);
  page.on('request', request => {
    const target = new URL(request.url());
    if (/(^|\.)(wikipedia|wikidata)\.org$/.test(target.hostname)) request.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ query: { pages: {} }, results: { bindings: [] }, entities: {} }) }).catch(() => {});
    else request.continue().catch(() => {});
  });
  return { errors, consoleErrors, networkFailures };
}
async function fill(page, fixture) {
  await page.$eval('#tab-input', element => element.click());
  await page.evaluate(data => {
    for (const [id, value] of [['inputName', data.name], ['inBirth', data.birth], ['inTime', data.time]]) { const element = document.getElementById(id); element.value = value; element.dispatchEvent(new Event('input', { bubbles: true })); }
    document.querySelector(`#segGender [data-val="${data.gender}"]`).click();
    document.querySelector(`#segCal [data-val="${data.calendar}"]`).click();
    document.getElementById('calcBtn').click();
  }, fixture);
  await page.waitForSelector('#view-result.active .pillar-block'); await settle(page);
}
async function calculated(page, fixture) {
  return page.evaluate(fixture => ({ fixture, saju: JSON.parse(JSON.stringify(currentSaju)), natal: [...document.querySelectorAll('.pillars-4 .pillar-block .han')].map(x => x.textContent), daeun: [...document.querySelectorAll('#daeunScroll .luck-item')].map(x => x.textContent.replace(/\s+/g, ' ').trim()), seun: [...document.querySelectorAll('#seunScroll .luck-item')].map(x => x.textContent.replace(/\s+/g, ' ').trim()), lunar: currentSaju.lunar }), fixture);
}
async function measure(page, state) {
  return page.evaluate(state => {
    const visible = el => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && !el.closest('.sr-only,svg,script,style,option,[aria-hidden="true"]');
    const texts = [...document.querySelectorAll('body *')].filter(el => visible(el) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).map(el => ({ selector: el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}.${String(el.className).trim().replace(/\s+/g, '.')}`, text: el.textContent.trim().slice(0, 70), font: parseFloat(getComputedStyle(el).fontSize) }));
    const empty = document.querySelector('#view-saved .empty-mark'), copy = empty?.parentElement.querySelector('p')?.getBoundingClientRect(), action = empty?.parentElement.querySelector('button')?.getBoundingClientRect();
    const emptyBox = empty?.getBoundingClientRect();
    return { state, documentHeight: document.documentElement.scrollHeight, documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, scrollY, htmlBackground: getComputedStyle(document.documentElement).backgroundColor, bodyBackground: getComputedStyle(document.body).backgroundColor, colorScheme: getComputedStyle(document.documentElement).colorScheme, metaTheme: [...document.querySelectorAll('meta[name="theme-color"]')].map(el => ({ media: el.media, color: el.content })), minimumTextPx: Math.min(...texts.map(x => x.font)), smallTexts: texts.filter(x => x.font < 12), fortuneHeight: document.getElementById('fortuneContent').getBoundingClientRect().height, toc: [...document.querySelectorAll('.reading-navigation a')].map(el => ({ text: el.textContent, href: el.hash, current: el.getAttribute('aria-current') })), empty: emptyBox ? { width: emptyBox.width, height: emptyBox.height, copyButtonGap: action && copy ? action.top - copy.bottom : null } : null };
  }, state);
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const downloads = path.join(output, 'downloads'); fs.mkdirSync(downloads, { recursive: true });
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const staticRoot = pathname.startsWith('/baseline/') ? path.resolve(baseline, '..') : root;
    const relative = pathname.startsWith('/baseline/') ? pathname.slice('/baseline/'.length) : pathname.replace(/^\/+/, '');
    const file = path.join(staticRoot, relative);
    if (!file.startsWith(staticRoot + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.setHeader('Cache-Control', 'no-store'); fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  try {
    const cdp = await browser.target().createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads, eventsEnabled: true });
    for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
      const page = await browser.newPage(), diagnostics = await configure(page, width, theme);
      const entry = { width, theme, captures: [], measurements: [], themeToggles: [], ...diagnostics };
      async function capture(state, fullPage = false) {
        await settle(page); const file = `${width}-${theme}-${state}.png`;
        await page.screenshot({ path: path.join(output, file), fullPage }); entry.captures.push(file);
        const metrics = await measure(page, state); entry.measurements.push(metrics);
        check(metrics.documentWidth <= width + 1, `${width}/${theme}/${state}: horizontal document overflow`);
        check(metrics.minimumTextPx >= 12, `${width}/${theme}/${state}: text below12px`);
        check(metrics.htmlBackground === metrics.bodyBackground, `${width}/${theme}/${state}: html/body background differs`);
        return metrics;
      }
      await page.goto(url, { waitUntil: 'domcontentloaded' }); await capture('input', true);
      await fill(page, { name: '홍길동', birth: '19890319', time: '1430', gender: 'M', calendar: 'solar' }); await page.evaluate(() => scrollTo(0, 0)); await capture('result');
      await page.click('#tab-fortune'); await settle(page); await page.evaluate(() => scrollTo(0, 0));
      const fortune = await capture('fortune-top');
      const previous = before.cases.find(c => c.width === width && c.theme === theme).measurements.find(m => m.state === 'fortune-top');
      entry.fortuneReduction = { before: previous.documentHeight, after: fortune.documentHeight, ratio: 1 - fortune.documentHeight / previous.documentHeight };
      if (width === 390) check(entry.fortuneReduction.ratio >= .5, `${width}/${theme}: collapsed fortune reduction below50%`);
      const target = await page.evaluate(() => { const links = [...document.querySelectorAll('.reading-navigation a')]; return (links.find(el => /재정/.test(el.textContent)) || links[2] || links[0])?.getAttribute('href'); });
      check(Boolean(target), `${width}/${theme}: missing TOC`);
      if (target) {
        await page.click(`.reading-navigation a[href="${target}"]`); await settle(page);
        entry.anchor = await page.$eval(target, el => ({ id: el.id, top: el.getBoundingClientRect().top, focused: document.activeElement === el, heading: el.querySelector('h2,h3,h4')?.textContent }));
        check(entry.anchor.top >= -1 && entry.anchor.top < 600, `${width}/${theme}: anchor hidden or not reached`);
        check(entry.anchor.focused, `${width}/${theme}: TOC did not focus its section`);
      }
      await capture('fortune-toc-clicked');
      await page.click('#tab-calendar'); await capture('calendar');
      await page.click('#tab-saved'); const empty = await capture('saved-empty');
      check(empty.empty?.width >= 56 && empty.empty.width <= 64 && empty.empty.height >= 56 && empty.empty.height <= 64, `${width}/${theme}: empty mark not56-64px square`);
      check(empty.empty?.copyButtonGap >= 20 && empty.empty.copyButtonGap <= 24, `${width}/${theme}: empty CTA gap outside20-24px`);
      await page.click('#tab-input');
      for (const expected of [theme === 'dark' ? 'light' : 'dark', theme]) {
        await page.click('#themeToggleBtn'); await settle(page); const toggle = await measure(page, `toggle-${expected}`);
        entry.themeToggles.push(toggle); check(toggle.colorScheme === expected && toggle.htmlBackground === toggle.bodyBackground, `${width}/${theme}: theme toggle ${expected} inconsistent`);
      }
      if (width === 390 && theme === 'light') {
        for (const previous of before.calculations) {
          await fill(page, previous.fixture); const current = await calculated(page, previous.fixture);
          const comparisons = Object.fromEntries(['natal', 'daeun', 'seun', 'lunar', 'saju'].map(key => [key, isDeepStrictEqual(previous[key], current[key])]));
          check(Object.values(comparisons).every(Boolean), `Calculation mismatch ${previous.fixture.birth}: ${JSON.stringify(comparisons)}`);
          report.calculations.push({ fixture: previous.fixture, comparisons, current });
        }
      }
      if (width === 390) for (const name of ['', '박정민', '민수']) {
        const slug = name || 'blank'; await fill(page, { name, birth: '19890319', time: '1430', gender: 'M', calendar: 'solar' });
        const resultName = await page.$eval('.result-head', el => el.textContent.trim());
        await page.screenshot({ path: path.join(output, `${width}-${theme}-name-${slug}-result.png`) });
        await page.click('#tab-fortune'); await settle(page);
        const fortuneName = await page.$eval('#fortuneContent', el => el.textContent);
        await page.screenshot({ path: path.join(output, `${width}-${theme}-name-${slug}-fortune.png`) });
        check(!fortuneName.includes('이름 없음'), `${theme}/${slug}: unnatural anonymous name in fortune`);
        const nameEvidence = { name, theme, resultName, fortuneTitle: await page.$eval('.fortune-head-summary .nm', el => el.textContent), sample: fortuneName.slice(0, 900) };
        if (!name) {
          await page.click('#tab-result'); await page.click('#saveBtn'); await page.waitForSelector('#saveModal.active');
          await page.click('#saveConfirm'); await page.waitForFunction(() => !document.getElementById('saveModal').classList.contains('active'));
          await page.click('#tab-saved'); await page.waitForSelector('.saved-card');
          nameEvidence.savedLabel = await page.$eval('.saved-card .sname', el => el.firstChild.textContent.trim());
          check(nameEvidence.savedLabel === '1989.03.19 · 남성', `${theme}: nameless saved label differs from birth date and gender`);
          await page.screenshot({ path: path.join(output, `${width}-${theme}-name-blank-saved.png`) });
        }
        report.names.push(nameEvidence);
      }
      check(!diagnostics.errors.length && !diagnostics.consoleErrors.length, `${width}/${theme}: browser console/page errors`);
      report.cases.push(entry); await page.close(); console.log(`Evidence ${width}px ${theme}: captured six states`);
    }
    // Import already recalculates canonical solar data in the old version. Pin
    // the full historical normalization result rather than mistaking its
    // existing `lunar.isLeap=false` addition for a new presentation regression.
    const baselinePage = await browser.newPage(); await configure(baselinePage, 390, 'dark');
    await baselinePage.goto(url.replace('/index.html', '/baseline/index.html'), { waitUntil: 'domcontentloaded' });
    const baselineImported = await baselinePage.evaluate(record => normalizeImportedRecord(record), oldRecord);
    report.baselineImportNormalization = baselineImported; await baselinePage.close();
    const withoutId = value => { const { id, ...data } = value; return data; };
    for (const legacy of [false, true]) {
      const backend = legacy ? 'legacy-saju_list' : 'primary-saju-prefix';
      const backendDownloads = path.join(downloads, `${backend}-${Date.now()}`); fs.mkdirSync(backendDownloads, { recursive: true });
      await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: backendDownloads, eventsEnabled: true });
      const storage = legacy ? { saju_list: JSON.stringify([oldRecord]), design10_sentinel: 'preserve-me' } : { ...oldStorage, design10_sentinel: 'preserve-me' };
      const page = await browser.newPage(), diagnostics = await configure(page, 390, 'dark', storage, legacy), dialogs = [];
      page.on('dialog', async dialog => { dialogs.push({ type: dialog.type(), message: dialog.message() }); await dialog.accept(); });
      await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.click('#tab-saved'); await page.waitForSelector('.saved-card');
      const storageBefore = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])));
      await page.click('.saved-card'); await page.waitForSelector('#view-result.active .pillar-block');
      const opened = await page.evaluate(() => JSON.parse(JSON.stringify(currentSaju)));
      check(isDeepStrictEqual(opened, oldRecord), `${backend}: previous saved chart changed when opening`);
      const storageAfterOpen = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])));
      check(isDeepStrictEqual(storageBefore, storageAfterOpen), `${backend}: opening mutated localStorage`);
      await page.screenshot({ path: path.join(output, `storage-${backend}-opened.png`) });
      await page.click('#tab-saved'); await page.waitForSelector('#savedExportBtn');
      const existing = new Set(fs.readdirSync(backendDownloads)); await page.click('#savedExportBtn');
      let download;
      for (let i = 0; i < 100; i++) { download = fs.readdirSync(backendDownloads).find(file => !existing.has(file) && file.endsWith('.json')); if (download) break; await new Promise(resolve => setTimeout(resolve, 100)); }
      check(Boolean(download), `${backend}: no UI export download`); if (!download) throw new Error(`${backend}: download did not finish`);
      const downloadPath = path.join(backendDownloads, download), payload = JSON.parse(fs.readFileSync(downloadPath, 'utf8'));
      check(payload.version === 1 && payload.app === '잔상 만세력' && payload.records.length === 1 && isDeepStrictEqual(payload.records[0], oldRecord), `${backend}: exported saved format or record changed`);
      await page.click('.saved-card .sdelete'); await page.waitForSelector('.saved-empty');
      const chooser = page.waitForFileChooser(); await page.click('#savedImportBtn'); await (await chooser).accept([downloadPath]);
      await page.waitForSelector('.saved-card'); await page.click('.saved-card'); await page.waitForSelector('#view-result.active .pillar-block');
      const imported = await page.evaluate(() => JSON.parse(JSON.stringify(currentSaju)));
      const storageAfterImport = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])));
      for (const key of ['yStem', 'yBranch', 'mStem', 'mBranch', 'dStem', 'dBranch', 'hStem', 'hBranch', 'daeun', 'name', 'gender', 'unknown', 'memo', 'savedAt']) check(isDeepStrictEqual(imported[key], oldRecord[key]), `${backend}: import changed ${key}`);
      check(isDeepStrictEqual(withoutId(imported), withoutId(baselineImported)), `${backend}: import normalization differs from old version`);
      check(storageAfterImport.design10_sentinel === 'preserve-me', `${backend}: unrelated localStorage value changed`);
      check(legacy ? Array.isArray(JSON.parse(storageAfterImport.saju_list || 'null')) : Object.keys(storageAfterImport).filter(key => key.startsWith('saju:')).length === 1, `${backend}: persistence shape changed`);
      check(!diagnostics.errors.length && !diagnostics.consoleErrors.length, `${backend}: browser errors`);
      report.storage.push({ backend, oldRecordOpenedExactly: isDeepStrictEqual(opened, oldRecord), openingDidNotMutateStorage: isDeepStrictEqual(storageBefore, storageAfterOpen), download: downloadPath, exportedRecordExactly: isDeepStrictEqual(payload.records[0], oldRecord), unchangedImportNormalization: isDeepStrictEqual(withoutId(imported), withoutId(baselineImported)), historicalImportNormalizes: Object.keys(imported).filter(key => key !== 'id' && !isDeepStrictEqual(imported[key], oldRecord[key])), imported, storageKeysAfterImport: Object.keys(storageAfterImport), dialogs, ...diagnostics });
      await page.screenshot({ path: path.join(output, `storage-${backend}-imported.png`) }); await page.close(); console.log(`Storage ${backend}: open/export/import checked`);
    }
  } catch (error) { report.failures.push(error.stack); }
  finally {
    report.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
  console.log(JSON.stringify({ cases: report.cases.length, calculations: report.calculations.length, storage: report.storage.length, names: report.names.length, failures: report.failures, report: path.join(output, 'report.json') }, null, 2));
  process.exitCode = report.failures.length ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });

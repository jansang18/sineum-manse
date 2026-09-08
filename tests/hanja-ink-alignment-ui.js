// The prior alignment test measured .han line boxes. This regression measures
// actual screenshot ink, independently of any production centering formula.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const puppeteer = require('puppeteer-core');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const pageUrl = process.env.INK_URL || pathToFileURL(path.join(root, 'index.html')).href;
const output = path.join(root, 'output', 'qa-hanja-ink');
const widths = process.env.INK_WIDTHS ? process.env.INK_WIDTHS.split(',').map(Number) : [390, 1280];
const rasterScale = Number(process.env.INK_SCALE || 2);
const selector = '.pillar-block .han, #daeunScroll .luck-block .han, #seunScroll .luck-block .han, #woonScroll .luck-block .han';

async function settle(page) {
  await page.evaluate(async () => {
    const bounded = promise => Promise.race([promise, new Promise(resolve => setTimeout(resolve, 1200))]);
    await bounded(document.fonts.ready);
    await bounded(Promise.allSettled(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation => animation.finished)));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

function findInk(raw, imageWidth, imageHeight, foreground, background, scale) {
  const direction = foreground.map((value, i) => value - background[i]);
  const magnitude = direction.reduce((sum, value) => sum + value * value, 0);
  assert.ok(magnitude > 1000, 'Fixture glyph needs sufficient foreground/background separation for raster inspection');
  const inset = Math.ceil(3 * scale);
  let left = imageWidth, top = imageHeight, right = -1, bottom = -1, count = 0;
  for (let y = inset; y < imageHeight - inset; y++) for (let x = inset; x < imageWidth - inset; x++) {
    const index = (y * imageWidth + x) * 4;
    const delta = direction.map((_, channel) => raw[index + channel] - background[channel]);
    const coverage = delta.reduce((sum, value, channel) => sum + value * direction[channel], 0) / magnitude;
    const residual = delta.reduce((sum, value, channel) => sum + (value - coverage * direction[channel]) ** 2, 0);
    // Ignore border/background and very faint antialias fringes. Text paints
    // along the foreground/background color vector; no synthetic text is drawn.
    if (coverage < 0.30 || residual > 45 ** 2 * 3) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y); count++;
  }
  assert.ok(count >= 5, 'Actual glyph ink was not found in screenshot');
  return { left: left / scale, right: (right + 1) / scale, top: top / scale, bottom: (bottom + 1) / scale,
    offsetX: ((left + right + 1) / 2 - imageWidth / 2) / scale,
    offsetY: ((top + bottom + 1) / 2 - imageHeight / 2) / scale, count };
}

async function inspect(width) {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new', timeout: 20000 });
  const watchdog = setTimeout(() => { console.error('[ink] browser deadline exceeded'); browser.process()?.kill(); process.exitCode = 1; }, 90000);
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(12000);
    await page.setViewport({ width, height: 1000, deviceScaleFactor: rasterScale });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluateOnNewDocument(() => localStorage.setItem('saju_theme', 'dark'));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      let body;
      if (/(^|\.)wikipedia\.org$/.test(url.hostname)) body = { query: { pages: {} } };
      else if (/(^|\.)wikidata\.org$/.test(url.hostname)) body = { entities: {}, results: { bindings: [] } };
      if (body) request.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) }).catch(() => {});
      else request.continue().catch(() => {});
    });
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
    await page.type('#inBirth', '20031231');
    await page.click('#calcBtn');
    await page.waitForSelector('.pillar-block .han');
    await page.$eval('#daeunScroll .luck-item', element => element.click());
    await page.waitForSelector('#seunScroll .luck-block .han');
    await settle(page);
    const support = await page.evaluate(() => Object.fromEntries([
      ['trimBoth', CSS.supports('text-box-trim', 'trim-both')],
      ['capAlphabetic', CSS.supports('text-box-edge', 'cap alphabetic')],
      ['ideographic', CSS.supports('text-box-edge', 'ideographic ideographic')],
      ['textBox', CSS.supports('text-box', 'trim-both cap alphabetic')],
    ]));
    const session = await page.createCDPSession();
    await session.send('DOM.enable');
    await session.send('CSS.enable');
    const { root: documentNode } = await session.send('DOM.getDocument');
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: documentNode.nodeId, selector: '.pillar-block:not(.empty) .han' });
    const fonts = await session.send('CSS.getPlatformFontsForNode', { nodeId });
    const variants = ['current', 'Batang', 'sans-serif', 'resize', 'monthly-selected', 'spacing-reset'];
    if (process.env.INK_PROBE_VARIANTS === '1') {
      if (support.capAlphabetic && support.trimBoth) variants.push('trim-cap-alphabetic');
      if (support.ideographic && support.trimBoth) variants.push('trim-ideographic');
      variants.push('metrics-baseline');
    }
    const results = [];
    for (const variant of variants) {
      console.log(`[ink] ${width}px ${variant}`);
      if (variant === 'Batang' || variant === 'sans-serif') {
        await page.evaluate(family => document.documentElement.style.setProperty('--app-font-display', family), variant);
      }
      if (variant === 'resize') {
        await page.evaluate(() => document.documentElement.style.removeProperty('--app-font-display'));
        await page.setViewport({ width: width < 700 ? 1280 : 390, height: 1000, deviceScaleFactor: rasterScale });
      }
      if (variant === 'monthly-selected') {
        await page.setViewport({ width, height: 1000, deviceScaleFactor: rasterScale });
        await page.$eval('#seunScroll .luck-item', element => element.click());
        await page.waitForSelector('#woonScroll .luck-block .han');
        await page.$eval('#woonScroll .luck-item', element => element.click());
        await page.waitForSelector('#woonScroll .luck-item[aria-pressed="true"]');
      }
      if (variant === 'spacing-reset') {
        // Force an uncached style/glyph after nonzero spacing so a reused
        // Canvas context cannot silently keep the previous spacing value.
        await page.$eval('.pillar-block:not(.empty) .han', element => {
          element.style.setProperty('font-size', '53px', 'important');
          element.style.letterSpacing = '2px'; element.style.wordSpacing = '3px';
          element.textContent = '亥';
        });
        await settle(page);
        await page.$eval('.pillar-block:not(.empty) .han', element => {
          element.style.letterSpacing = 'normal'; element.style.wordSpacing = 'normal';
          element.textContent = '壬';
        });
        await page.$eval('.pillar-block.empty .han', element => { element.textContent = '??'; });
        await page.waitForFunction(() => {
          const element = document.querySelector('.pillar-block.empty .han');
          return element.style.getPropertyValue('--hanja-ink-x') === '0.000px' && element.style.getPropertyValue('--hanja-ink-y') === '0.000px';
        });
        await page.$eval('.pillar-block.empty .han', element => { element.textContent = '?'; });
      }
      let style;
      if (variant.startsWith('trim-')) style = await page.addStyleTag({ content: `${selector} { text-box-trim: trim-both !important; text-box-edge: ${variant === 'trim-ideographic' ? 'ideographic ideographic' : 'cap alphabetic'} !important; }` });
      if (variant === 'metrics-baseline') await page.$$eval(selector, elements => {
        const context = document.createElement('canvas').getContext('2d');
        for (const element of elements) {
          const style = getComputedStyle(element);
          if (style.display !== 'block') throw new Error('Baseline diagnostic requires the existing inline formatting context');
          const line = element.getBoundingClientRect();
          const cell = element.parentElement.getBoundingClientRect();
          context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          context.textAlign = 'left'; context.textBaseline = 'alphabetic';
          if ('letterSpacing' in context) context.letterSpacing = style.letterSpacing;
          const metrics = context.measureText(element.textContent.trim());
          const marker = document.createElement('span');
          marker.style.cssText = 'display:inline-block;width:0;height:0;margin:0;padding:0;border:0;font-size:0;line-height:0;vertical-align:baseline;';
          element.append(marker);
          const baseline = marker.getBoundingClientRect().top;
          const after = element.getBoundingClientRect();
          marker.remove();
          if (Math.abs(line.width - after.width) > 0.1 || Math.abs(line.height - after.height) > 0.1) throw new Error('Baseline marker changed text geometry');
          const originX = (line.left + line.right - metrics.width) / 2;
          const dx = (cell.left + cell.right) / 2 - (originX + (metrics.actualBoundingBoxRight - metrics.actualBoundingBoxLeft) / 2);
          const dy = (cell.top + cell.bottom) / 2 - (baseline + (metrics.actualBoundingBoxDescent - metrics.actualBoundingBoxAscent) / 2);
          element.dataset.inkProbeCorrection = JSON.stringify({ dx, dy, baselineRelativeToLine: baseline - line.top });
          element.style.setProperty('transform', `translate(${dx}px, ${dy}px)`, 'important');
        }
      });
      await settle(page);
      const candidates = await page.$$(selector);
      const seen = new Set();
      for (let index = 0; index < candidates.length; index++) {
        const handle = candidates[index];
        const data = await handle.evaluate(element => {
          const cell = element.parentElement;
          const text = element.textContent.trim();
          const style = getComputedStyle(element);
          const cellStyle = getComputedStyle(cell);
          const rect = cell.getBoundingClientRect();
          const line = element.getBoundingClientRect();
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 1;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          const color = value => {
            context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1);
            return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
          };
          context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          context.textBaseline = 'alphabetic';
          context.textAlign = 'left';
          if ('letterSpacing' in context) context.letterSpacing = style.letterSpacing;
          const metrics = context.measureText(text);
          return { text, scope: cell.closest('.pillars-4') ? 'natal' : cell.closest('#daeunScroll') ? 'daeun' : cell.closest('#seunScroll') ? 'seun' : 'monthly',
            width: rect.width, height: rect.height, font: style.font, fontSize: parseFloat(style.fontSize), family: style.fontFamily,
            display: style.display, correction: element.dataset.inkProbeCorrection ? JSON.parse(element.dataset.inkProbeCorrection) : null,
            foreground: color(style.color), background: color(cellStyle.backgroundColor),
            lineOffsetY: (line.top + line.bottom - rect.top - rect.bottom) / 2,
            canvas: Object.fromEntries(['width', 'actualBoundingBoxAscent', 'actualBoundingBoxDescent', 'actualBoundingBoxLeft', 'actualBoundingBoxRight', 'fontBoundingBoxAscent', 'fontBoundingBoxDescent', 'emHeightAscent', 'emHeightDescent'].map(key => [key, metrics[key]])) };
        });
        const key = `${data.scope}-${data.text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const cell = await handle.evaluateHandle(element => element.parentElement);
        await cell.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'center' }));
        await settle(page);
        const png = await cell.screenshot();
        const { data: raw, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const ink = findInk(raw, info.width, info.height, data.foreground, data.background, rasterScale);
        const sample = { viewportWidth: page.viewport().width, rasterScale, variant, ...data, ink };
        results.push(sample);
        fs.writeFileSync(path.join(output, `${width}-${variant}-${data.scope}-${data.text === '?' ? 'unknown' : data.text}-${rasterScale}x.png`), png);
      }
      if (variant === 'current' || variant === 'monthly-selected') {
        for (const [name, section] of [['natal', '.oguk-card'], ['flow', '.luck-section']]) {
          const handle = await page.$(section);
          await handle.evaluate(element => element.scrollIntoView({ block: 'start' }));
          await settle(page);
          await handle.screenshot({ path: path.join(output, `${width}-${variant}-${name}-full-${rasterScale}x.png`) });
        }
      }
      if (style) await style.evaluate(element => element.remove());
      if (variant === 'metrics-baseline') await page.$$eval(selector, elements => elements.forEach(element => { element.style.removeProperty('transform'); delete element.dataset.inkProbeCorrection; }));
    }
    // A baseline probe must not create a permanent observer -> frame loop.
    await settle(page);
    const idleMutations = await page.evaluate(async () => {
      let changes = 0;
      const observer = new MutationObserver(records => { changes += records.length; });
      observer.observe(document.querySelector('.pillars-4'), { childList: true, subtree: true, attributes: true });
      for (let count = 0; count < 6; count++) await new Promise(requestAnimationFrame);
      observer.disconnect(); return changes;
    });
    assert.equal(idleMutations, 0, 'Settled Hanja must not keep mutating itself');
    return { width, support, fonts, results };
  } finally {
    clearTimeout(watchdog);
    let cleanupDeadline;
    await Promise.race([browser.close(), new Promise(resolve => { cleanupDeadline = setTimeout(() => { browser.process()?.kill(); resolve(); }, 5000); })]).finally(() => clearTimeout(cleanupDeadline));
  }
}

async function inspectUnavailableMetrics() {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new', timeout: 20000 });
  const watchdog = setTimeout(() => { browser.process()?.kill(); process.exitCode = 1; }, 30000);
  try {
    for (const mode of ['null-context', 'throwing-context', 'partial-metrics']) {
      console.log(`[ink] CSS fallback ${mode}`);
      const page = await browser.newPage();
      page.setDefaultTimeout(8000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewport({ width: 390, height: 1000 });
      await page.evaluateOnNewDocument(mode => {
        localStorage.setItem('saju_theme', 'dark');
        if (mode === 'partial-metrics') {
          const original = CanvasRenderingContext2D.prototype.measureText;
          CanvasRenderingContext2D.prototype.measureText = function (text) { return { width: original.call(this, text).width }; };
        } else {
          const original = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (type, ...options) {
            if (type !== '2d') return original.call(this, type, ...options);
            if (mode === 'throwing-context') throw new Error('Canvas unavailable fixture');
            return null;
          };
        }
      }, mode);
      try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
        await page.type('#inBirth', '20031231');
        await page.click('#calcBtn');
        await page.waitForSelector('.pillar-block .han');
        await settle(page);
        const state = await page.$$eval('.pillar-block .han', elements => elements.map(element => {
          const cell = element.parentElement.getBoundingClientRect(), line = element.getBoundingClientRect();
          return { text: element.textContent.trim(), width: cell.width, height: cell.height, children: element.children.length,
            dx: (line.left + line.right - cell.left - cell.right) / 2, dy: (line.top + line.bottom - cell.top - cell.bottom) / 2 };
        }));
        assert.equal(state.length, 8, `${mode}: all natal text remains`);
        for (const cell of state) {
          assert.ok(cell.text && cell.children === 0, `${mode}: selectable text remains without measurement probes`);
          assert.ok(Math.abs(cell.width - cell.height) <= 1 && Math.abs(cell.width - state[0].width) <= 1, `${mode}: squares remain equal`);
          assert.ok(Math.abs(cell.dx) <= 1 && Math.abs(cell.dy) <= 1, `${mode}: safe CSS centering remains without metrics`);
        }
        assert.deepEqual(errors, [], `${mode}: unsupported Canvas must not break calculation/rendering`);
      } finally { await page.close(); }
    }
  } finally {
    clearTimeout(watchdog);
    let cleanupDeadline;
    await Promise.race([browser.close(), new Promise(resolve => { cleanupDeadline = setTimeout(() => { browser.process()?.kill(); resolve(); }, 5000); })]).finally(() => clearTimeout(cleanupDeadline));
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const reports = [];
  for (const width of widths) {
    console.log(`[ink] ${width}px real glyph screenshots`);
    reports.push(await inspect(width));
  }
  fs.writeFileSync(path.join(output, 'measurements.json'), JSON.stringify(reports, null, 2));
  fs.writeFileSync(path.join(output, `measurements-${rasterScale}x.json`), JSON.stringify(reports, null, 2));
  const current = reports.flatMap(report => report.results.filter(result => !result.variant.startsWith('trim-') && result.variant !== 'metrics-baseline'));
  assert.ok(new Set(current.map(result => result.text)).size >= 17, 'Coverage needs at least16 distinct Hanja plus ?');
  for (const report of reports) {
    console.log(`[ink] ${report.width}px support ${JSON.stringify(report.support)}; fonts ${JSON.stringify(report.fonts)}`);
    for (const variant of [...new Set(report.results.map(result => result.variant))]) {
      const samples = report.results.filter(result => result.variant === variant);
      console.log(`[ink] ${report.width}px ${variant}: max X ${Math.max(...samples.map(result => Math.abs(result.ink.offsetX))).toFixed(2)}px; max Y ${Math.max(...samples.map(result => Math.abs(result.ink.offsetY))).toFixed(2)}px`);
    }
  }
  const failures = current.filter(result => Math.abs(result.ink.offsetX) > 1.5 || Math.abs(result.ink.offsetY) > 1.5)
    .map(result => `${result.viewportWidth}px ${result.variant} ${result.scope} ${result.text} ${result.fontSize}px: ink X ${result.ink.offsetX.toFixed(2)} Y ${result.ink.offsetY.toFixed(2)} (line Y ${result.lineOffsetY.toFixed(2)})`);
  assert.deepEqual(failures, [], 'Actual screenshot ink must be centered, not merely its CSS line box');
  await inspectUnavailableMetrics();
  console.log('Hanja screenshot ink alignment PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });

// Real rendered contracts for empty states, readable type and finishing details.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, '../../outputs/design-10/css');
const widths = (process.env.DESIGN_WIDTHS || '320,390,720,884,1280,1440').split(',').map(Number);
const themes = (process.env.DESIGN_SCHEMES || 'light,dark').split(',');
const failures = [];
const measurements = [];
const details = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

async function settle(page) {
  await page.evaluate(async () => {
    await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1200))]);
    await Promise.allSettled(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function inspectText(page, label) {
  const result = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const rgba = color => {
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data].map(c => c / 255);
    };
    const composite = (f, b) => f.slice(0, 3).map((n, i) => n * f[3] + b[i] * (1 - f[3]));
    const lum = c => c.map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((s, n, i) => s + n * [.2126, .7152, .0722][i], 0);
    const visible = el => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && !el.closest('.sr-only,svg,script,style,option,[aria-hidden="true"]');
    const rows = [...document.querySelectorAll('body *')].filter(el => visible(el) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).map(el => {
      const cs = getComputedStyle(el);
      const ancestors = []; for (let n = el; n; n = n.parentElement) ancestors.push(n);
      const bg = ancestors.reverse().reduce((b, n) => composite(rgba(getComputedStyle(n).backgroundColor), b), [1, 1, 1]);
      const fg = composite(rgba(cs.color), bg);
      const ls = [lum(fg), lum(bg)].sort((a, b) => a - b);
      return { selector: el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + String(el.className).trim().replace(/\s+/g, '.'), text: el.textContent.trim().slice(0, 50), size: parseFloat(cs.fontSize), weight: parseFloat(cs.fontWeight), color: cs.color, background: bg.map(n => Math.round(n * 255)), contrast: (ls[1] + .05) / (ls[0] + .05) };
    });
    return { rows, scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  check(result.scroll <= 1, `${label}: document overflow ${result.scroll}px`);
  for (const row of result.rows) {
    check(row.size >= 12, `${label}: ${row.selector} ${row.size}px (${row.text})`);
    const minimum = row.size >= 24 || (row.size >= 18 && row.weight >= 700) ? 3 : 4.5;
    check(row.contrast >= minimum - .03, `${label}: contrast ${row.contrast.toFixed(2)} < ${minimum} ${row.selector} (${row.text})`);
  }
  measurements.push({ label, minFont: Math.min(...result.rows.map(row => row.size)), contrast: result.rows });
}

async function run(page, url, width, theme) {
  const label = `${width}-${theme}`;
  await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(value => localStorage.setItem('saju_theme', value), theme);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#calcBtn'); await settle(page);
  await inspectText(page, `${label}-input`);
  if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `${label}-input.png`) });
  await page.click('#personSearchBtn'); await settle(page);
  await inspectText(page, `${label}-people`);
  await page.keyboard.press('Escape');
  await page.$eval('.building-lookup', el => { el.open = true; }); await settle(page);
  await inspectText(page, `${label}-building`);
  await page.$eval('.building-lookup', el => { el.open = false; });
  await page.keyboard.press('Tab');
  await page.evaluate(() => { if (!document.querySelector('#segGender .active')) document.querySelector('#segGender [data-val="M"]').click(); }); await page.focus('#calcBtn');
  const focus = await page.$eval('#calcBtn', el => { const s = getComputedStyle(el); return { width: s.outlineWidth, offset: s.outlineOffset, color: s.outlineColor, gold: getComputedStyle(document.body).getPropertyValue('--apple-focus').trim() }; });
  check(focus.width === '2px' && focus.offset === '2px', `${label}: keyboard focus needs 2px/2px (${focus.width}/${focus.offset})`);
  await page.click('.tab[data-tab="saved"]'); await settle(page);
  const empty = await page.$eval('.saved-empty', el => {
    const r = e => { const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height }; };
    return { parent: r(el), mark: r(el.querySelector('.empty-mark')), copy: r(el.querySelector('p')), action: r(el.querySelector('.empty-cta')) };
  });
  check(empty.mark.width >= 56 && empty.mark.width <= 64 && Math.abs(empty.mark.width - empty.mark.height) < 1, `${label}: saved icon not 56–64px square (${empty.mark.width}×${empty.mark.height})`);
  check(Math.abs((empty.mark.left + empty.mark.right) / 2 - (empty.parent.left + empty.parent.right) / 2) <= 1, `${label}: saved icon not centered`);
  const gap = empty.action.top - empty.copy.bottom;
  check(gap >= 20 && gap <= 24.5, `${label}: empty copy/action gap ${gap}px`);
  await inspectText(page, `${label}-saved`);
  if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `${label}-saved.png`) });
  await page.click('.tab[data-tab="input"]');
  await page.type('#inBirth', '19890319'); await page.type('#inTime', '1430');
  await page.evaluate(() => { if (!document.querySelector('#segGender .active')) document.querySelector('#segGender [data-val="M"]').click(); }); await page.click('#calcBtn'); await page.waitForSelector('#daeunScroll .luck-item'); await settle(page);
  await inspectText(page, `${label}-result`);
  if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `${label}-result.png`) });
  const badges = await page.$$eval('.pillars-4 .he-tag', els => els.map(el => {
    const r = el.getBoundingClientRect(), p = el.closest('.pillar-col').getBoundingClientRect();
    return { text: el.textContent, overflow: Math.max(p.left - r.left, r.right - p.right), top: r.top, right: r.right, bottom: r.bottom, left: r.left };
  }));
  badges.forEach((b, i) => {
    check(b.overflow <= 1, `${label}: badge exceeds pillar (${b.text}, ${b.overflow}px)`);
    badges.slice(i + 1).forEach(other => check(Math.min(b.right, other.right) - Math.max(b.left, other.left) <= .5 || Math.min(b.bottom, other.bottom) - Math.max(b.top, other.top) <= .5, `${label}: badges overlap ${b.text}/${other.text}`));
  });
  const finish = await page.evaluate(() => {
    const bar = document.querySelector('.bottom-bar'), cs = getComputedStyle(bar), r = bar.getBoundingClientRect();
    const card = document.querySelector('.oguk-card').getBoundingClientRect();
    const flow = getComputedStyle(document.querySelector('#daeunScroll'));
    return { barWidth: r.width, cardWidth: card.width, shadow: cs.boxShadow, border: parseFloat(cs.borderTopWidth), mask: flow.maskImage, padding: parseFloat(cs.paddingBottom), bodyFont: parseFloat(getComputedStyle(document.body).fontSize) };
  });
  check(finish.bodyFont === 16, `${label}: body font ${finish.bodyFont}px`);
  check(finish.shadow === 'none' && finish.border >= 1, `${label}: bottom bar requires border and no shadow`);
  check(finish.padding >= 8, `${label}: bottom safe-area base padding missing`);
  check(finish.mask !== 'none', `${label}: luck scroll edge fade missing`);
  if (width >= 1024) check(Math.abs(finish.barWidth - finish.cardWidth) <= 1, `${label}: desktop bottom bar width ${finish.barWidth} != card ${finish.cardWidth}`);
  // Pointer-down feedback is checked on a non-navigating control.
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.evaluate(() => document.querySelector('#saveBtn').scrollIntoView({ block: 'center' }));
  const button = await page.$('#saveBtn'), point = await button.boundingBox();
  await page.mouse.move(point.x + point.width / 2, point.y + point.height / 2); await page.mouse.down();
  await new Promise(resolve => setTimeout(resolve, 120));
  const active = await page.$eval('#saveBtn', el => getComputedStyle(el).transform);
  check(active.startsWith('matrix(0.98,'), `${label}: pointer-down scale ${active}`);
  await page.mouse.move(0, 0); await page.mouse.up();
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  const reduced = await page.$eval('#saveBtn', el => ({ duration: getComputedStyle(el).transitionDuration, animation: getComputedStyle(el).animationName }));
  check(reduced.duration === '0s' && reduced.animation === 'none', `${label}: reduced-motion is not immediate (${reduced.duration}/${reduced.animation})`);
  await page.click('.tab[data-tab="calendar"]'); await settle(page); await inspectText(page, `${label}-calendar`);
  if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `${label}-calendar.png`) });
  details.push({ label, empty, focus, finish, badges, active, reduced });
  console.log(`[css] ${label} inspected`);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (err, bytes) => err ? res.writeHead(404).end() : res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream' }).end(bytes));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    for (const width of widths) for (const theme of themes) {
      const page = await browser.newPage(); page.setDefaultTimeout(20000);
      await page.setRequestInterception(true);
      page.on('request', req => /^https?:\/\/127\.0\.0\.1/.test(req.url()) || req.url().startsWith('data:') ? req.continue().catch(() => {}) : req.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ query: { pages: {} }, entities: {}, results: { bindings: [] } }) }).catch(() => {}));
      try { await run(page, `http://127.0.0.1:${server.address().port}`, width, theme); } finally { await page.close(); }
    }
    fs.writeFileSync(path.join(output, 'measurements.json'), JSON.stringify({ measurements, details, failures: [...new Set(failures)] }, null, 2));
    assert.deepEqual([...new Set(failures)], [], 'Design 10 CSS rendered violations');
    console.log(`Design 10 CSS UI PASS: ${widths.join(',')} × ${themes.join(',')}`);
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });

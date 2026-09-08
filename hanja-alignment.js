/* Center selectable Hanja ink without changing the surrounding square grid. */
(function () {
  'use strict';
  const selector = '.pillar-block > .han, .luck-block > .han';
  const cache = new Map();
  const ownStyles = new WeakMap();
  const probes = new WeakSet();
  let frame = 0;
  let context;

  function apply(element, x, y) {
    const nextX = `${x.toFixed(3)}px`;
    const nextY = `${y.toFixed(3)}px`;
    if (element.style.getPropertyValue('--hanja-ink-x') !== nextX) element.style.setProperty('--hanja-ink-x', nextX);
    if (element.style.getPropertyValue('--hanja-ink-y') !== nextY) element.style.setProperty('--hanja-ink-y', nextY);
    ownStyles.set(element, element.getAttribute('style'));
  }

  function align(element) {
    const text = element.textContent.trim();
    if (!/^[\u3400-\u9fff?]$/u.test(text)) { apply(element, 0, 0); return; }
    const cell = element.parentElement;
    const bounds = cell.getBoundingClientRect();
    const initial = element.getBoundingClientRect();
    if (!bounds.width || !bounds.height || !initial.width || !initial.height) return;
    const style = getComputedStyle(element);
    const size = parseFloat(style.fontSize);
    const precision = Math.max(1, Math.min(4, window.devicePixelRatio || 1));
    // The renderer provides one block containing one inline text run. A grid,
    // multiline run, custom variable axes, or scaled line is not a safe probe.
    if (style.display !== 'block' || style.fontVariationSettings !== 'normal' ||
        !Number.isFinite(size) || Math.abs(initial.height - parseFloat(style.lineHeight)) > 1) {
      apply(element, 0, 0);
      return;
    }
    const key = [text, style.font, style.fontFamily, style.fontKerning, style.fontStretch,
      style.fontVariantCaps, style.letterSpacing, style.wordSpacing, style.textRendering,
      element.closest('[lang]')?.lang || document.documentElement.lang,
      precision, initial.width.toFixed(3), initial.height.toFixed(3)].join('|');
    // Remove a previous correction before reading the real CSS baseline.
    apply(element, 0, 0);
    const line = element.getBoundingClientRect();
    let metrics = cache.get(key);
    if (!metrics) {
      // Fonts can hint/round differently at device-pixel size (notably Batang).
      // Measure the raster's size, then convert its bounds back to CSS pixels.
      context.font = `${style.fontStyle} ${style.fontWeight} ${size * precision}px ${style.fontFamily}`;
      context.textAlign = 'left';
      context.textBaseline = 'alphabetic';
      for (const property of ['fontKerning', 'fontStretch', 'fontVariantCaps', 'letterSpacing', 'wordSpacing', 'textRendering']) {
        if (property in context) context[property] =
          property === 'letterSpacing' || property === 'wordSpacing'
            ? `${(parseFloat(style[property]) || 0) * precision}px` : style[property];
      }
      const measured = context.measureText(text);
      metrics = Object.fromEntries(['width', 'actualBoundingBoxAscent', 'actualBoundingBoxDescent', 'actualBoundingBoxLeft', 'actualBoundingBoxRight']
        .map(name => [name, measured[name] / precision]));
      const values = Object.values(metrics);
      if (!values.every(Number.isFinite) || metrics.width <= 0 ||
          metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent <= 0) return;
      if (cache.size >= 256) cache.clear();
      cache.set(key, metrics);
    }
    if (Math.abs(metrics.width - line.width) > Math.max(1, size * 0.03)) return;

    // Cache only font metrics: a baseline may round differently in another
    // row/position even when the glyph and font size are identical.
    const marker = document.createElement('span');
    probes.add(marker);
    marker.setAttribute('aria-hidden', 'true');
    marker.style.cssText = 'display:inline-block;width:0;height:0;margin:0;padding:0;border:0;font-size:0;line-height:0;vertical-align:baseline;';
    element.append(marker);
    let baseline;
    let after;
    try {
      baseline = marker.getBoundingClientRect().top;
      after = element.getBoundingClientRect();
    } finally { marker.remove(); }
    if (Math.abs(line.width - after.width) > 0.1 || Math.abs(line.height - after.height) > 0.1) return;

    const originX = (line.left + line.right - metrics.width) / 2;
    const x = (bounds.left + bounds.right) / 2 - (originX + (metrics.actualBoundingBoxRight - metrics.actualBoundingBoxLeft) / 2);
    const y = (bounds.top + bounds.bottom) / 2 - (baseline + (metrics.actualBoundingBoxDescent - metrics.actualBoundingBoxAscent) / 2);
    const limit = Math.min(12, size * 0.2, bounds.height * 0.2);
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > limit || Math.abs(y) > limit) return;
    apply(element, x, y);
  }

  function refresh() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      document.querySelectorAll(selector).forEach(element => {
        try { align(element); } catch (_) { apply(element, 0, 0); }
      });
    });
  }

  function start() {
    try { context = document.createElement('canvas').getContext('2d'); } catch (_) { return; }
    if (!context || typeof context.measureText !== 'function') return;
    const observer = new MutationObserver(records => {
      const relevant = records.some(record => {
        if (record.type === 'attributes') {
          return !(record.attributeName === 'style' && ownStyles.has(record.target) &&
            ownStyles.get(record.target) === record.target.getAttribute('style'));
        }
        const nodes = [...record.addedNodes, ...record.removedNodes];
        return record.type === 'characterData' || nodes.some(node => !probes.has(node));
      });
      if (relevant) refresh();
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    // Root font custom properties may change without altering body attributes.
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    window.addEventListener('resize', refresh, { passive: true });
    if (typeof ResizeObserver === 'function') {
      const resize = new ResizeObserver(refresh);
      resize.observe(document.querySelector('.app') || document.body);
    }
    if (document.fonts) {
      const fontsChanged = () => { cache.clear(); refresh(); };
      document.fonts.ready.then(fontsChanged).catch(() => {});
      document.fonts.addEventListener?.('loadingdone', fontsChanged);
    }
    refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

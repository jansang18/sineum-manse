# Fortune Reading Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve every fortune-reading calculation and paragraph while balancing the desktop columns, reducing oversized typography and tightening vertical spacing.

**Architecture:** Keep the existing `life-forecast.js` and `reading.js` render output unchanged. Add observable geometry and computed-style contracts to the real-browser regression runner first, then satisfy them with component-scoped changes in `reading.css`; retain the existing single-column mobile breakpoint and accessibility media behavior.

**Tech Stack:** Static HTML/CSS/JavaScript, native `<details>`, Puppeteer real-Chrome regression runner, GitHub Pages.

## Global Constraints

- Preserve the overall verdict, graph, key turns, evidence tags, 9 life phases, 27 life-phase paragraphs, 7 structural events and 10 deep-reading chapters.
- Do not add accordions or remove content from the deep reading in this change.
- At `768px` and wider, keep a two-column life-phase detail with a `160~180px` left summary rail and a flexible right reading column.
- At `767px` and narrower, retain one-column flow, body copy of at least `14px`, line-height ratio of at least `1.5` and touch targets of at least `44px`.
- Keep major reading headings at or below `24px`; use `15~16px` body copy with approximately `1.7~1.8` leading on desktop.
- Keep horizontal document overflow at `1px` or less in all tested widths.
- Preserve light/dark themes, increased contrast, reduced motion, reduced transparency and the permanent no-cache policy.

---

### Task 1: Add a Real-Browser Readability Contract

**Files:**
- Modify: `tests/ui-regression.js:24-62`
- Modify: `tests/ui-regression.js:1567-1866`

**Interfaces:**
- Consumes: the rendered `.life-phase__body`, `.life-phase__body-label`, `.life-phase__body-content`, `.life-phase__prose p`, `.deep-reading__intro h2`, `.deep-chapter__body h3`, and existing `inspectLongReading()` fixture.
- Produces: focused `TEST_GROUP=reading-readability` coverage at `390`, `768`, and `1280` pixels with computed geometry and typography assertions.

- [ ] **Step 1: Add the focused group and measurements**

Add `reading-readability` to the width routing:

```js
const widths = TEST_GROUP === 'reading-readability'
  ? [390, 768, 1280]
  : TEST_GROUP === 'luck-flow-responsive'
    ? [390, 560, 561, 600, 601, 710, 768, 1220]
    : TEST_GROUP === 'desktop-action-rail'
      ? [390, 1024, 1025, 1280]
      : TEST_GROUP === 'result-width-brand'
        ? [390, 1220, 1280]
        : TEST_GROUP ? [390] : [360, 390, 412, 768];

const runsLongReading = () =>
  !TEST_GROUP || TEST_GROUP === 'long-reading' || TEST_GROUP === 'reading-readability';
```

Keep every existing width-routing branch between `result-width-brand` and the final fallback in its current order; the snippet shows the new first branch and the unchanged outer shape.

Within the existing calculated fortune fixture, open all life-phase disclosures and return literal measurements:

```js
const phaseBody = life.querySelector('.life-phase__body');
const phaseLabel = phaseBody?.querySelector('.life-phase__body-label');
const phaseContent = phaseBody?.querySelector('.life-phase__body-content');
const rect = element => element?.getBoundingClientRect();
const px = value => Number.parseFloat(value || '0');

return {
  phaseBodyColumns: getComputedStyle(phaseBody).gridTemplateColumns.split(' ').length,
  phaseLabelWidth: rect(phaseLabel)?.width || 0,
  phaseContentWidth: rect(phaseContent)?.width || 0,
  phaseBodyPaddingTop: px(getComputedStyle(phaseBody).paddingTop),
  phaseBodyColumnGap: px(getComputedStyle(phaseBody).columnGap),
  phaseBodyFontSize: px(getComputedStyle(life.querySelector('.life-phase__prose p')).fontSize),
  phaseBodyLineHeight: px(getComputedStyle(life.querySelector('.life-phase__prose p')).lineHeight),
  headingSizes: {
    life: px(getComputedStyle(life.querySelector('.life-phases__header h2')).fontSize),
    phase: px(getComputedStyle(life.querySelector('.life-phase__header h3')).fontSize),
    deepIntro: px(getComputedStyle(deep.querySelector('.deep-reading__intro h2')).fontSize),
    deepChapter: px(getComputedStyle(deep.querySelector('.deep-chapter__body h3')).fontSize)
  }
};
```

- [ ] **Step 2: Add independently derived assertions**

Use exact requirements rather than values computed from the stylesheet:

```js
if (width >= 768) {
  assert.equal(state.phaseBodyColumns, 2, `${width}px life phase must retain two columns`);
  assert.ok(state.phaseLabelWidth >= 159 && state.phaseLabelWidth <= 181,
    `${width}px phase label rail must be 160-180px: ${state.phaseLabelWidth}`);
  assert.ok(state.phaseContentWidth > state.phaseLabelWidth,
    `${width}px reading column must be wider than summary rail`);
  assert.ok(state.phaseBodyFontSize >= 15 && state.phaseBodyFontSize <= 16,
    `${width}px desktop phase copy must be 15-16px`);
} else {
  assert.equal(state.phaseBodyColumns, 1, `${width}px life phase must use one column`);
  assert.ok(state.phaseBodyFontSize >= 14, `${width}px mobile phase copy below 14px`);
}
assert.ok(state.phaseBodyLineHeight / state.phaseBodyFontSize >= 1.5,
  `${width}px phase copy line-height is cramped`);
assert.ok(state.phaseBodyPaddingTop <= 32, `${width}px phase body padding is too tall`);
assert.ok(width < 768 || state.phaseBodyColumnGap <= 24, `${width}px phase column gap is too wide`);
for (const [name, size] of Object.entries(state.headingSizes)) {
  assert.ok(size <= 24, `${width}px ${name} heading exceeds 24px: ${size}`);
}
```

Retain the existing literal count, interaction, XSS, theme, disclaimer and overflow assertions.

- [ ] **Step 3: Run the focused test and verify RED**

Run from the web repository:

```powershell
$env:NODE_PATH='C:\Users\whaak\Desktop\바탕화면\manse\app\node_modules'
$env:APP_ROOT='C:\Users\whaak\Desktop\바탕화면\manse\app'
$env:UI_ROOT=(Get-Location).Path
$env:WEB_ROOT=(Get-Location).Path
$env:TEST_GROUP='reading-readability'
node tests/ui-regression.js
```

Expected: FAIL because the desktop label rail is at least `210px`, several headings exceed `24px`, desktop body copy is `14px`, or spacing exceeds the approved limits.

- [ ] **Step 4: Commit the RED contract**

```powershell
git add -- tests/ui-regression.js
git commit -m "test: define fortune reading density"
```

### Task 2: Balance the Reading Layout and Type Scale

**Files:**
- Modify: `reading.css:34-360`
- Modify: `reading.css:489-1357`
- Modify: `reading.css:1390-1505`
- Test: `tests/ui-regression.js`

**Interfaces:**
- Consumes: existing class names and DOM order produced by `renderDeepReading()` and `SajuGangpaeLife.render()`.
- Produces: the approved two-column desktop geometry, compact type scale and one-column mobile fallback without JavaScript changes.

- [ ] **Step 1: Apply the desktop life-phase geometry**

Change only component-scoped declarations in `reading.css`:

```css
.life-phase__body {
  grid-template-columns: clamp(160px, 22%, 180px) minmax(0, 1fr);
  gap: 20px 24px;
  padding: 30px clamp(22px, 4vw, 42px);
}

.life-phase__body-content {
  gap: 16px;
}

.life-phase__body-label strong {
  font-size: 20px;
}

.life-phase__scores {
  width: 100%;
}

.life-phase__prose {
  max-width: 68ch;
  gap: 14px;
}

.life-phase__prose p,
.life-phase__missing {
  font-size: clamp(15px, 1.25vw, 16px);
  line-height: 1.75;
}
```

- [ ] **Step 2: Reduce oversized reading headings and vertical spacing**

Use a maximum `24px` hierarchy and tighter card rhythm:

```css
.deep-reading__intro h2,
.deep-closing h2,
.life-course__header h2,
.life-phases__header h2,
.life-phases--empty h2 {
  font-size: 24px;
  line-height: 1.25;
  letter-spacing: -0.035em;
}

.deep-chapter {
  grid-template-columns: minmax(110px, 140px) minmax(0, 1fr);
  gap: 24px;
  padding: 30px clamp(22px, 4vw, 42px);
}

.deep-chapter__number {
  font-size: 32px;
}

.deep-chapter__body h3,
.life-phase__header h3 {
  font-size: clamp(20px, 2vw, 24px);
  line-height: 1.3;
}

.deep-chapter__lead {
  margin-top: 16px;
  font-size: 16px;
  line-height: 1.75;
}

.deep-prose {
  margin-top: 20px;
}

.deep-prose p {
  font-size: clamp(15px, 1.25vw, 16px);
  line-height: 1.75;
}

.life-phase__summary {
  min-height: 84px;
  padding: 18px clamp(22px, 4vw, 42px);
}

.life-phases__header {
  padding: 30px clamp(22px, 4vw, 42px);
}
```

- [ ] **Step 3: Preserve a readable one-column mobile fallback**

In the existing `@media (max-width: 767px)` block, override the desktop density without reducing touch targets:

```css
@media (max-width: 767px) {
  .deep-reading__intro h2,
  .deep-closing h2,
  .life-course__header h2,
  .life-phases__header h2,
  .life-phases--empty h2 {
    font-size: 22px;
  }

  .deep-chapter,
  .life-phase__body {
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 24px 20px 28px;
  }

  .deep-chapter__body h3,
  .life-phase__header h3 {
    font-size: 21px;
  }

  .deep-prose p,
  .life-phase__prose p,
  .life-phase__missing {
    font-size: 14px;
    line-height: 1.75;
  }

  .life-phase__summary {
    min-height: 0;
    padding: 16px 20px;
  }
}
```

Do not change the `44px` minimum targets, details behavior, media-query fallbacks or color tokens.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same `TEST_GROUP=reading-readability` command from Task 1.

Expected: `UI regression PASS: 390, 768, 1280`.

- [ ] **Step 5: Run long-reading interaction and content preservation checks**

```powershell
$env:TEST_GROUP='long-reading'
node tests/ui-regression.js
```

Expected: PASS with 9 phases, 27 paragraphs, 7 events, 10 chapters, at least 9,000 life-course characters, at least 14,500 combined characters and no annual score cards.

- [ ] **Step 6: Commit the CSS implementation**

```powershell
git add -- reading.css
git commit -m "fix: rebalance fortune reading layout"
```

### Task 3: Verify Accessibility, Responsive Layout and Publication

**Files:**
- Verify: `reading.css`
- Verify: `tests/ui-regression.js`
- Verify: `sw.js`

**Interfaces:**
- Consumes: the CSS and test contract from Tasks 1 and 2.
- Produces: fresh browser evidence, a clean release commit and verified GitHub Pages publication.

- [ ] **Step 1: Run focused accessibility and theme regressions**

```powershell
foreach ($group in @('luck-flow-accessibility','theme-contrast','transparency-contrast','service-worker')) {
  $env:TEST_GROUP=$group
  node tests/ui-regression.js
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

Expected: every group exits `0`, the reduced-transparency surfaces remain opaque, and the service-worker no-cache contract passes.

- [ ] **Step 2: Run responsive tab-shell coverage**

```powershell
$env:TEST_GROUP='all-tab-shell-width'
node tests/ui-regression.js
```

Expected: PASS at `390, 520, 600, 700, 768, 1220` with no horizontal layout shift.

- [ ] **Step 3: Capture real-browser visual evidence**

Use Playwright CLI against the local `index.html` and calculate the standard fixture. Capture the open current life phase at `390x844` and `1280x900` under `output/playwright/fortune-readability/`.

Verify visually at both widths:

- the label rail is compact and the prose is not right-heavy;
- no heading dominates the viewport;
- score cells remain equal;
- no text or border is clipped;
- the mobile flow remains one column.

- [ ] **Step 4: Run final static checks**

```powershell
node --check tests/ui-regression.js
git diff --check
git status --short --branch
```

Expected: syntax and whitespace checks exit `0`; only the approved design, plan and implementation commits are ahead of `origin/main`.

- [ ] **Step 5: Push and verify GitHub Pages**

```powershell
git push origin main
$build = gh api repos/jansang18/sineum-manse/pages/builds/latest | ConvertFrom-Json
"status=$($build.status) commit=$($build.commit)"
```

Wait until the build status is `built` for the pushed commit, then request `https://jansang18.github.io/sineum-manse/?verify=<short-sha>` with `Cache-Control: no-cache` and confirm the updated `reading.css` is served.

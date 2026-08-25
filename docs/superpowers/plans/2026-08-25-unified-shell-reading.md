# Unified Shell and Fortune Reading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 입력·원국·풀이·만세력·저장 화면을 하나의 유동형 셸로 통일하고, 궁합·큰 점수 카드·인생 총운 그래프를 제거한 뒤 풀이를 `연도 종합 → 12개월 월별 → 현재 대운`의 연속 문서로 재구성한다.

**Architecture:** 기존 사주·세운·월운·대운 계산 함수는 그대로 두고, `annual-reading.js`와 `reading.js`가 만든 판독 데이터를 새 `unified-reading.js`에서 다섯 개 연도 문단군·12개월·대운으로 정규화한다. `index.html`은 이 모델을 안전하게 렌더링하고, `apple.css`는 모든 탭의 공통 유동 셸을, 새로 정리한 `reading.css`는 연속 판독문만 담당한다.

**Tech Stack:** 정적 HTML, CSS, vanilla JavaScript, Node.js `assert`, `puppeteer-core`, Chrome headless, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-08-25-unified-shell-reading-design.md`

## Global Constraints

- 풀이 순서는 `해당 연도 종합 풀이 → 12개월 월별 풀이 → 현재 대운 풀이`로 고정한다.
- 궁합 탭·궁합 화면·궁합 모달, 큰 종합 점수 카드, 인생 총운 그래프를 사용자 화면에서 제거한다.
- 기존 원국·세운·월운·대운 계산 로직은 변경하지 않는다.
- 320, 360, 390, 412, 520, 600, 720, 768, 884, 1024, 1280, 1440픽셀에서 가로 넘침이 없어야 한다.
- 폴드 접힘·펼침과 화면 회전 후 재로딩 없이 가용 폭에 맞춰 다시 배치되어야 한다.
- 모든 탭의 좌우 경계는 1픽셀 이내로 일치해야 한다.
- 연도 이동과 대운 선택은 키보드로 접근 가능하고 최소 44픽셀 터치 영역을 유지한다.
- 다크·라이트, 고대비, 모션 축소에서 정보가 사라지지 않아야 한다.
- 캐시 영구 비활성화 정책과 저장 명반 데이터는 그대로 보존한다.

## File Map

- Create: `unified-reading.js` — 기존 두 판독 모델을 다섯 연도 문단군·12개월·대운으로 정규화하는 순수 함수
- Create: `tests/unified-reading-model.js` — 브라우저 없이 정규화 순서, 내용 보존, 입력 방어를 확인하는 단위 테스트
- Modify: `annual-reading.js` — 선택 대운의 기간·간지·십신을 별도 대운 판독 데이터로 노출
- Modify: `index.html` — 궁합 UI와 런타임 제거, 공통 상단 마크업, 통합 판독 렌더러 및 연도/대운 상태 연결
- Modify: `apple.css` — 모든 탭이 공유하는 연속 유동 셸·상단 영역·폴드 대응 규칙
- Replace reading-specific rules in: `reading.css` — 기존 연도 카드·장문 카드·그래프 스타일을 연속 판독문 스타일로 교체
- Modify: `priestess.css` — 공통 셸과 충돌하는 화면별 폭 강제값 제거, 색상 역할만 유지
- Modify: `polish.css`, `luxury.css` — 궁합 전용 선택자와 더 이상 쓰지 않는 점수 카드 장식 제거
- Modify: `tests/ui-regression.js` — 중단된 궁합 재구성 테스트를 폐기하고 제거·순서·셸·폴드·접근성 계약으로 교체
- Keep unchanged: `sw.js` — 캐시 생성 없이 과거 `jansang-manse-*` 캐시만 제거하는 정책 유지

---

### Task 1: Remove Compatibility from the Product Surface

**Files:**
- Modify: `tests/ui-regression.js:23-70, 1380-1490, 1621-1734, 2960-3210, 4230-4360`
- Modify: `index.html:1644-1940, 1980-2060, 2100-2115, 12150-12190, 12880-12905, 15240-15740, 16780-16830`
- Modify: `apple.css:1000-1100, 1430-1505`
- Modify: `priestess.css:608-660`
- Modify: `polish.css:260-325`
- Modify: `luxury.css:280-325, 535-630`

**Interfaces:**
- Consumes: existing tab contract `.tab[data-tab]` and matching `#view-*` tabpanels
- Produces: exactly five tabs `input`, `result`, `fortune`, `calendar`, `saved`; no compatibility runtime or modal entry point

- [ ] **Step 1: Replace the interrupted compatibility test with a failing removal contract**

Replace the uncommitted `TEST_GROUP === 'compatibility-reading'` branch and `inspectCompatibilityReading()` with `TEST_GROUP === 'unified-surface'` at widths `[320, 390, 720, 884, 1280]` and add:

```js
const runsUnifiedSurface = () => TEST_GROUP === 'unified-surface';

async function inspectUnifiedSurface(page, width) {
  if (!runsUnifiedSurface()) return;
  const state = await page.evaluate(() => ({
    tabs: [...document.querySelectorAll('.tab')].map(tab => tab.dataset.tab),
    labels: [...document.querySelectorAll('.tab')].map(tab => tab.textContent.trim()),
    matchNodes: document.querySelectorAll(
      '[data-tab="match"], #view-match, #matchPickerModal, #matchNewModal, [class^="match-"]'
    ).length,
    matchRuntime: typeof window.renderMatch,
    inputMentionsMatch: document.getElementById('view-input').textContent.includes('궁합'),
    aboutMentionsMatch: document.getElementById('aboutModal').textContent.includes('궁합')
  }));
  assert.deepEqual(state.tabs, ['input', 'result', 'fortune', 'calendar', 'saved']);
  assert.deepEqual(state.labels, ['입력', '원국', '풀이', '만세력', '저장']);
  assert.equal(state.matchNodes, 0);
  assert.equal(state.matchRuntime, 'undefined');
  assert.equal(state.inputMentionsMatch, false);
  assert.equal(state.aboutMentionsMatch, false);
}
```

Remove the match leg from `inspectImportedFieldDownstreamSafety()` and make the expected safe snapshots `saved`, `result`, `fortune`, `share`, `similar`. Remove match-only motion and secondary-screen assertions rather than weakening their remaining calendar/saved/fortune checks.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
$env:NODE_PATH='C:\Users\whaak\Desktop\바탕화면\manse\app\node_modules'
$env:APP_ROOT='.'; $env:UI_ROOT='.'; $env:WEB_ROOT='.'
$env:TEST_GROUP='unified-surface'
node tests/ui-regression.js
```

Expected: FAIL because the `match` tab, view, modals, functions, and explanatory copy still exist.

- [ ] **Step 3: Remove compatibility markup, behavior, and dedicated styling**

In `index.html`:

- delete the `tab-match` button and `#view-match` panel;
- delete `#matchPickerModal` and `#matchNewModal`;
- delete the `if (tab === 'match') renderMatch();` branch;
- delete the complete `/* 궁합 */` runtime block from `let matchSlotA` through `submitMatchNewForm()`;
- change the input note to end after the 풀이/만세력 description;
- remove the 궁합 line from the about dialog.

Delete dedicated `.match-*`, `.mb-*`, `.mt-*` selector blocks from the CSS files. When a selector list mixes live and removed components, remove only the match selector and keep the live selector declarations intact.

- [ ] **Step 4: Run focused removal, XSS, keyboard, and syntax checks**

Run:

```powershell
node --check tests/ui-regression.js
$env:TEST_GROUP='unified-surface'; node tests/ui-regression.js
$env:TEST_GROUP='imported-fields-xss'; node tests/ui-regression.js
$env:TEST_GROUP='tabs-keyboard'; node tests/ui-regression.js
```

Expected: all PASS; imported malicious names remain inert in every remaining downstream view.

- [ ] **Step 5: Commit the compatibility removal**

```powershell
git add index.html apple.css priestess.css polish.css luxury.css tests/ui-regression.js
git commit -m "feat: remove compatibility surface"
```

---

### Task 2: Compose One Ordered Reading Model Without Losing the Long Interpretation

**Files:**
- Create: `unified-reading.js`
- Create: `tests/unified-reading-model.js`
- Modify: `annual-reading.js:130-285`
- Modify: `index.html:12180-12205, 14917-14960`

**Interfaces:**
- Consumes: `SajuAnnualReading.build(input)`, `SajuGangpaeReading.build(input)`, selected/derived 대운 context
- Produces: `SajuUnifiedReading.compose({ annualReport, deepReport })` returning `{ year, ganji, title, deck, evidence, yearGroups, months, daeun, rules }`

- [ ] **Step 1: Write a failing pure model test**

Create `tests/unified-reading-model.js` with fixtures whose paragraph markers make loss and duplication visible:

```js
const assert = require('node:assert/strict');
const { compose } = require('../unified-reading.js');

const annualIds = ['structure', 'daeun', 'timing', 'work', 'money', 'relationships', 'health', 'movement'];
const deepIds = ['scene', 'capacity', 'desire', 'money', 'work', 'love', 'people', 'loop', 'timing', 'care'];
const section = (id, prefix) => ({
  id,
  title: `${prefix}-${id}`,
  summary: `${prefix}-${id}-summary`,
  paragraphs: [`${prefix}-${id}-paragraph`],
  evidence: [`${prefix}-${id}-evidence`]
});
const annualReport = {
  year: 2026,
  ganji: '병오',
  title: '2026년 상세운',
  deck: '연도 안내',
  evidence: ['연도 근거'],
  sections: annualIds.map(id => section(id, 'annual')),
  months: Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    label: `${index + 1}월`,
    ganji: '병인',
    guidance: `month-${index + 1}`
  })),
  rules: ['기준 1']
};
const deepReport = {
  sections: deepIds.map(id => section(id, 'deep')),
  closing: { paragraphs: ['closing-paragraph'], rules: ['closing-rule'] }
};

const result = compose({ annualReport, deepReport });
assert.equal(result.year, 2026);
assert.deepEqual(result.yearGroups.map(group => group.id), [
  'core', 'work-money', 'relationships-life', 'health-caution', 'action'
]);
assert.equal(result.months.length, 12);
assert.equal(result.daeun.paragraphs[0], 'annual-daeun-paragraph');
assert.ok(result.yearGroups.flatMap(group => group.paragraphs).includes('deep-money-paragraph'));
assert.ok(result.yearGroups.flatMap(group => group.paragraphs).includes('closing-paragraph'));
assert.equal(result.yearGroups.flatMap(group => group.paragraphs).includes('annual-daeun-paragraph'), false);
assert.throws(() => compose({ annualReport: null, deepReport }), /annualReport/);
console.log('Unified reading model PASS');
```

- [ ] **Step 2: Run the unit test and verify RED**

Run: `node tests/unified-reading-model.js`

Expected: FAIL with `Cannot find module '../unified-reading.js'`.

- [ ] **Step 3: Implement `SajuUnifiedReading.compose()`**

Create a UMD-compatible pure module so both Node tests and the browser can consume it:

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SajuUnifiedReading = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const GROUPS = [
    { id: 'core', title: '올해의 핵심', annual: ['structure'], deep: ['scene', 'capacity', 'desire', 'timing'] },
    { id: 'work-money', title: '일과 재물', annual: ['work', 'money'], deep: ['work', 'money'] },
    { id: 'relationships-life', title: '관계와 생활', annual: ['relationships'], deep: ['love', 'people', 'loop'] },
    { id: 'health-caution', title: '건강과 주의', annual: ['health'], deep: ['care'] },
    { id: 'action', title: '실행 기준', annual: ['timing', 'movement'], deep: [] }
  ];

  function compose({ annualReport, deepReport }) {
    if (!annualReport || !Array.isArray(annualReport.sections)) {
      throw new TypeError('annualReport.sections is required');
    }
    const annual = new Map(annualReport.sections.map(section => [section.id, section]));
    const deep = new Map((deepReport?.sections || []).map(section => [section.id, section]));
    const collect = sections => sections.filter(Boolean).flatMap(section => section.paragraphs || []);
    const yearGroups = GROUPS.map(group => ({
      id: group.id,
      title: group.title,
      paragraphs: collect([
        ...group.annual.map(id => annual.get(id)),
        ...group.deep.map(id => deep.get(id))
      ]),
      evidence: collect([
        ...group.annual.map(id => ({ paragraphs: annual.get(id)?.evidence || [] })),
        ...group.deep.map(id => ({ paragraphs: deep.get(id)?.evidence || [] }))
      ])
    }));
    const closing = deepReport?.closing || {};
    yearGroups[4].paragraphs.push(...(closing.paragraphs || []));
    return {
      year: annualReport.year,
      ganji: annualReport.ganji,
      title: annualReport.title,
      deck: annualReport.deck,
      evidence: annualReport.evidence || [],
      yearGroups,
      months: (annualReport.months || []).slice(0, 12),
      daeun: annual.get('daeun') || { id: 'daeun', title: '현재 대운 풀이', paragraphs: [] },
      rules: [...(annualReport.rules || []), ...(closing.rules || [])]
    };
  }

  return Object.freeze({ compose });
});
```

Use a small local helper rather than the illustrative `collect()` wrapper if needed, but preserve the exact public signature and output keys above.

- [ ] **Step 4: Expose selected 대운 context without changing annual calculations**

In `index.html`, add `resolveReadingDaeun(saju, fortune)`:

```js
function resolveReadingDaeun(saju, fortune) {
  const explicit = Number.isInteger(selectedDaeun) && saju.daeun.list[selectedDaeun]
    ? selectedDaeun
    : saju.daeun.list.indexOf(fortune.curDaeun);
  const index = explicit >= 0 ? explicit : 0;
  const value = saju.daeun.list[index];
  const next = saju.daeun.list[index + 1];
  return {
    index,
    value,
    startAge: value.age,
    endAge: next ? next.age - 1 : null,
    ganji: `${STEM_KOR[value.stem]}${BRANCH_KOR[value.branch]}`,
    stemGod: SIPSIN_KOR[getSipsin(saju.dStem, value.stem)],
    branchGod: SIPSIN_KOR[getSipsin(saju.dStem, JIJANGAN[value.branch][0])]
  };
}
```

Pass this context into `buildAnnualReading()` so `annual-reading.js` creates the final 대운 section with the selected 간지, 십신, and age span. Do not pass it into `calcFortuneAtYear()`; year scores and monthly calculations must remain based on the selected calendar year.

Add `<script src="unified-reading.js"></script>` after `annual-reading.js` and before the inline app script.

- [ ] **Step 5: Run model and syntax tests**

Run:

```powershell
node tests/unified-reading-model.js
node --check annual-reading.js
node --check unified-reading.js
```

Expected: all PASS.

- [ ] **Step 6: Commit the model boundary**

```powershell
git add annual-reading.js unified-reading.js tests/unified-reading-model.js index.html
git commit -m "feat: compose ordered fortune reading model"
```

---

### Task 3: Render a Single Continuous Reading in the Approved Order

**Files:**
- Modify: `tests/ui-regression.js:23-75, 1600-1850, 1980-2290, 4200-4380`
- Modify: `index.html:14961-15240`
- Replace reading-specific rules in: `reading.css`

**Interfaces:**
- Consumes: `SajuUnifiedReading.compose({ annualReport, deepReport })`
- Produces: `.unified-reading` with direct children `[data-reading-section="year"]`, `[data-reading-section="months"]`, `[data-reading-section="daeun"]`, followed by `.reading-disclaimer`

- [ ] **Step 1: Write a failing browser contract for order, visibility, and removal**

Add `TEST_GROUP='unified-reading'` at `[390, 768, 1280]`. After `fillAndCalculate()` and opening 풀이, capture:

```js
const state = await page.evaluate(() => {
  document.querySelector('.tab[data-tab="fortune"]').click();
  const root = document.getElementById('fortuneContent');
  return {
    order: [...root.querySelectorAll('[data-reading-section]')]
      .map(section => section.dataset.readingSection),
    yearGroups: [...root.querySelectorAll('.reading-year-group h3')]
      .map(heading => heading.textContent.trim()),
    months: root.querySelectorAll('.reading-month').length,
    monthLabels: [...root.querySelectorAll('.reading-month__label')]
      .map(label => label.textContent.trim()),
    daeunText: root.querySelector('[data-reading-section="daeun"]')?.textContent || '',
    detailsCount: root.querySelectorAll('details').length,
    scoreCards: root.querySelectorAll('.overall-card, .f-card, .match-total-card').length,
    lifeGraphs: root.querySelectorAll('.life-course, [data-lifetime-graph]').length,
    deepCards: root.querySelectorAll('.deep-reading, .deep-chapter').length,
    disclaimerLast: root.lastElementChild?.classList.contains('reading-disclaimer') || false
  };
});
assert.deepEqual(state.order, ['year', 'months', 'daeun']);
assert.deepEqual(state.yearGroups, ['올해의 핵심', '일과 재물', '관계와 생활', '건강과 주의', '실행 기준']);
assert.equal(state.months, 12);
assert.equal(state.monthLabels[0], '1월');
assert.equal(state.monthLabels[11], '12월');
assert.match(state.daeunText, /대운/);
assert.equal(state.detailsCount, 0);
assert.equal(state.scoreCards, 0);
assert.equal(state.lifeGraphs, 0);
assert.equal(state.deepCards, 0);
assert.equal(state.disclaimerLast, true);
```

Also switch from the current year to next year and assert that the year heading and all 12 monthly nodes change while the top-level order remains fixed. Select a different 대운 on the 원국 tab, reopen 풀이, and assert only the final section reports the selected 대운 간지.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
$env:TEST_GROUP='unified-reading'
node tests/ui-regression.js
```

Expected: FAIL because the old overall card, collapsible annual sections, life graph, and deep-reading card hierarchy are still rendered.

- [ ] **Step 3: Replace old renderers with `renderUnifiedReading()`**

Remove `renderAnnualReading()`, `renderDeepReading()`, life timeline rendering/binding, and the now-unused fortune view-state capture for annual/life disclosures. Implement one escaped renderer:

```js
function renderUnifiedReading(report) {
  const paragraphs = items => (items || [])
    .map(item => `<p>${escapeHtml(String(item))}</p>`)
    .join('');
  const evidence = items => (items || []).length
    ? `<ul class="reading-evidence">${items.map(item => `<li>${escapeHtml(String(item))}</li>`).join('')}</ul>`
    : '';
  return `<article class="unified-reading" aria-labelledby="unifiedReadingTitle">
    <section class="reading-section reading-year" data-reading-section="year">
      <header class="reading-section__head">
        <span>01 · 연도 종합</span>
        <h2 id="unifiedReadingTitle">${escapeHtml(report.title)}</h2>
        <p>${escapeHtml(report.deck)}</p>
      </header>
      ${evidence(report.evidence)}
      ${(report.yearGroups || []).map(group => `<section class="reading-year-group">
        <h3>${escapeHtml(group.title)}</h3>
        <div class="reading-prose">${paragraphs(group.paragraphs)}</div>
        ${evidence(group.evidence)}
      </section>`).join('')}
      ${report.rules?.length ? `<ol class="reading-rules">${report.rules.map(rule => `<li>${escapeHtml(String(rule))}</li>`).join('')}</ol>` : ''}
    </section>
    <section class="reading-section reading-months" data-reading-section="months">
      <header class="reading-section__head"><span>02 · 월별 흐름</span><h2>1월부터 12월까지</h2></header>
      <ol class="reading-month-list">${(report.months || []).map(month => `<li class="reading-month">
        <div><strong class="reading-month__label">${escapeHtml(month.label || `${month.month}월`)}</strong><span>${escapeHtml(month.ganji || '')}</span></div>
        <p>${escapeHtml(month.guidance || '')}</p>
      </li>`).join('')}</ol>
      <p class="reading-method-note">월 표기는 각 달 15일을 대표값으로 삼아 절입 기준 월간지를 계산합니다.</p>
    </section>
    <section class="reading-section reading-daeun" data-reading-section="daeun">
      <header class="reading-section__head"><span>03 · 대운</span><h2>${escapeHtml(report.daeun.title || '현재 대운 풀이')}</h2><p>${escapeHtml(report.daeun.summary || '')}</p></header>
      <div class="reading-prose">${paragraphs(report.daeun.paragraphs)}</div>
      ${evidence(report.daeun.evidence)}
    </section>
  </article>`;
}
```

In `_renderFortuneInner()`:

1. build `annualReport` and `deepReport`;
2. compose `unifiedReport`;
3. render only the compact `.fortune-head`, `renderUnifiedReading(unifiedReport)`, and `.reading-disclaimer`;
4. keep the existing `이전 해 · 올해 · 다음 해` event binding and focus restoration;
5. remove `overallGrade`, `lifeTimeline`, `lifeCourseHtml`, `renderLife.bind`, disclosure state restoration, and deep-index click binding.

- [ ] **Step 4: Replace `reading.css` with continuous-document styling**

Keep the existing palette variables, then style only live reading selectors. The essential layout contract is:

```css
.unified-reading {
  width: 100%;
  color: var(--apple-label);
}

.reading-section {
  padding-block: clamp(28px, 5vw, 56px);
  border-top: 1px solid var(--apple-separator);
}

.reading-section__head,
.reading-year-group,
.reading-month-list,
.reading-method-note,
.reading-prose,
.reading-evidence,
.reading-rules {
  width: min(100%, 72ch);
  margin-inline: auto;
}

.reading-prose {
  font-size: clamp(15px, 1.6vw, 17px);
  line-height: 1.82;
  word-break: keep-all;
  overflow-wrap: anywhere;
}

.reading-year-group + .reading-year-group {
  margin-top: clamp(28px, 5vw, 52px);
}

.reading-month-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.reading-month {
  display: grid;
  grid-template-columns: minmax(88px, .24fr) minmax(0, 1fr);
  gap: clamp(16px, 4vw, 36px);
  padding-block: 20px;
  border-top: 1px solid var(--apple-separator);
}

@media (max-width: 520px) {
  .reading-month { grid-template-columns: 1fr; gap: 8px; }
}
```

Do not add cards around each subsection or each month. Use spacing, headings, and rules for grouping. Add `prefers-contrast: more` and text-size-safe rules; no animated layout transitions.

- [ ] **Step 5: Run model, reading, security, and annual-navigation tests**

Run:

```powershell
node tests/unified-reading-model.js
$env:TEST_GROUP='unified-reading'; node tests/ui-regression.js
$env:TEST_GROUP='annual-year-reading'; node tests/ui-regression.js
$env:TEST_GROUP='imported-fields-xss'; node tests/ui-regression.js
```

Expected: all PASS; output order is fixed and user-controlled names remain escaped.

- [ ] **Step 6: Commit the continuous reading**

```powershell
git add index.html reading.css tests/ui-regression.js
git commit -m "feat: present fortune as one ordered reading"
```

---

### Task 4: Unify Every Tab on One Fluid Shell and Compact Header Rhythm

**Files:**
- Modify: `tests/ui-regression.js:23-75, 2300-2600, 3550-4380`
- Modify: `index.html:190-290, 500-530, 900-960, 1000-1065, 1210-1460, 1930-1965, 1980-2070, 13020-13055, 13917-13960`
- Modify: `apple.css:980-1030, 1360-1385, 1505-1625`
- Modify: `priestess.css:90-175, 600-640, 810-835`

**Interfaces:**
- Consumes: five live `.view` panels and existing `--apple-*` semantic color variables
- Produces: `--app-shell-gutter`, `--app-shell-max`, `--app-shell-width`, `.view-head`, `.view-body-measure`; all five tabpanels share one outer rectangle

- [ ] **Step 1: Write a failing shell geometry contract**

Extend `TEST_GROUP='unified-surface'` widths to the full matrix `[320, 360, 390, 412, 520, 600, 720, 768, 884, 1024, 1280, 1440]`. For each tab, render its populated state and record `.top-bar`, `.tabs`, active `.view`, `.view-head`, and the first primary content block.

```js
const surface = await page.evaluate(async () => {
  const bounds = element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: rect.width, top: rect.top, height: rect.height };
  };
  const tabs = ['input', 'result', 'fortune', 'calendar', 'saved'];
  const rows = [];
  for (const name of tabs) {
    document.querySelector(`.tab[data-tab="${name}"]`).click();
    if (name === 'saved') await renderSaved();
    const view = document.getElementById(`view-${name}`);
    rows.push({
      name,
      view: bounds(view),
      head: bounds(view.querySelector('.view-head')),
      scrollWidth: view.scrollWidth,
      clientWidth: view.clientWidth
    });
  }
  return rows;
});
```

Assert:

- every view has a `.view-head`;
- all view left/right/width values differ by at most 1px;
- all compact headers are between 72px and 132px tall;
- every `scrollWidth <= clientWidth + 1`;
- shell width increases from 390 to 720 and from 884 to 1280 until the common max is reached;
- text measure stays at or below 72ch while calendar/original chart may use full shell width.

Add a resize-in-place check on one page: start at 390px, resize to 884px, then to 720px without reload and assert the active view width follows each viewport and retains the selected tab/year.

- [ ] **Step 2: Run the shell test and verify RED**

Run: `$env:TEST_GROUP='unified-surface'; node tests/ui-regression.js`

Expected: FAIL because current tabs use conflicting 616, 720, 900, 1000, and 1280px caps and not every view has a common header.

- [ ] **Step 3: Define one canonical fluid shell in `apple.css`**

Replace the existing `--apple-content-measure` breakpoint overrides with:

```css
:root {
  --app-shell-gutter: clamp(5px, 2.4vw, 24px);
  --app-shell-max: 1180px;
  --app-shell-width: min(
    calc(100vw - var(--app-shell-gutter) - var(--app-shell-gutter)),
    var(--app-shell-max)
  );
  --app-reading-measure: 72ch;
  --app-section-space: clamp(24px, 4vw, 48px);
}

.app,
.top-bar,
.tabs,
.view,
.bottom-bar {
  width: var(--app-shell-width) !important;
  max-width: none !important;
  margin-inline: auto !important;
  box-sizing: border-box;
}

.view {
  padding-inline: clamp(10px, 2.4vw, 32px) !important;
}

.view-head {
  min-height: clamp(76px, 10vw, 112px);
  padding-block: clamp(16px, 2.5vw, 28px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-bottom: 1px solid var(--apple-separator);
}

.view-body-measure {
  width: min(100%, var(--app-reading-measure));
  margin-inline: auto;
}
```

Remove the 700–1024 special case that restricts the unfolded display. Retain the desktop side action rail only if it remains fully outside the shared content rectangle; otherwise use the common bottom bar width at all sizes.

- [ ] **Step 4: Apply common header markup to all five views**

- Input: add compact `.view-head` with `사주 입력` and one short instruction above the form.
- Result: give the generated `.result-head` the shared `.view-head` class without duplicating the person's name.
- Fortune: give `.fortune-head` the shared `.view-head` class; keep 간지 and year navigation inside its compact height without a score.
- Calendar: wrap the month controls in `.view-head.cal-head` and keep arrow buttons at least 44px.
- Saved: prepend a `.view-head` from `renderSaved()` before the toolbar in both empty and populated states.

Remove inline and stylesheet `max-width` rules for individual `#view-*` panels. Keep inner readable text measures and functional grids, not page-specific outer widths.

- [ ] **Step 5: Make grids consume available width without fixed cards**

Use `repeat(4, minmax(0, 1fr))` for 원국 pillars and `repeat(5, minmax(0, 1fr))` for the remaining five tabs. Keep 44px minimum touch targets and use `clamp()` for gaps/font sizes. On 320px navigation labels must remain one line; on 720/884px unfolded layouts must use the additional width rather than staying at 616px.

- [ ] **Step 6: Run shell, fold, accessibility, and theme checks**

Run:

```powershell
$env:TEST_GROUP='unified-surface'; node tests/ui-regression.js
$env:TEST_GROUP='fold-layout'; node tests/ui-regression.js
$env:TEST_GROUP='apple-design'; node tests/ui-regression.js
$env:TEST_GROUP='secondary-apple'; node tests/ui-regression.js
```

Expected: all PASS at the specified widths and both themes.

- [ ] **Step 7: Commit the unified shell**

```powershell
git add index.html apple.css priestess.css tests/ui-regression.js
git commit -m "feat: unify responsive application shell"
```

---

### Task 5: Clean Obsolete Reading Runtime and Update the Full Regression Suite

**Files:**
- Modify: `index.html:12180-12210, 14740-14910, 15060-15240`
- Modify: `tests/ui-regression.js:1-4590`
- Verify unchanged behavior: `life-model.js`, `life-forecast.js`, `sw.js`

**Interfaces:**
- Consumes: final five-tab UI and `.unified-reading` structure
- Produces: no loaded/rendered life graph runtime, no stale test expecting removed UI, cache/XSS/calendar/lunar/original-chart behavior preserved

- [ ] **Step 1: Add source-level removal assertions**

In `inspectUnifiedSurface()` or a source contract, assert:

```js
const source = fs.readFileSync(path.join(UI_ROOT, 'index.html'), 'utf8');
assert.doesNotMatch(source, /<script src="life-model\.js"><\/script>/);
assert.doesNotMatch(source, /<script src="life-forecast\.js"><\/script>/);
assert.doesNotMatch(source, /function buildLifeTimeline\(/);
assert.doesNotMatch(source, /function renderMatch\(/);
assert.match(source, /<script src="unified-reading\.js"><\/script>/);
```

Keep `life-model.js` and `life-forecast.js` in the repository as dormant historical modules unless a separate cleanup request authorizes deletion; they must not be loaded or rendered.

- [ ] **Step 2: Run the source test and verify RED**

Run: `$env:TEST_GROUP='unified-surface'; node tests/ui-regression.js`

Expected: FAIL while old life scripts/functions remain referenced.

- [ ] **Step 3: Remove obsolete runtime hooks and rewrite stale assertions**

- remove the two life script tags and `buildLifeTimeline()` from `index.html`;
- remove fortune disclosure state functions that only operated on deleted `<details>`/life controls;
- update `annual-year-reading`, `long-reading`, `reading-readability`, Apple secondary, motion, and imported-field tests to assert the new continuous structure;
- delete assertions that demand `.overall-card`, `.life-course`, `.deep-reading`, `.match-slot`, or old accordion open state;
- retain equivalent assertions for text length, content ordering, year navigation, safe HTML rendering, focus, target size, line length, and overflow.

- [ ] **Step 4: Run all focused functional regressions**

Run:

```powershell
$groups = @(
  'unified-surface', 'unified-reading', 'annual-year-reading',
  'reading-readability', 'lunar-input', 'luck-flow-order',
  'luck-flow-accessibility', 'luck-flow-responsive', 'calendar-current-year',
  'calendar-shell-width', 'all-tab-shell-width', 'imported-fields-xss',
  'final-security', 'service-worker'
)
foreach ($group in $groups) {
  $env:TEST_GROUP = $group
  node tests/ui-regression.js
  if ($LASTEXITCODE -ne 0) { throw "Regression failed: $group" }
}
```

Expected: every group PASS.

- [ ] **Step 5: Run the full regression suite**

Run:

```powershell
Remove-Item Env:TEST_GROUP -ErrorAction SilentlyContinue
node tests/ui-regression.js
```

Expected: PASS at the default viewport matrix with no console exceptions.

- [ ] **Step 6: Commit runtime/test cleanup**

```powershell
git add index.html tests/ui-regression.js
git commit -m "test: align regressions with unified reading"
```

---

### Task 6: Visual QA, Release Verification, and GitHub Pages Deployment

**Files:**
- Verify: `index.html`, `unified-reading.js`, `annual-reading.js`, `apple.css`, `priestess.css`, `reading.css`, `polish.css`, `luxury.css`, `sw.js`
- Create locally only: `output/qa/unified-*.png` screenshots; do not commit unless requested

**Interfaces:**
- Consumes: verified local static site
- Produces: committed `main`, pushed GitHub Pages source, live URL verified with cache-busting query

- [ ] **Step 1: Read the mobile QA reference before making readiness claims**

Read `C:\Users\whaak\.codex\skills\mobile-responsive-qa\references\mobile-responsive-qa-guide.md` completely and apply its overflow, touch, text, rotation, console, and screenshot checklist.

- [ ] **Step 2: Capture representative light/dark screenshots**

Use Chrome/Puppeteer to capture populated input, 원국, 풀이, 만세력, 저장 views at:

- 390×844 standard smartphone
- 344×882 narrow folded phone
- 720×900 unfolded fold portrait
- 884×720 unfolded fold landscape
- 1280×900 desktop

For each, inspect the common left/right edges, header height, 12 monthly rows, paragraph line length, tap targets, Hanja clipping, and whether any section looks card-heavy or visually lopsided. Record `console` and `pageerror` events and require zero uncaught errors.

- [ ] **Step 3: Run final static and test verification from a clean command context**

Run:

```powershell
git diff --check
node --check annual-reading.js
node --check reading.js
node --check unified-reading.js
node --check tests/ui-regression.js
node tests/unified-reading-model.js
$env:NODE_PATH='C:\Users\whaak\Desktop\바탕화면\manse\app\node_modules'
$env:APP_ROOT='.'; $env:UI_ROOT='.'; $env:WEB_ROOT='.'
Remove-Item Env:TEST_GROUP -ErrorAction SilentlyContinue
node tests/ui-regression.js
git status --short
```

Expected: no diff errors, syntax errors, test failures, or unexpected untracked artifacts.

- [ ] **Step 4: Verify the permanent no-cache contract**

Run: `$env:TEST_GROUP='service-worker'; node tests/ui-regression.js`

Expected: PASS; `sw.js` still has no fetch handler or precache and the page still unregisters legacy workers/deletes only `jansang-manse-*` caches.

- [ ] **Step 5: Commit any QA-only corrections**

If visual QA found in-scope defects, make one focused correction at a time, rerun its failing viewport test, then:

```powershell
git add index.html apple.css priestess.css reading.css tests/ui-regression.js
git commit -m "fix: balance unified responsive layout"
```

If no correction was required, do not create an empty commit.

- [ ] **Step 6: Push and verify GitHub Pages**

Run:

```powershell
git push origin main
$revision = (git rev-parse --short HEAD).Trim()
```

Open `https://jansang18.github.io/sineum-manse/?verify=$revision` and verify in the rendered live site:

- five tabs only;
- no 궁합, score card, or life graph;
- reading order is year → 12 months → 대운;
- previous/current/next year changes the year and month content;
- 390px and 1280px screenshots match local geometry;
- response is not served from the removed app cache.

- [ ] **Step 7: Final handoff**

Report the live URL, final commit, exact focused/full commands that passed, viewport screenshots inspected, cache policy result, and anything not tested. Do not claim an APK build because this approved scope is the web product only.
